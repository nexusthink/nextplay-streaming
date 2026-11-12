import { ChannelItem, MediaType } from '../types/iptv';

/**
 * Extrai um atributo específico de uma linha #EXTINF (ex: tvg-logo="...", group-title="...")
 * Implementado com busca de índice rápida para suportar listas com +50.000 canais sem engasgos.
 */
function extractAttribute(infoLine: string, attrName: string): string {
  const lower = infoLine.toLowerCase();
  const target = `${attrName.toLowerCase()}="`;
  const startIdx = lower.indexOf(target);
  if (startIdx === -1) return '';
  const valueStart = startIdx + target.length;
  const endIdx = infoLine.indexOf('"', valueStart);
  if (endIdx === -1) return '';
  return infoLine.slice(valueStart, endIdx).trim();
}

/**
 * Detecta se um item da lista M3U é Canal Ao Vivo, Filme (VOD) ou Série
 * com suporte completo a listas brasileiras e internacionais (NetFlix, Prime, HBO, 1x01, S01E01, etc.)
 */
export function inferMediaType(
  url: string,
  group: string,
  title: string,
  explicitType?: string
): MediaType {
  const normType = (explicitType || '').toLowerCase().trim();
  if (normType === 'movie' || normType === 'vod') return 'movie';
  if (normType === 'series' || normType === 'tvshow' || normType === 'tvshows') return 'series';
  if (normType === 'live') return 'live';

  const lowerUrl = url.toLowerCase();
  const lowerGroup = group.toLowerCase();
  const lowerTitle = title.toLowerCase();

  // 1. Verificação explícita de Série por URL, Grupo ou Título
  const isSeriesUrl =
    lowerUrl.includes('/series/') ||
    lowerUrl.includes('/serie/') ||
    lowerUrl.includes('/tvshow/') ||
    lowerUrl.includes('/shows/') ||
    lowerUrl.includes('/episodes/');

  const isSeriesGroup =
    lowerGroup.includes('série') ||
    lowerGroup.includes('serie') ||
    lowerGroup.includes('series') ||
    lowerGroup.includes('seriado') ||
    lowerGroup.includes('novela') ||
    lowerGroup.includes('dorama') ||
    lowerGroup.includes('anime') ||
    lowerGroup.includes('temporada') ||
    lowerGroup.includes('season') ||
    lowerGroup.includes('episodio') ||
    lowerGroup.includes('episódio') ||
    lowerGroup.includes('desenho') ||
    lowerGroup.includes('minissérie') ||
    lowerGroup.includes('minisserie') ||
    lowerGroup.includes('turcas') ||
    lowerGroup.includes('coreanas') ||
    lowerGroup.includes('k-drama');

  const isSeriesTitle =
    /\bs\d{1,2}\s*e\d{1,3}\b/i.test(lowerTitle) ||
    /\b\d{1,2}x\d{1,3}\b/i.test(lowerTitle) ||
    /\bt\d{1,2}\s*e\d{1,3}\b/i.test(lowerTitle) ||
    /\b(temporada|temp)\s*\d+/i.test(lowerTitle) ||
    /\b(episódio|episodio|ep|capítulo|capitulo|cap)\s*\d+/i.test(lowerTitle);

  if (isSeriesUrl || isSeriesGroup || isSeriesTitle) {
    return 'series';
  }

  // 2. Verificação explícita de Filme (VOD) por URL, Extensão, Grupo ou Título
  const isMovieUrl =
    lowerUrl.includes('/movie/') ||
    lowerUrl.includes('/movies/') ||
    lowerUrl.includes('/vod/') ||
    lowerUrl.includes('/filme/') ||
    lowerUrl.includes('/filmes/') ||
    /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v)(\?|$)/i.test(lowerUrl);

  const isMovieGroup =
    lowerGroup.includes('filme') ||
    lowerGroup.includes('filmes') ||
    lowerGroup.includes('movie') ||
    lowerGroup.includes('movies') ||
    lowerGroup.includes('vod') ||
    lowerGroup.includes('cinema') ||
    lowerGroup.includes('cine') ||
    lowerGroup.includes('lançamento') ||
    lowerGroup.includes('lancamento') ||
    lowerGroup.includes('lançamentos') ||
    lowerGroup.includes('lancamentos') ||
    lowerGroup.includes('4k') ||
    lowerGroup.includes('uhd') ||
    lowerGroup.includes('telecine') ||
    lowerGroup.includes('netflix') ||
    lowerGroup.includes('amazon prime') ||
    lowerGroup.includes('prime video') ||
    lowerGroup.includes('disney') ||
    lowerGroup.includes('paramount') ||
    lowerGroup.includes('apple tv') ||
    lowerGroup.includes('globoplay') ||
    lowerGroup.includes('star+') ||
    lowerGroup.includes('max') ||
    lowerGroup.includes('warner') ||
    lowerGroup.includes('hbo') ||
    lowerGroup.includes('ação') ||
    lowerGroup.includes('acao') ||
    lowerGroup.includes('comédia') ||
    lowerGroup.includes('comedia') ||
    lowerGroup.includes('drama') ||
    lowerGroup.includes('terror') ||
    lowerGroup.includes('suspense') ||
    lowerGroup.includes('romance') ||
    lowerGroup.includes('ficção') ||
    lowerGroup.includes('ficcao') ||
    lowerGroup.includes('aventura') ||
    lowerGroup.includes('faroeste') ||
    lowerGroup.includes('policial') ||
    lowerGroup.includes('animação') ||
    lowerGroup.includes('animacao') ||
    lowerGroup.includes('documentário') ||
    lowerGroup.includes('documentario') ||
    lowerGroup.includes('shows') ||
    lowerGroup.includes('stand up');

  const isMovieTitle =
    /\b(19\d\d|20\d\d)\b/.test(lowerTitle) ||
    /\[(leg|dub|dual|4k|fhd|uhd|bluray|webrip)\]/i.test(lowerTitle) ||
    /\((dublado|legendado|dual)\)/i.test(lowerTitle);

  if (
    isMovieUrl ||
    isMovieGroup ||
    (isMovieTitle && !lowerGroup.includes('ao vivo') && !lowerGroup.includes('live'))
  ) {
    return 'movie';
  }

  return 'live';
}

/**
 * Gera programação EPG dinâmica inteligente caso o canal não tenha XMLTV externo acoplado
 */
export function generateSmartEpg(channelName: string, group: string) {
  const now = new Date();
  const currentHour = now.getHours();
  const nextHour = (currentHour + 1) % 24;
  const afterHour = (currentHour + 2) % 24;
  const progress = Math.min(98, Math.max(4, Math.round((now.getMinutes() / 60) * 100)));

  const pad = (n: number) => String(n).padStart(2, '0');

  return {
    epgCurrent: {
      id: `epg-cur-${channelName}`,
      title: `${channelName} — Transmissão Principal`,
      description: `Exibindo programação ao vivo na categoria ${group} com áudio digital e aceleração de hardware ativa.`,
      start: `${pad(currentHour)}:00`,
      end: `${pad(nextHour)}:00`,
      progress,
    },
    epgNext: {
      id: `epg-nxt-${channelName}`,
      title: `Especial ${group}: Destaque da Grade`,
      description: `A seguir na programação de ${channelName}.`,
      start: `${pad(nextHour)}:00`,
      end: `${pad(afterHour)}:00`,
      progress: 0,
    },
  };
}

/**
 * Parser M3U / M3U8 de alta performance (O(N) linear, zero vazamento de memória)
 */
export function parseM3UContent(rawText: string): ChannelItem[] {
  if (!rawText || typeof rawText !== 'string') return [];

  const lines = rawText.split(/\r?\n/);
  const channels: ChannelItem[] = [];

  let currentInfoLine = '';
  let currentGroupFromExtGrp = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      currentInfoLine = line;
      continue;
    }

    if (line.startsWith('#EXTGRP:')) {
      currentGroupFromExtGrp = line.slice(8).trim();
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    // Linha de URL do stream (http://, https://, rtmp://, rtsp://)
    if (
      line.startsWith('http://') ||
      line.startsWith('https://') ||
      line.startsWith('rtmp://') ||
      line.startsWith('mms://')
    ) {
      const url = line;
      let name = `Canal ${channels.length + 1}`;
      let group = currentGroupFromExtGrp || 'Canais Gerais';
      let logo = '';
      let tvgId = '';
      let explicitType = '';

      if (currentInfoLine) {
        const commaIdx = currentInfoLine.lastIndexOf(',');
        if (commaIdx !== -1 && commaIdx < currentInfoLine.length - 1) {
          name = currentInfoLine.slice(commaIdx + 1).trim();
        }

        const attrName = extractAttribute(currentInfoLine, 'tvg-name');
        if (!name && attrName) name = attrName;

        const attrGroup = extractAttribute(currentInfoLine, 'group-title');
        if (attrGroup) group = attrGroup;

        logo =
          extractAttribute(currentInfoLine, 'tvg-logo') ||
          extractAttribute(currentInfoLine, 'logo') ||
          '';

        tvgId = extractAttribute(currentInfoLine, 'tvg-id') || '';
        explicitType =
          extractAttribute(currentInfoLine, 'tvg-type') ||
          extractAttribute(currentInfoLine, 'type') ||
          '';
      }

      const mediaType = inferMediaType(url, group, name, explicitType);
      const epg = mediaType === 'live' ? generateSmartEpg(name, group) : {};

      let seriesName: string | undefined;
      let seasonNumber: number | undefined;
      let episodeNumber: number | undefined;

      if (mediaType === 'series') {
        // Suporta formatos: S01E02, T01E02, 1x02, Temp 1 Ep 2, Capitulo 05
        const epMatch =
          name.match(/^(.*?)\s*[-–:]?\s*[ST](\d{1,2})\s*E(\d{1,3})/i) ||
          name.match(/^(.*?)\s*[-–:]?\s*(\d{1,2})x(\d{1,3})/i) ||
          name.match(/^(.*?)\s*[-–:]?\s*(?:temp|temporada)\s*(\d{1,2}).*?(?:ep|episodio|episódio|cap)\s*(\d{1,3})/i);

        if (epMatch) {
          seriesName = epMatch[1].trim() || name;
          seasonNumber = Number(epMatch[2]);
          episodeNumber = Number(epMatch[3]);
        } else {
          seriesName = name;
        }
      }

      channels.push({
        id: `m3u-${channels.length}-${tvgId || name.slice(0, 12).replace(/\s+/g, '_')}`,
        name,
        group: group || 'Sem Categoria',
        logo: logo || undefined,
        url,
        mediaType,
        tvgId: tvgId || undefined,
        seriesName,
        seasonNumber,
        episodeNumber,
        ...epg,
      });

      currentInfoLine = '';
      currentGroupFromExtGrp = '';
    }
  }

  return channels;
}

