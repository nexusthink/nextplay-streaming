import express from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import zlib from 'zlib';
import { URL } from 'url';

const app = express();
const PORT = process.env.PORT || 4150;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Métricas em tempo real do motor de buffers
let activeStreams = 0;
let totalBytesTransferred = 0;

const DEFAULT_IPTV_UA = 'VLC/3.0.20 LibVLC/3.0.20';

// Agentes HTTP/HTTPS com Keep-Alive persistente para reutilizar a mesma conexão TCP na CDN IPTV
// (Evita estourar o limite max_connections do painel Xtream e elimina latência de handshake)
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 6,
  maxFreeSockets: 2,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 6,
  maxFreeSockets: 2,
  rejectUnauthorized: false,
});

// Cache de redirecionamentos de sessões de stream (evita pedir novo token 302 a cada refresh do HLS)
const streamRedirectCache = new Map();

// Cache em memória de legendas automáticas baixadas (evita baixar novamente a mesma legenda)
const subtitleCache = new Map();

// Cache em memória de traduções em tempo real de Closed Caption (PT <-> EN)
const translationCache = new Map();

// Cache de offsets binários das faixas de áudio (soun) dentro do átomo moov de arquivos MP4 [Dual]
const mp4TrackOffsetsCache = new Map();

/**
 * Inspeciona o cabeçalho moov de um arquivo MP4 para localizar os offsets exatos das faixas de áudio (soun).
 * Permite alternar entre Áudio 1 (Dublado PT-BR) e Áudio 2 (Inglês Original) em tempo real direto no proxy!
 */
async function getMp4SounTrackOffsets(targetUrl) {
  if (mp4TrackOffsetsCache.has(targetUrl)) {
    return mp4TrackOffsetsCache.get(targetUrl);
  }
  try {
    const { res: probeRes } = await fetchUrlRaw(targetUrl, {
      headers: { Range: 'bytes=0-8388607' },
      timeout: 12000,
    });
    const chunks = [];
    let total = 0;
    for await (const chunk of probeRes) {
      chunks.push(chunk);
      total += chunk.length;
      if (total >= 8388608) break;
    }
    const buf = Buffer.concat(chunks);
    const sounTracks = [];
    let offset = 0;

    while (offset + 8 <= buf.length) {
      const size = buf.readUInt32BE(offset);
      const type = buf.slice(offset + 4, offset + 8).toString('ascii');
      if (size < 8) break;

      if (type === 'moov') {
        let mOff = offset + 8;
        const mEnd = Math.min(buf.length, offset + size);
        while (mOff + 8 <= mEnd) {
          const tSize = buf.readUInt32BE(mOff);
          const tType = buf.slice(mOff + 4, mOff + 8).toString('ascii');
          if (tSize < 8) break;

          if (tType === 'trak') {
            const trakSlice = buf.slice(mOff, Math.min(buf.length, mOff + tSize));
            const tkhdIdx = trakSlice.indexOf('tkhd');
            const hdlrIdx = trakSlice.indexOf('hdlr');
            const handler =
              hdlrIdx >= 0 ? trakSlice.slice(hdlrIdx + 12, hdlrIdx + 16).toString('ascii') : '';
            if (handler === 'soun' && tkhdIdx >= 0) {
              sounTracks.push({
                trakTypeOffset: mOff + 4,
                tkhdFlagsByteOffset: mOff + tkhdIdx + 7,
              });
            }
          }
          mOff += tSize;
        }
        break;
      }
      offset += size;
    }

    mp4TrackOffsetsCache.set(targetUrl, sounTracks);
    return sounTracks;
  } catch {
    return [];
  }
}

// Rastreia conexões upstream de streams contínuos (.ts) para fechar a anterior ao trocar de canal
const activeUpstreamStreams = new Set();

/**
 * Helper HTTP/HTTPS request com suporte a redirecionamentos (301, 302, 307, 308)
 * e Auto-Healer de subdomínios IPTV encurtados (ex: e.dominio.xyz -> dominio.xyz)
 */
function fetchUrlRaw(targetUrl, options = {}, maxRedirects = 5, triedRootFallback = false) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(targetUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const reqOptions = {
        agent: isHttps ? httpsAgent : httpAgent,
        headers: {
          'User-Agent': options.userAgent || DEFAULT_IPTV_UA,
          'Accept': '*/*',
          'Connection': 'keep-alive',
          ...(options.headers || {}),
        },
        timeout: options.timeout || 30000,
        rejectUnauthorized: false,
      };

      const req = client.get(parsedUrl, reqOptions, (res) => {
        if (
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location &&
          maxRedirects > 0
        ) {
          res.resume();
          const redirectUrl = new URL(res.headers.location, parsedUrl).toString();
          return resolve(fetchUrlRaw(redirectUrl, options, maxRedirects - 1, triedRootFallback));
        }

        // Se for um shortlink /p/{user}/{pass}/m3u que deu 404 no domínio raiz, converte para /get.php
        if (res.statusCode === 404) {
          const shortMatch = parsedUrl.pathname.match(/^\/p\/([^/]+)\/([^/]+)(\/m3u.*)?$/i);
          if (shortMatch) {
            res.resume();
            const [, u, p] = shortMatch;
            const healedUrl = `${parsedUrl.protocol}//${parsedUrl.host}/get.php?username=${encodeURIComponent(
              u
            )}&password=${encodeURIComponent(p)}&type=m3u_plus&output=ts`;
            return resolve(fetchUrlRaw(healedUrl, options, maxRedirects - 1, true));
          }
        }

        resolve({ res, finalUrl: parsedUrl.toString() });
      });

      req.on('error', (err) => {
        // Auto-Healer DNS: se o subdomínio encurtador (ex: e.cinemaxhub.xyz) não existir (ENOTFOUND),
        // remove o primeiro subdomínio e tenta no domínio principal (cinemaxhub.xyz)
        if (!triedRootFallback && err && (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN')) {
          const hostParts = parsedUrl.hostname.split('.');
          if (hostParts.length >= 3) {
            const rootHost = hostParts.slice(1).join('.');
            const fallbackUrlObj = new URL(parsedUrl.toString());
            fallbackUrlObj.hostname = rootHost;

            // Se for rota curta /p/{user}/{pass}/m3u, já converte para /get.php ou mantém
            const shortMatch = fallbackUrlObj.pathname.match(/^\/p\/([^/]+)\/([^/]+)(\/m3u.*)?$/i);
            if (shortMatch) {
              const [, u, p] = shortMatch;
              fallbackUrlObj.pathname = '/get.php';
              fallbackUrlObj.search = `?username=${encodeURIComponent(u)}&password=${encodeURIComponent(
                p
              )}&type=m3u_plus&output=ts`;
            }

            return resolve(
              fetchUrlRaw(fallbackUrlObj.toString(), options, maxRedirects, true)
            );
          }
        }
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout ao conectar no servidor IPTV'));
      });
    } catch (err) {
      reject(err);
    }
  });
}

// 1. Health & Telemetria de Memória / Buffers
app.get('/api/health', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    engine: 'NextPlay Express Micro-Server v1.0',
    hwAcceleration: 'DirectComposition + D3D11 + ZeroCopy',
    activeStreams,
    totalMBTransferred: +(totalBytesTransferred / (1024 * 1024)).toFixed(2),
    memoryMB: {
      rss: +(mem.rss / (1024 * 1024)).toFixed(1),
      heapUsed: +(mem.heapUsed / (1024 * 1024)).toFixed(1),
    },
    uptimeSec: Math.floor(process.uptime()),
  });
});

// 2. Proxy para Xtream Codes API (player_api.php)
app.get('/api/xtream', async (req, res) => {
  const { server, username, password, action, category_id, vod_id, series_id, stream_id, limit } = req.query;

  if (!server || !username || !password) {
    return res.status(400).json({ error: 'Parâmetros server, username e password são obrigatórios.' });
  }

  try {
    const baseUrl = String(server).trim().replace(/\/+$/, '');
    const apiUrl = new URL(`${baseUrl}/player_api.php`);
    apiUrl.searchParams.set('username', String(username).trim());
    apiUrl.searchParams.set('password', String(password).trim());

    if (action) apiUrl.searchParams.set('action', String(action));
    if (category_id) apiUrl.searchParams.set('category_id', String(category_id));
    if (vod_id) apiUrl.searchParams.set('vod_id', String(vod_id));
    if (series_id) apiUrl.searchParams.set('series_id', String(series_id));
    if (stream_id) apiUrl.searchParams.set('stream_id', String(stream_id));
    if (limit) apiUrl.searchParams.set('limit', String(limit));

    // Aumentado timeout para 60 segundos para suportar catálogos maciços de 50.000+ VODs/Séries
    const { res: upstream } = await fetchUrlRaw(apiUrl.toString(), { timeout: 60000 });

    const chunks = [];
    upstream.on('data', (chunk) => chunks.push(chunk));
    upstream.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        const data = JSON.parse(raw);
        res.json(data);
      } catch (parseErr) {
        res.status(502).json({
          error: 'Resposta inválida do servidor Xtream Codes.',
          details: String(parseErr),
        });
      }
    });
  } catch (err) {
    res.status(502).json({
      error: 'Falha ao conectar no servidor Xtream Codes.',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// 3. Proxy para baixar Listas M3U / M3U8 remotas sem bloqueio de CORS ou User-Agent
app.get('/api/m3u', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Parâmetro url é obrigatório.' });
  }

  try {
    const { res: upstream } = await fetchUrlRaw(String(url), { timeout: 30000 });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    upstream.pipe(res);
  } catch (err) {
    res.status(502).json({
      error: 'Não foi possível carregar a lista M3U informada.',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// 3.5 Motor de Busca e Download Automático de Legendas Online (OpenSubtitles REST + Decompressão GZIP)
app.get('/api/subtitles', async (req, res) => {
  const rawTitle = String(req.query.title || '').trim();
  const season = req.query.season ? Number(req.query.season) : null;
  const episode = req.query.episode ? Number(req.query.episode) : null;
  const lang = String(req.query.lang || 'pob').toLowerCase();

  if (!rawTitle) {
    return res.status(400).json({ found: false, error: 'Título é obrigatório.' });
  }

  const cacheKey = `${rawTitle.toLowerCase()}|${season || ''}|${episode || ''}|${lang}`;
  if (subtitleCache.has(cacheKey)) {
    return res.json(subtitleCache.get(cacheKey));
  }

  try {
    // Extrai possível título original entre parênteses ex: "Legados (Legacies)"
    const parenMatch = rawTitle.match(/\(([a-zA-Z\s:'-]{3,})\)/);
    const englishAlt =
      parenMatch && !/^(leg|legendado|dub|dublado|dual)$/i.test(parenMatch[1].trim())
        ? parenMatch[1].trim()
        : null;

    // Limpa tags de IPTV ([Dual], [Leg], (2026), S01E01, FHD, 4K, etc.)
    const cleanBase = rawTitle
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\(\d{4}\)/g, '')
      .replace(/\((leg|legendado|dub|dublado|dual)\)/gi, '')
      .replace(/[-–:]?\s*S\d{1,2}\s*E\d{1,3}.*$/i, '')
      .replace(/\b(fhd|hd|sd|4k|uhd|h265|webrip|cam|dual|leg|legendado|dublado)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const candidateQueries = Array.from(
      new Set([englishAlt, cleanBase, cleanBase.split(':')[0].trim()].filter(Boolean))
    );

    const searchOpenSubtitles = async (queryText, subLang) => {
      // IMPORTANTE: A API REST do OpenSubtitles exige os parâmetros de rota em ordem alfabética!
      const segments = [];
      if (episode && Number.isFinite(episode)) segments.push(`episode-${episode}`);
      segments.push(`query-${encodeURIComponent(queryText.toLowerCase())}`);
      if (season && Number.isFinite(season)) segments.push(`season-${season}`);
      segments.push(`sublanguageid-${subLang}`);

      const searchUrl = `https://rest.opensubtitles.org/search/${segments.join('/')}`;
      const { res: osRes } = await fetchUrlRaw(searchUrl, {
        userAgent: 'TemporaryUserAgent',
        timeout: 12000,
      });

      const chunks = [];
      for await (const chunk of osRes) {
        chunks.push(chunk);
      }
      const text = Buffer.concat(chunks).toString('utf-8');
      const list = JSON.parse(text);
      return Array.isArray(list) ? list : [];
    };

    let results = [];
    for (const q of candidateQueries) {
      if (!q || q.length < 2) continue;
      results = await searchOpenSubtitles(q, lang).catch(() => []);
      if (results.length > 0) break;
      if (lang === 'pob') {
        results = await searchOpenSubtitles(q, 'por').catch(() => []);
        if (results.length > 0) break;
      }
    }

    if (!results || results.length === 0) {
      return res.json({ found: false });
    }

    // Prioriza legendas completas (.srt) que não sejam apenas FORCED e que batam com o ano do filme
    const yearMatch = rawTitle.match(/\((\d{4})\)/);
    const targetYear = yearMatch ? yearMatch[1] : null;
    const srtResults = results.filter(
      (item) =>
        item &&
        item.SubDownloadLink &&
        String(item.SubFormat || 'srt').toLowerCase() === 'srt' &&
        !/forced/i.test(String(item.SubFileName || ''))
    );
    const chosen =
      (targetYear &&
        srtResults.find(
          (item) =>
            String(item.MovieYear || '') === targetYear ||
            String(item.SubFileName || '').includes(targetYear)
        )) ||
      srtResults[0] ||
      results[0];

    if (!chosen || !chosen.SubDownloadLink) {
      return res.json({ found: false });
    }

    const { res: gzStream } = await fetchUrlRaw(chosen.SubDownloadLink, {
      userAgent: 'TemporaryUserAgent',
      timeout: 15000,
    });

    const gzChunks = [];
    for await (const chunk of gzStream) {
      gzChunks.push(chunk);
    }
    const gzBuffer = Buffer.concat(gzChunks);
    const rawSrtBuffer = zlib.gunzipSync(gzBuffer);

    // Detecta automaticamente UTF-8 vs Latin1 (ISO-8859-1 / Windows-1252 comum em legendas PT-BR)
    let srtText = rawSrtBuffer.toString('utf-8');
    if (srtText.includes('\uFFFD')) {
      srtText = rawSrtBuffer.toString('latin1');
    }

    // Remove propagandas de cabeçalho do OpenSubtitles
    srtText = srtText
      .replace(/.*OpenSubtitles.*/gi, '')
      .replace(/.*osdb\.link.*/gi, '');

    const payload = {
      found: true,
      fileName: chosen.SubFileName || `${cleanBase}.srt`,
      lang: chosen.SubLanguageID || lang,
      srt: srtText,
    };

    subtitleCache.set(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    return res.json({
      found: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// 3.6 Tradutor em Tempo Real de Closed Captions / Falas Ao Vivo (PT-BR <-> EN-US)
app.get('/api/translate', async (req, res) => {
  const text = String(req.query.text || '').trim();
  const from = String(req.query.from || 'pt').trim();
  const to = String(req.query.to || 'en').trim();

  if (!text) {
    return res.json({ translatedText: '' });
  }

  const cacheKey = `${from}|${to}|${text.toLowerCase()}`;
  if (translationCache.has(cacheKey)) {
    return res.json({ translatedText: translationCache.get(cacheKey) });
  }

  try {
    // 1. Motor Neural Ultrarrápido (~45ms) via Google Translate API (dict-chrome-ex)
    const gUrl = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(
      from
    )}&tl=${encodeURIComponent(to)}&q=${encodeURIComponent(text)}`;
    const { res: gRes } = await fetchUrlRaw(gUrl, { timeout: 3500 });
    const gChunks = [];
    for await (const c of gRes) {
      gChunks.push(c);
    }
    const gRaw = Buffer.concat(gChunks).toString('utf-8');
    const gData = JSON.parse(gRaw);
    const gTranslated = Array.isArray(gData)
      ? typeof gData[0] === 'string'
        ? gData[0]
        : Array.isArray(gData[0])
        ? gData[0].map((x) => (Array.isArray(x) ? x[0] : x)).join('')
        : ''
      : '';
    if (gTranslated && gTranslated.trim()) {
      const clean = gTranslated.trim();
      translationCache.set(cacheKey, clean);
      return res.json({ translatedText: clean });
    }
  } catch {
    // Fallback para MyMemory
  }

  try {
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=${encodeURIComponent(`${from}|${to}`)}`;
    const { res: upRes } = await fetchUrlRaw(apiUrl, { timeout: 6000 });
    const chunks = [];
    for await (const c of upRes) {
      chunks.push(c);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    const translated = data?.responseData?.translatedText || text;
    translationCache.set(cacheKey, translated);
    return res.json({ translatedText: translated });
  } catch {
    return res.json({ translatedText: text });
  }
});

// 3.6. Voz Neural em Inglês (TTS MP3 Real-Time para SAP Sintético em Canais Ao Vivo)
const ttsAudioCache = new Map();
app.get('/api/tts', async (req, res) => {
  const text = String(req.query.text || '').trim().slice(0, 200);
  const lang = String(req.query.lang || 'en').trim();

  if (!text) {
    return res.status(400).send('Missing text');
  }

  const cacheKey = `${lang}|${text.toLowerCase()}`;
  if (ttsAudioCache.has(cacheKey)) {
    const buf = ttsAudioCache.get(cacheKey);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.end(buf);
  }

  try {
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
      lang
    )}&q=${encodeURIComponent(text)}`;
    const { res: upRes } = await fetchUrlRaw(ttsUrl, { timeout: 5000 });
    const chunks = [];
    for await (const c of upRes) {
      chunks.push(c);
    }
    const audioBuf = Buffer.concat(chunks);
    if (audioBuf.length > 200) {
      if (ttsAudioCache.size > 200) {
        const firstKey = ttsAudioCache.keys().next().value;
        ttsAudioCache.delete(firstKey);
      }
      ttsAudioCache.set(cacheKey, audioBuf);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuf.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.end(audioBuf);
  } catch (err) {
    return res.status(502).send(String(err));
  }
});

// 4. Proxy Inteligente de Stream (HLS .m3u8, MPEG-TS .ts, MP4, MKV) com Gerenciamento de Buffers e Troca de Áudio Dual
app.get('/api/stream', async (req, res) => {
  const rawTargetUrl = req.query.url ? String(req.query.url) : '';
  const requestedAudioTrack = req.query.audioTrack ? Number(req.query.audioTrack) : 0;
  if (!rawTargetUrl) {
    return res.status(400).send('Missing stream url');
  }

  try {
    const forwardHeaders = {};
    if (req.headers.range) {
      forwardHeaders['Range'] = req.headers.range;
    }

    // Verifica se já temos uma URL de edge/token redirecionada em cache para esta stream HLS
    const cachedRedirect = streamRedirectCache.get(rawTargetUrl);
    const effectiveTargetUrl =
      cachedRedirect && cachedRedirect.expiresAt > Date.now()
        ? cachedRedirect.finalUrl
        : rawTargetUrl;

    let { res: upstream, finalUrl } = await fetchUrlRaw(effectiveTargetUrl, {
      headers: forwardHeaders,
      timeout: 15000,
    });

    // Se a URL em cache expirou no servidor edge (403/404), limpa o cache e busca novo token na URL original
    if (
      effectiveTargetUrl !== rawTargetUrl &&
      upstream.statusCode &&
      upstream.statusCode >= 400
    ) {
      upstream.resume();
      streamRedirectCache.delete(rawTargetUrl);
      const retry = await fetchUrlRaw(rawTargetUrl, {
        headers: forwardHeaders,
        timeout: 15000,
      });
      upstream = retry.res;
      finalUrl = retry.finalUrl;
    }

    if (finalUrl !== rawTargetUrl && (upstream.statusCode === 200 || upstream.statusCode === 206)) {
      streamRedirectCache.set(rawTargetUrl, {
        finalUrl,
        expiresAt: Date.now() + 3 * 60 * 1000, // 3 minutos de sessão ativa
      });
    }

    const contentType = (upstream.headers['content-type'] || '').toLowerCase();
    const isM3u8 =
      finalUrl.toLowerCase().includes('.m3u8') ||
      rawTargetUrl.toLowerCase().includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('x-mpegurl');

    // Se for um manifesto HLS (.m3u8), lê os primeiros chunks para confirmar se é texto #EXTM3U
    if (isM3u8) {
      const chunks = [];
      upstream.on('data', (c) => chunks.push(c));
      upstream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const manifestText = buffer.toString('utf-8');

        // Caso o servidor tenha retornado binário TS mesmo com extensão .m3u8
        if (!manifestText.trimStart().startsWith('#EXTM3U')) {
          res.setHeader('Content-Type', upstream.headers['content-type'] || 'video/mp2t');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.send(buffer);
        }

        const baseObj = new URL(finalUrl);

        const rewritten = manifestText
          .split(/\r?\n/)
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;
            if (trimmed.startsWith('#')) {
              return line.replace(/URI="([^"]+)"/g, (_match, uriVal) => {
                try {
                  const absUri = new URL(uriVal, baseObj).toString();
                  return `URI="/api/stream?url=${encodeURIComponent(absUri)}"`;
                } catch {
                  return _match;
                }
              });
            }
            try {
              const absSegmentUrl = new URL(trimmed, baseObj).toString();
              return `/api/stream?url=${encodeURIComponent(absSegmentUrl)}`;
            } catch {
              return line;
            }
          })
          .join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(rewritten);
      });
      return;
    }

    // Stream binário contínuo (.ts, .mp4, .aac, etc.)
    // Se for uma stream contínua .ts ao vivo (e não um arquivo VOD/Série com Range ou segmento HLS),
    // encerra conexões órfãs de outros canais para respeitar max_connections do servidor IPTV
    const isHlsSegment = /\/hls\/|_\d+\.ts/i.test(finalUrl);
    const isVodOrSeriesFile = /\.(mp4|mkv|avi|mov|webm)(\?|$)/i.test(finalUrl) || /\/(movie|series)\//i.test(rawTargetUrl);
    if (!isHlsSegment && !isVodOrSeriesFile && activeUpstreamStreams.size >= 2) {
      for (const oldStream of activeUpstreamStreams) {
        try {
          oldStream.destroy();
        } catch {
          // ignore
        }
        activeUpstreamStreams.delete(oldStream);
      }
    }

    activeStreams++;
    if (!isVodOrSeriesFile) {
      activeUpstreamStreams.add(upstream);
    }

    if (upstream.statusCode) {
      res.status(upstream.statusCode);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (upstream.headers['content-type']) {
      res.setHeader('Content-Type', upstream.headers['content-type']);
    } else if (/\.mp4(\?|$)/i.test(finalUrl) || /\.mp4(\?|$)/i.test(rawTargetUrl)) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (/\.mkv(\?|$)/i.test(finalUrl) || /\.mkv(\?|$)/i.test(rawTargetUrl)) {
      res.setHeader('Content-Type', 'video/x-matroska');
    }
    if (upstream.headers['content-length'] && Number(upstream.headers['content-length']) > 0) {
      res.setHeader('Content-Length', upstream.headers['content-length']);
    }
    if (upstream.headers['content-range']) {
      res.setHeader('Content-Range', upstream.headers['content-range']);
    }
    if (upstream.headers['accept-ranges']) {
      res.setHeader('Accept-Ranges', upstream.headers['accept-ranges']);
    } else if (isVodOrSeriesFile) {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    upstream.on('data', (chunk) => {
      totalBytesTransferred += chunk.length;
    });

    let cleanedUp = false;
    const cleanup = () => {
      if (!cleanedUp) {
        cleanedUp = true;
        activeStreams = Math.max(0, activeStreams - 1);
        activeUpstreamStreams.delete(upstream);
        upstream.destroy();
      }
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
    upstream.on('end', cleanup);
    upstream.on('error', cleanup);

    // Se o usuário selecionou Áudio Original em Inglês (audioTrack=1) em um filme/série MP4 [Dual],
    // aplica o patch binário em tempo real no átomo moov para desativar a faixa 0 (Dublado) e ativar a faixa 1 (Inglês)!
    const isMp4Stream =
      /\.mp4(\?|$)/i.test(finalUrl) ||
      /\.mp4(\?|$)/i.test(rawTargetUrl) ||
      (upstream.headers['content-type'] || '').toLowerCase().includes('mp4');

    if (requestedAudioTrack > 0 && isMp4Stream) {
      upstream.pause();
      const sounTracks = await getMp4SounTrackOffsets(finalUrl);
      if (sounTracks.length >= 2) {
        const targetTrackIdx = Math.min(requestedAudioTrack, sounTracks.length - 1);
        let streamBytePos = 0;
        const contentRangeHeader = upstream.headers['content-range'];
        if (contentRangeHeader) {
          const rangeMatch = String(contentRangeHeader).match(/bytes\s+(\d+)-/i);
          if (rangeMatch) {
            streamBytePos = parseInt(rangeMatch[1], 10) || 0;
          }
        }

        const writeBytesAtGlobalOffset = (chunkBuf, chunkStart, globalPos, bytesToWrite) => {
          for (let b = 0; b < bytesToWrite.length; b++) {
            const pos = globalPos + b;
            if (pos >= chunkStart && pos < chunkStart + chunkBuf.length) {
              chunkBuf[pos - chunkStart] = bytesToWrite[b];
            }
          }
        };

        upstream.on('data', (chunk) => {
          const buf = Buffer.from(chunk);
          const chunkStart = streamBytePos;
          streamBytePos += buf.length;

          // Só precisa verificar se o chunk está nos primeiros 12MB onde fica o moov
          if (chunkStart < 12 * 1024 * 1024) {
            for (let idx = 0; idx < sounTracks.length; idx++) {
              const tr = sounTracks[idx];
              if (idx === targetTrackIdx) {
                // Ativa a faixa de áudio escolhida (Inglês Original): 'trak' + flags = 0x03
                writeBytesAtGlobalOffset(buf, chunkStart, tr.trakTypeOffset, [0x74, 0x72, 0x61, 0x6b]);
                writeBytesAtGlobalOffset(buf, chunkStart, tr.tkhdFlagsByteOffset, [0x03]);
              } else {
                // Oculta a outra faixa de áudio (Dublado) transformando 'trak' em 'free' e flags = 0x00
                writeBytesAtGlobalOffset(buf, chunkStart, tr.trakTypeOffset, [0x66, 0x72, 0x65, 0x65]);
                writeBytesAtGlobalOffset(buf, chunkStart, tr.tkhdFlagsByteOffset, [0x00]);
              }
            }
          }

          res.write(buf);
        });
        upstream.on('end', () => {
          res.end();
        });
        upstream.resume();
        return;
      }
      upstream.resume();
    }

    upstream.pipe(res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Erro ao transmitir buffer de stream',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`⚡ [NextPlay Engine] Micro-servidor Express ativo em http://127.0.0.1:${PORT}`);
});

