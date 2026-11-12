import { ChannelItem } from '../types/iptv';

export interface SubtitleCue {
  id: string;
  start: number; // segundos
  end: number;   // segundos
  text: string;
}

export interface AutoSubtitleResult {
  found: boolean;
  fileName?: string;
  cues: SubtitleCue[];
}

/**
 * Converte timestamp SRT/VTT (00:01:23,450 ou 01:23.450) para segundos
 */
export function parseTimestampToSeconds(raw: string): number {
  const cleaned = raw.trim().replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return m * 60 + s;
  }
  return 0;
}

/**
 * Faz o parse de legendas .SRT ou .VTT para exibição no Closed Caption do Player
 */
export function parseSrtOrVtt(content: string): SubtitleCue[] {
  if (!content || typeof content !== 'string') return [];

  const blocks = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n\n+/);

  const cues: SubtitleCue[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i]
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0 || lines[0].startsWith('WEBVTT')) continue;

    const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx];
    const [startRaw, endRawWithSettings] = timeLine.split('-->');
    if (!startRaw || !endRawWithSettings) continue;

    const endRaw = endRawWithSettings.trim().split(/\s+/)[0];
    const start = parseTimestampToSeconds(startRaw);
    const end = parseTimestampToSeconds(endRaw);

    const textLines = lines
      .slice(timeLineIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '') // Remove tags HTML como <i>, <b>, <font>
      .trim();

    if (textLines && end > start) {
      cues.push({
        id: `cue-${i}-${start}`,
        start,
        end,
        text: textLines,
      });
    }
  }

  return cues;
}

/**
 * Busca e baixa automaticamente a legenda sincronizada online (Português-BR / Inglês)
 * sem que o usuário precise carregar nenhum arquivo manualmente!
 */
export async function fetchAutomaticOnlineSubtitles(
  title: string,
  season?: number,
  episode?: number,
  lang: 'pob' | 'eng' = 'pob'
): Promise<AutoSubtitleResult> {
  if (!title) return { found: false, cues: [] };

  try {
    const params = new URLSearchParams({
      title,
      lang,
    });
    if (season && Number.isFinite(season)) params.set('season', String(season));
    if (episode && Number.isFinite(episode)) params.set('episode', String(episode));

    const res = await fetch(`/api/subtitles?${params.toString()}`);
    if (!res.ok) return { found: false, cues: [] };

    const data = await res.json();
    if (!data?.found || !data?.srt) {
      return { found: false, cues: [] };
    }

    const cues = parseSrtOrVtt(data.srt);
    return {
      found: cues.length > 0,
      fileName: data.fileName,
      cues,
    };
  } catch {
    return { found: false, cues: [] };
  }
}

/**
 * Traduz em tempo real uma frase de Closed Caption (EN -> PT-BR ou PT -> EN)
 */
export async function translateLiveCaption(
  text: string,
  from: 'pt' | 'en',
  to: 'pt-BR' | 'en'
): Promise<string> {
  const cleaned = text.trim();
  if (!cleaned) return '';
  try {
    const params = new URLSearchParams({ text: cleaned, from, to });
    const res = await fetch(`/api/translate?${params.toString()}`);
    if (!res.ok) return cleaned;
    const data = await res.json();
    return data?.translatedText || cleaned;
  } catch {
    return cleaned;
  }
}

/**
 * Identifica se o item atual do catálogo é uma versão em Inglês / Legendada
 * ([Leg], Legendados, Legendadas, Subtitled, ou Canais Ao Vivo US: / Estados Unidos)
 */
export function isLegendadoItem(channel: ChannelItem | null): boolean {
  if (!channel) return false;
  if (channel.mediaType === 'live') {
    return /^us:\s*/i.test(channel.name.trim()) || /estados unidos/i.test(channel.group);
  }
  const target = `${channel.name} ${channel.group}`;
  return /(\[leg\]|\(leg\)|legendad[oa]s?|\bleg\b|\bsubtitled\b)/i.test(target);
}

/**
 * Normaliza o título de um filme/série/canal removendo marcadores de idioma e qualidade
 * Ex: "Street Fighter (2026) [Leg] [Webrip]" -> "street fighter (2026)"
 * Ex: "US: HBO Family" ou "HBO Family FHD" -> "hbo family"
 */
export function normalizeBaseTitle(rawName: string, isLive = false): string {
  if (isLive) {
    return rawName
      .toLowerCase()
      .replace(/^us:\s*/i, '')
      .replace(/\b(fhd|hd|sd|4k|uhd|h265|brasil|east|west)\b/gi, '')
      .replace(/\b(plus|\+|signature|mundi|pop|xtreme)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return rawName
    .toLowerCase()
    .replace(/\[(leg|legendado|legendada|dub|dublado|dual|webrip|cam|hd|fhd|4k|uhd|h265)\]/gi, '')
    .replace(/\((leg|legendado|legendada|dub|dublado|dual)\)/gi, '')
    .replace(/\b(legendados?|legendadas?|dublados?|dubladas?|dual)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Procura automaticamente no catálogo a versão alternativa bilateral:
 * - Se está em Dublado (BR), encontra a versão em Inglês/Legendada ([Leg] / Legendados / US:)
 * - Se está em Inglês/Legendado ([Leg] / US:), encontra a versão Dublada (BR) de volta ("e o inverso também"!)
 */
export function findAlternateAudioVariant(
  current: ChannelItem | null,
  catalog: ChannelItem[]
): ChannelItem | null {
  if (!current || catalog.length === 0) return null;

  const isLive = current.mediaType === 'live';
  const currentIsLeg = isLegendadoItem(current);

  if (isLive) {
    // Primeiro tenta match exato sem sufixos FHD/HD/US:
    const exactLiveBase = current.name
      .toLowerCase()
      .replace(/^us:\s*/i, '')
      .replace(/\b(fhd|hd|sd|4k|uhd|h265|brasil|east|west)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const familyLiveBase = normalizeBaseTitle(current.name, true);

    let bestMatch: ChannelItem | null = null;

    for (let i = 0; i < catalog.length; i++) {
      const candidate = catalog[i];
      if (candidate.id === current.id || candidate.mediaType !== 'live') continue;
      if (isLegendadoItem(candidate) === currentIsLeg) continue;

      const candExact = candidate.name
        .toLowerCase()
        .replace(/^us:\s*/i, '')
        .replace(/\b(fhd|hd|sd|4k|uhd|h265|brasil|east|west)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (candExact === exactLiveBase) {
        // Prioriza FHD quando voltando para Dublado BR
        if (!currentIsLeg || /fhd/i.test(candidate.name)) {
          return candidate;
        }
        bestMatch = candidate;
      } else if (!bestMatch && normalizeBaseTitle(candidate.name, true) === familyLiveBase) {
        bestMatch = candidate;
      }
    }
    return bestMatch;
  }

  const currentBase = normalizeBaseTitle(current.seriesName || current.name, false);
  if (!currentBase || currentBase.length < 2) return null;

  for (let i = 0; i < catalog.length; i++) {
    const candidate = catalog[i];
    if (candidate.id === current.id) continue;
    if (candidate.mediaType !== current.mediaType) continue;

    const candidateIsLeg = isLegendadoItem(candidate);
    if (candidateIsLeg === currentIsLeg) continue;

    const candidateBase = normalizeBaseTitle(candidate.seriesName || candidate.name, false);
    if (candidateBase === currentBase) {
      return candidate;
    }
  }

  return null;
}

export interface LiveCea608Cue {
  id: string;
  startTime: number;
  endTime: number;
  rawText: string;
  ptText?: string;
  enText?: string;
  spoken?: boolean;
}

export interface Cea608DecoderState {
  text: string;
  lastA: number;
  lastB: number;
  startPts: number;
}

const SPECIAL_CEA608_CHARS: Record<number, number> = {
  0x2a: 0xe1, 0x5c: 0xe9, 0x5e: 0xed, 0x5f: 0xf3, 0x60: 0xfa,
  0x7b: 0xe7, 0x7c: 0xf7, 0x7d: 0xd1, 0x7e: 0xf1, 0x7f: 0x2588,
  0x80: 0xae, 0x81: 0xb0, 0x82: 0xbd, 0x83: 0xbf, 0x84: 0x2122,
  0x85: 0xa2, 0x86: 0xa3, 0x87: 0x266a, 0x88: 0xe0, 0x89: 0x20,
  0x8a: 0xe8, 0x8b: 0xe2, 0x8c: 0xea, 0x8d: 0xee, 0x8e: 0xf4, 0x8f: 0xfb,
  0x90: 0xc1, 0x91: 0xc9, 0x92: 0xd3, 0x93: 0xda, 0x94: 0xdc, 0x95: 0xfc,
  0x96: 0x2018, 0x97: 0xa1, 0x98: 0x2a, 0x99: 0x2019, 0x9a: 0x2501,
  0x9b: 0xa9, 0x9c: 0x2120, 0x9d: 0x2022, 0x9e: 0x201c, 0x9f: 0x201d,
  0xa0: 0xc0, 0xa1: 0xc2, 0xa2: 0xc7, 0xa3: 0xc8, 0xa4: 0xca, 0xa5: 0xcb,
  0xa6: 0xeb, 0xa7: 0xce, 0xa8: 0xcf, 0xa9: 0xef, 0xaa: 0xd4, 0xab: 0xd9,
  0xac: 0xf9, 0xad: 0xdb, 0xae: 0xab, 0xaf: 0xbb,
  0xb0: 0xc3, 0xb1: 0xe3, 0xb2: 0xcd, 0xb3: 0xcc, 0xb4: 0xec, 0xb5: 0xd2,
  0xb6: 0xf2, 0xb7: 0xd5, 0xb8: 0xf5, 0xb9: 0x7b, 0xba: 0x7d, 0xbb: 0x5c,
  0xbc: 0x5e, 0xbd: 0x5f, 0xbe: 0x7c, 0xbf: 0x223c, 0xc0: 0xc4, 0xc1: 0xe4,
  0xc2: 0xd6, 0xc3: 0xf6, 0xc4: 0xdf, 0xc5: 0xa5, 0xc6: 0xa4, 0xc7: 0x2503,
  0xc8: 0xc5, 0xc9: 0xe5, 0xca: 0xd8, 0xcb: 0xf8, 0xcc: 0x250f, 0xcd: 0x2513,
  0xce: 0x2517, 0xcf: 0x251b,
};

function getCea608Char(byte: number): string {
  return String.fromCharCode(SPECIAL_CEA608_CHARS[byte] || byte);
}

/**
 * Decodifica pacotes binários CEA-608 (ATSC GA94) diretamente de Hls.Events.FRAG_PARSING_USERDATA
 * com suporte completo à acentuação em Português-BR (Globo, Telecine, HBO, etc.) e Inglês.
 */
export function decodeCea608Samples(
  samples: Array<{ pts: number; bytes?: Uint8Array }>,
  state: Cea608DecoderState,
  fragStart?: number
): LiveCea608Cue[] {
  if (!Array.isArray(samples) || samples.length === 0) return [];

  const sorted = [...samples].sort((a, b) => a.pts - b.pts);
  const firstPts = sorted[0].pts;
  const needsNormalization =
    typeof fragStart === 'number' && Math.abs(firstPts - fragStart) > 45;

  const cues: LiveCea608Cue[] = [];

  for (let sIdx = 0; sIdx < sorted.length; sIdx++) {
    const sample = sorted[sIdx];
    const bytes = sample.bytes;
    if (!bytes || bytes.length < 3) continue;

    const normalizedPts = needsNormalization
      ? (fragStart as number) + Math.max(0, sample.pts - firstPts)
      : sample.pts;

    const count = bytes[0] & 0x1f;
    let pos = 2;

    for (let k = 0; k < count && pos + 2 < bytes.length; k++) {
      const tmp = bytes[pos++];
      const b1 = bytes[pos++] & 0x7f;
      const b2 = bytes[pos++] & 0x7f;

      const ccValid = (tmp & 0x04) !== 0;
      const ccType = tmp & 0x03;
      if (!ccValid || ccType !== 0) continue;
      if (b1 === 0 && b2 === 0) continue;

      const isCtrl = b1 >= 0x10 && b1 <= 0x1f;
      if (isCtrl) {
        if (b1 === state.lastA && b2 === state.lastB) {
          state.lastA = -1;
          state.lastB = -1;
          continue;
        }
        state.lastA = b1;
        state.lastB = b2;

        // Extended character sets (acentos PT-BR / ES / FR)
        if ((b1 === 0x11 || b1 === 0x19) && b2 >= 0x30 && b2 <= 0x3f) {
          if (state.text.length > 0) state.text = state.text.slice(0, -1);
          state.text += getCea608Char(b2 + 0x50);
        } else if ((b1 === 0x12 || b1 === 0x1a) && b2 >= 0x20 && b2 <= 0x3f) {
          if (state.text.length > 0) state.text = state.text.slice(0, -1);
          state.text += getCea608Char(b2 + 0x70);
        } else if ((b1 === 0x13 || b1 === 0x1b) && b2 >= 0x20 && b2 <= 0x3f) {
          if (state.text.length > 0) state.text = state.text.slice(0, -1);
          state.text += getCea608Char(b2 + 0x90);
        } else if ((b1 === 0x14 || b1 === 0x1c) && (b2 === 0x2f || b2 === 0x2d)) {
          // EOC (0x2f - Pop-On Display) ou CR (0x2d - Roll-Up Carriage Return)
          const cleaned = state.text.replace(/\s+/g, ' ').trim();
          if (cleaned.length >= 2) {
            cues.push({
              id: `cea-${normalizedPts.toFixed(2)}-${cues.length}`,
              startTime: normalizedPts,
              endTime: normalizedPts + 3.8,
              rawText: cleaned,
            });
          }
          state.text = '';
          state.startPts = -1;
        } else if ((b1 === 0x14 || b1 === 0x1c) && b2 === 0x2e) {
          // ENM - Erase Non-Displayed Memory
          state.text = '';
          state.startPts = -1;
        } else if ((b1 === 0x14 || b1 === 0x1c) && b2 === 0x21) {
          // Backspace
          if (state.text.length > 0) state.text = state.text.slice(0, -1);
        } else if (b1 >= 0x11 && b1 <= 0x17 && b2 >= 0x40 && b2 <= 0x7f) {
          // PAC (Preamble Address Code - quebra de linha)
          if (state.text && !state.text.endsWith(' ')) state.text += ' ';
        }
      } else {
        state.lastA = -1;
        state.lastB = -1;
        if (!state.text && state.startPts < 0) {
          state.startPts = normalizedPts;
        }
        if (b1 >= 0x20) state.text += getCea608Char(b1);
        if (b2 >= 0x20) state.text += getCea608Char(b2);
      }
    }
  }

  // Fallback para canais em modo Roll-Up contínuo que terminam o segmento de 4s sem enviar EOC
  const trailing = state.text.replace(/\s+/g, ' ').trim();
  if (cues.length === 0 && trailing.length >= 6) {
    const lastSample = sorted[sorted.length - 1];
    const lastPts = needsNormalization
      ? (fragStart as number) + Math.max(0, lastSample.pts - firstPts)
      : lastSample.pts;
    cues.push({
      id: `cea-flush-${lastPts.toFixed(2)}`,
      startTime: state.startPts > 0 ? state.startPts : lastPts,
      endTime: lastPts + 3.8,
      rawText: trailing,
    });
    state.text = '';
    state.startPts = -1;
  }

  return cues;
}

export function getNeuralTtsAudioUrl(text: string, lang: 'en' | 'pt-BR' = 'en'): string {
  const cleaned = text
    .replace(/^>>\s*/, '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/♪[^♪]*♪?/g, '')
    .trim();
  if (!cleaned) return '';
  return `/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(cleaned)}`;
}
