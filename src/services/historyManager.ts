import { ChannelItem, MediaType, WatchHistoryItem } from '../types/iptv';

/** Escopo de limpeza do histórico local "Continuar Assistindo" */
export type HistoryClearScope = 'live' | 'movie' | 'series' | 'all';

export interface HistoryCounts {
  live: number;
  movie: number;
  series: number;
  all: number;
}

/**
 * Conta os itens do histórico por tipo de mídia (Canais, Filmes, Séries e Total).
 */
export function countHistoryByType(history: WatchHistoryItem[]): HistoryCounts {
  const counts: HistoryCounts = { live: 0, movie: 0, series: 0, all: 0 };
  if (!Array.isArray(history)) return counts;

  for (const item of history) {
    const type: MediaType | undefined = item?.channel?.mediaType;
    if (type === 'live' || type === 'movie' || type === 'series') {
      counts[type] += 1;
    }
    counts.all += 1;
  }
  return counts;
}

/**
 * Retorna um NOVO array de histórico sem os itens do escopo escolhido (imutável).
 * - 'live'   → remove apenas Canais Ao Vivo
 * - 'movie'  → remove apenas Filmes
 * - 'series' → remove apenas Episódios de Séries
 * - 'all'    → limpa tudo
 */
export function clearHistoryByScope(
  history: WatchHistoryItem[],
  scope: HistoryClearScope
): WatchHistoryItem[] {
  if (!Array.isArray(history) || scope === 'all') return [];
  return history.filter((item) => item?.channel?.mediaType !== scope);
}

/**
 * Remove um único item do histórico pelo id do canal/filme/episódio.
 */
export function removeHistoryItem(
  history: WatchHistoryItem[],
  channelId: string
): WatchHistoryItem[] {
  if (!Array.isArray(history)) return [];
  return history.filter((item) => item?.channel?.id !== channelId);
}

export const HISTORY_SCOPE_LABELS: Record<HistoryClearScope, string> = {
  live: 'Canais',
  movie: 'Filmes',
  series: 'Séries',
  all: 'Tudo',
};

/**
 * Atualiza ou insere o progresso de reprodução de um item no histórico "Continuar Assistindo".
 * Se o usuário assistiu mais de 95% do vídeo, considera finalizado e reseta o progresso para 0.
 */
export function updateWatchProgress(
  history: WatchHistoryItem[],
  channel: ChannelItem,
  progressSeconds: number,
  durationSeconds: number
): WatchHistoryItem[] {
  if (!Array.isArray(history) || !channel?.id) return [];
  const safeDuration = Math.max(0, Math.floor(durationSeconds || 0));
  const safeProgress = Math.max(0, Math.floor(progressSeconds || 0));
  const isFinished = safeDuration > 0 && safeProgress >= safeDuration * 0.95;

  const filtered = history.filter((item) => item?.channel?.id !== channel.id);
  const updatedItem: WatchHistoryItem = {
    channel: channel as unknown as WatchHistoryItem['channel'],
    lastWatchedAt: Date.now(),
    progressSeconds: isFinished ? 0 : safeProgress,
    durationSeconds: safeDuration,
  };

  return [updatedItem, ...filtered].slice(0, 50);
}

/**
 * Formata segundos no padrão MM:SS ou HH:MM:SS para exibição em badges e labels.
 */
export function formatProgressTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}


