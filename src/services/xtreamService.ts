import {
  ChannelItem,
  SeriesDetails,
  SeriesEpisode,
  SeriesSeason,
  XtreamAccountInfo,
} from '../types/iptv';
import { generateSmartEpg } from './m3uParser';

export interface XtreamAuthResult {
  accountInfo: XtreamAccountInfo;
  channels: ChannelItem[];
}

export interface ExtractedXtreamCreds {
  serverUrl: string;
  username: string;
  password: string;
}

// Cache em memória dos detalhes de temporadas/episódios de séries para abertura em 0ms ao revisitar
const seriesDetailsCache = new Map<string, SeriesDetails>();

/**
 * Normaliza a URL do servidor IPTV Xtream Codes
 */
export function normalizeServerUrl(rawUrl: string): string {
  let cleaned = rawUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `http://${cleaned}`;
  }
  return cleaned;
}

/**
 * Detecta automaticamente se um link M3U colado pelo usuário é um shortlink (/p/user/pass/m3u)
 * ou um link get.php de servidor Xtream Codes, extraindo Servidor, Usuário e Senha!
 */
export function extractXtreamFromM3uUrl(rawUrl: string): ExtractedXtreamCreds | null {
  try {
    const normalized = normalizeServerUrl(rawUrl);
    const parsed = new URL(normalized);

    // Padrão 1: Shortlink QPanel / Sigma / Xtream (/p/{username}/{password}/m3u)
    const shortMatch = parsed.pathname.match(/^\/p\/([^/]+)\/([^/]+)(\/m3u.*)?$/i);
    if (shortMatch) {
      return {
        serverUrl: `${parsed.protocol}//${parsed.host}`,
        username: decodeURIComponent(shortMatch[1]),
        password: decodeURIComponent(shortMatch[2]),
      };
    }

    // Padrão 2: Link tradicional /get.php?username=...&password=...
    if (parsed.pathname.toLowerCase().endsWith('/get.php')) {
      const u = parsed.searchParams.get('username');
      const p = parsed.searchParams.get('password');
      if (u && p) {
        return {
          serverUrl: `${parsed.protocol}//${parsed.host}`,
          username: u,
          password: p,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Constrói a URL de reprodução de um stream Xtream Codes (Live, Movie/VOD ou Series)
 */
export function buildXtreamStreamUrl(
  serverUrl: string,
  username: string,
  password: string,
  streamId: number | string,
  type: 'live' | 'movie' | 'series',
  extension = 'm3u8'
): string {
  const base = normalizeServerUrl(serverUrl);
  const u = encodeURIComponent(username.trim());
  const p = encodeURIComponent(password.trim());

  if (type === 'live') {
    return `${base}/live/${u}/${p}/${streamId}.${extension}`;
  }
  if (type === 'movie') {
    return `${base}/movie/${u}/${p}/${streamId}.${extension}`;
  }
  return `${base}/series/${u}/${p}/${streamId}.${extension}`;
}

/**
 * Faz chamada à API Xtream Codes usando o micro-servidor Express local (evita CORS/Mixed Content
 * e cura subdomínios encurtadores inativos como e.dominio.xyz -> dominio.xyz)
 */
async function callXtreamApi(
  serverUrl: string,
  username: string,
  password: string,
  action?: string,
  extraParams?: Record<string, string | number>
): Promise<any> {
  const base = normalizeServerUrl(serverUrl);
  const proxyParams = new URLSearchParams({
    server: base,
    username: username.trim(),
    password: password.trim(),
  });
  if (action) proxyParams.set('action', action);
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      proxyParams.set(k, String(v));
    }
  }

  let proxyErrorMsg = '';
  try {
    const proxyRes = await fetch(`/api/xtream?${proxyParams.toString()}`);
    if (proxyRes.ok) {
      return await proxyRes.json();
    }
    const errJson = await proxyRes.json().catch(() => null);
    if (errJson?.error) {
      proxyErrorMsg = errJson.details ? `${errJson.error} (${errJson.details})` : errJson.error;
    }
  } catch {
    // Fallback para chamada direta (ex: Android Nativo sem servidor local)
  }

  try {
    const directUrl = new URL(`${base}/player_api.php`);
    directUrl.searchParams.set('username', username.trim());
    directUrl.searchParams.set('password', password.trim());
    if (action) directUrl.searchParams.set('action', action);
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        directUrl.searchParams.set(k, String(v));
      }
    }

    const directRes = await fetch(directUrl.toString());
    if (!directRes.ok) {
      throw new Error(`Servidor Xtream retornou status HTTP ${directRes.status}`);
    }
    return await directRes.json();
  } catch (err) {
    throw new Error(
      proxyErrorMsg ||
        (err instanceof Error ? err.message : 'Falha de conexão com o servidor IPTV.')
    );
  }
}

/**
 * Busca todas as temporadas e episódios reais de uma Série no servidor Xtream Codes (action=get_series_info)
 */
export async function fetchXtreamSeriesInfo(
  serverUrl: string,
  username: string,
  password: string,
  seriesId: number | string,
  fallbackName = 'Série'
): Promise<SeriesDetails> {
  const base = normalizeServerUrl(serverUrl);
  const cacheKey = `${base}|${username}|${seriesId}`;
  const cached = seriesDetailsCache.get(cacheKey);
  if (cached) return cached;

  const data = await callXtreamApi(base, username, password, 'get_series_info', {
    series_id: seriesId,
  });

  const info = data?.info || {};
  const episodesRaw = data?.episodes || {};
  const seasonsMap = new Map<number, SeriesEpisode[]>();

  const processEpisodeList = (seasonKey: string | number, epArray: any[]) => {
    if (!Array.isArray(epArray)) return;
    const parsedSeasonNum = Number(seasonKey) || 1;

    for (let idx = 0; idx < epArray.length; idx++) {
      const ep = epArray[idx];
      if (!ep) continue;
      const epId = String(ep.id || ep.stream_id || '');
      if (!epId) continue;

      const sNum = Number(ep.season || parsedSeasonNum || 1);
      const eNum = Number(ep.episode_num || idx + 1);
      const ext = String(ep.container_extension || 'mp4')
        .replace(/^\./, '')
        .toLowerCase();

      const epUrl = buildXtreamStreamUrl(base, username, password, epId, 'series', ext);
      const epTitle =
        ep.title ||
        ep.info?.name ||
        `${info.name || fallbackName} - T${String(sNum).padStart(2, '0')}E${String(eNum).padStart(2, '0')}`;

      const episodeItem: SeriesEpisode = {
        id: epId,
        episodeNum: eNum,
        seasonNumber: sNum,
        title: epTitle,
        url: epUrl,
        containerExtension: ext,
        duration: ep.info?.duration || undefined,
        plot: ep.info?.plot || info.plot || undefined,
        cover: ep.info?.movie_image || info.cover || undefined,
        rating: ep.info?.rating ? String(ep.info.rating) : undefined,
      };

      const list = seasonsMap.get(sNum) || [];
      list.push(episodeItem);
      seasonsMap.set(sNum, list);
    }
  };

  if (Array.isArray(episodesRaw)) {
    episodesRaw.forEach((arr, idx) => processEpisodeList(idx + 1, arr));
  } else if (episodesRaw && typeof episodesRaw === 'object') {
    for (const [seasonKey, epArray] of Object.entries(episodesRaw)) {
      processEpisodeList(seasonKey, epArray as any[]);
    }
  }

  const seasons: SeriesSeason[] = Array.from(seasonsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([seasonNumber, eps]) => ({
      seasonNumber,
      name: `Temporada ${seasonNumber}`,
      episodes: eps.sort((a, b) => a.episodeNum - b.episodeNum),
    }));

  const backdrop =
    Array.isArray(info.backdrop_path) && info.backdrop_path.length > 0
      ? info.backdrop_path[0]
      : typeof info.backdrop_path === 'string'
      ? info.backdrop_path
      : undefined;

  const details: SeriesDetails = {
    seriesId,
    name: info.name || fallbackName,
    cover: info.cover || undefined,
    backdropUrl: backdrop,
    plot: info.plot || undefined,
    cast: info.cast || undefined,
    genre: info.genre || undefined,
    rating: info.rating ? String(info.rating) : undefined,
    releaseDate: info.releaseDate || undefined,
    seasons,
  };

  seriesDetailsCache.set(cacheKey, details);
  return details;
}

/**
 * Autentica via Login/Senha Xtream Codes e carrega 100% dos Canais Ao Vivo, Filmes (VOD) e Séries
 */
export async function connectXtreamCodes(
  serverUrl: string,
  username: string,
  password: string,
  preferredLiveFormat: 'm3u8' | 'ts' = 'm3u8'
): Promise<XtreamAuthResult> {
  const initialBase = normalizeServerUrl(serverUrl);

  // 1. Valida credenciais e obtém dados da conta e o domínio canônico real do servidor
  const authData = await callXtreamApi(initialBase, username, password);
  if (!authData || !authData.user_info || Number(authData.user_info.auth) === 0) {
    throw new Error('Usuário ou senha inválidos no servidor IPTV.');
  }

  // Se o usuário digitou um subdomínio encurtador (ex: e.cinemaxhub.xyz), usa a URL real retornada por server_info
  let canonicalBase = initialBase;
  if (authData.server_info?.url) {
    const proto = authData.server_info.server_protocol || 'http';
    const host = String(authData.server_info.url).trim();
    const port = String(authData.server_info.port || '80').trim();
    const portSuffix =
      (proto === 'http' && port === '80') || (proto === 'https' && port === '443')
        ? ''
        : `:${port}`;
    canonicalBase = `${proto}://${host}${portSuffix}`;
  }

  const userInfo = authData.user_info;
  const accountInfo: XtreamAccountInfo = {
    username: userInfo.username || username,
    status: userInfo.status || 'Active',
    expDate: userInfo.exp_date
      ? new Date(Number(userInfo.exp_date) * 1000).toLocaleDateString('pt-BR')
      : 'Ilimitado',
    isTrial: String(userInfo.is_trial) === '1',
    activeCons: Number(userInfo.active_cons || 0),
    maxConnections: Number(userInfo.max_connections || 1),
    serverProtocol: authData.server_info?.server_protocol || 'http',
    serverUrl: canonicalBase,
  };

  // 2. Busca todas as categorias primeiro (3 requisições leves)
  const [liveCategoriesRaw, vodCategoriesRaw, seriesCategoriesRaw] = await Promise.all([
    callXtreamApi(canonicalBase, username, password, 'get_live_categories').catch(() => []),
    callXtreamApi(canonicalBase, username, password, 'get_vod_categories').catch(() => []),
    callXtreamApi(canonicalBase, username, password, 'get_series_categories').catch(() => []),
  ]);

  // Busca fluxos de forma resiliente e sequencial para evitar rejeição por limite de conexões simultâneas (max_connections)
  const fetchWithRetry = async (action: string) => {
    try {
      const res = await callXtreamApi(canonicalBase, username, password, action);
      if (Array.isArray(res)) return res;
      return [];
    } catch (err) {
      try {
        // Pausa de 800ms e segunda tentativa com resiliência
        await new Promise((r) => setTimeout(r, 800));
        const retryRes = await callXtreamApi(canonicalBase, username, password, action);
        if (Array.isArray(retryRes)) return retryRes;
      } catch (errRetry) {
        console.warn(`[Xtream] Não foi possível carregar ${action}:`, errRetry);
      }
      return [];
    }
  };

  const liveStreamsRaw = await fetchWithRetry('get_live_streams');
  const vodStreamsRaw = await fetchWithRetry('get_vod_streams');
  const seriesListRaw = await fetchWithRetry('get_series');

  const liveCatMap = new Map<string, string>();
  if (Array.isArray(liveCategoriesRaw)) {
    for (const c of liveCategoriesRaw) {
      liveCatMap.set(String(c.category_id), c.category_name || 'TV ao Vivo');
    }
  }

  const vodCatMap = new Map<string, string>();
  if (Array.isArray(vodCategoriesRaw)) {
    for (const c of vodCategoriesRaw) {
      vodCatMap.set(String(c.category_id), c.category_name || 'Filmes VOD');
    }
  }

  const seriesCatMap = new Map<string, string>();
  if (Array.isArray(seriesCategoriesRaw)) {
    for (const c of seriesCategoriesRaw) {
      seriesCatMap.set(String(c.category_id), c.category_name || 'Séries');
    }
  }

  const inlineAuth = {
    serverUrl: canonicalBase,
    username: username.trim(),
    password: password.trim(),
  };

  const channels: ChannelItem[] = [];

  // Processa 100% dos Canais Ao Vivo
  if (Array.isArray(liveStreamsRaw)) {
    for (const item of liveStreamsRaw) {
      const streamId = item.stream_id;
      if (!streamId) continue;
      const group = liveCatMap.get(String(item.category_id)) || 'TV ao Vivo';
      const name = item.name || `Canal #${streamId}`;
      const url = buildXtreamStreamUrl(
        canonicalBase,
        username,
        password,
        streamId,
        'live',
        preferredLiveFormat
      );
      const epg = generateSmartEpg(name, group);

      channels.push({
        id: `xt-live-${streamId}`,
        name,
        group,
        categoryId: String(item.category_id || ''),
        logo: item.stream_icon || undefined,
        url,
        mediaType: 'live',
        streamId,
        tvgId: item.epg_channel_id || undefined,
        containerExtension: preferredLiveFormat,
        xtreamAuth: inlineAuth,
        ...epg,
      });
    }
  }

  // Processa 100% dos Filmes (VOD)
  if (Array.isArray(vodStreamsRaw)) {
    for (const item of vodStreamsRaw) {
      const streamId = item.stream_id;
      if (!streamId) continue;
      const ext = item.container_extension || 'mp4';
      const group = vodCatMap.get(String(item.category_id)) || 'Filmes On-Demand';
      const name = item.name || `Filme #${streamId}`;
      const url = buildXtreamStreamUrl(canonicalBase, username, password, streamId, 'movie', ext);

      channels.push({
        id: `xt-vod-${streamId}`,
        name,
        group,
        categoryId: String(item.category_id || ''),
        logo: item.stream_icon || undefined,
        url,
        mediaType: 'movie',
        streamId,
        containerExtension: ext,
        rating: item.rating ? String(item.rating) : undefined,
        xtreamAuth: inlineAuth,
      });
    }
  }

  // Processa 100% das Séries (com metadados de capa, sinopse, nota, elenco e seriesId para buscar temporadas/episódios)
  if (Array.isArray(seriesListRaw)) {
    for (const item of seriesListRaw) {
      const seriesId = item.series_id;
      if (!seriesId) continue;
      const group = seriesCatMap.get(String(item.category_id)) || 'Séries';
      const name = item.name || `Série #${seriesId}`;
      const backdrop =
        Array.isArray(item.backdrop_path) && item.backdrop_path.length > 0
          ? item.backdrop_path[0]
          : typeof item.backdrop_path === 'string'
          ? item.backdrop_path
          : undefined;

      channels.push({
        id: `xt-series-${seriesId}`,
        name,
        seriesName: name,
        group,
        categoryId: String(item.category_id || ''),
        logo: item.cover || item.stream_icon || undefined,
        backdropUrl: backdrop,
        // URL inicial de referência; ao clicar na série, o NextPlay carrega as temporadas/episódios reais via get_series_info
        url: buildXtreamStreamUrl(canonicalBase, username, password, seriesId, 'series', 'mp4'),
        mediaType: 'series',
        seriesId,
        containerExtension: 'mp4',
        rating: item.rating ? String(item.rating) : undefined,
        plot: item.plot || undefined,
        cast: item.cast || undefined,
        genre: item.genre || undefined,
        year: item.releaseDate || undefined,
        xtreamAuth: inlineAuth,
      });
    }
  }

  return { accountInfo, channels };
}
