import { describe, it, expect } from 'vitest';
import { WatchHistoryItem } from '../../types/iptv';
import {
  clearHistoryByScope,
  countHistoryByType,
  removeHistoryItem,
  updateWatchProgress,
  formatProgressTime,
} from '../historyManager';

const mk = (id: string, mediaType: 'live' | 'movie' | 'series'): WatchHistoryItem => ({
  channel: { id, name: id, group: 'G', url: `http://x/${id}`, mediaType },
  lastWatchedAt: Date.now(),
});

const sample: WatchHistoryItem[] = [
  mk('globo', 'live'),
  mk('hbo', 'live'),
  mk('duna', 'movie'),
  mk('got-s1e1', 'series'),
  mk('got-s1e2', 'series'),
];

describe('NextPlay History Manager', () => {
  it('counts history items per media type', () => {
    expect(countHistoryByType(sample)).toEqual({ live: 2, movie: 1, series: 2, all: 5 });
    expect(countHistoryByType([])).toEqual({ live: 0, movie: 0, series: 0, all: 0 });
  });

  it('clears only the selected scope without mutating the original array', () => {
    const noLive = clearHistoryByScope(sample, 'live');
    expect(noLive.map((h) => h.channel.id)).toEqual(['duna', 'got-s1e1', 'got-s1e2']);

    const noMovies = clearHistoryByScope(sample, 'movie');
    expect(noMovies).toHaveLength(4);
    expect(noMovies.some((h) => h.channel.mediaType === 'movie')).toBe(false);

    const noSeries = clearHistoryByScope(sample, 'series');
    expect(noSeries.map((h) => h.channel.id)).toEqual(['globo', 'hbo', 'duna']);

    expect(clearHistoryByScope(sample, 'all')).toEqual([]);
    expect(sample).toHaveLength(5); // imutável
  });

  it('removes a single item and tolerates invalid input', () => {
    expect(removeHistoryItem(sample, 'duna')).toHaveLength(4);
    expect(clearHistoryByScope(null as unknown as WatchHistoryItem[], 'live')).toEqual([]);
    expect(countHistoryByType(undefined as unknown as WatchHistoryItem[]).all).toBe(0);
  });

  it('updates watch progress and handles completion reset', () => {
    const movie = sample[2].channel; // duna
    const updated = updateWatchProgress(sample, movie, 1200, 7200);
    const item = updated.find((h) => h.channel.id === 'duna');
    expect(item?.progressSeconds).toBe(1200);
    expect(item?.durationSeconds).toBe(7200);

    // Assistiu 96% -> reseta para 0 (concluído)
    const finished = updateWatchProgress(sample, movie, 7000, 7200);
    const finItem = finished.find((h) => h.channel.id === 'duna');
    expect(finItem?.progressSeconds).toBe(0);
  });

  it('formats progress time correctly in MM:SS and HH:MM:SS', () => {
    expect(formatProgressTime(0)).toBe('00:00');
    expect(formatProgressTime(65)).toBe('01:05');
    expect(formatProgressTime(3665)).toBe('1:01:05');
    expect(formatProgressTime(-10)).toBe('00:00');
  });
});
