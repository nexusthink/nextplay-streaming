import { describe, it, expect, beforeEach } from 'vitest';
import {
  isAdultContent,
  getParentalPin,
  setParentalPin,
  DEFAULT_PARENTAL_PIN,
  STORAGE_KEYS_PARENTAL,
} from '../contentFilter';
import { ChannelItem } from '../../types/iptv';

// Mock localStorage para ambiente Node vitest
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: storageMock,
  writable: true,
});

describe('contentFilter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isAdultContent', () => {
    it('detects adult channel by group or name', () => {
      const adultChannel1: ChannelItem = {
        id: '1',
        name: 'Playboy TV HD',
        group: 'CANAIS ADULTOS',
        url: 'http://test/1',
        mediaType: 'live',
      };
      const adultChannel2: ChannelItem = {
        id: '2',
        name: 'Venus XXX',
        group: 'Variedades',
        url: 'http://test/2',
        mediaType: 'live',
      };
      const normalChannel: ChannelItem = {
        id: '3',
        name: 'Globo SP FHD',
        group: 'Abertos',
        url: 'http://test/3',
        mediaType: 'live',
      };

      expect(isAdultContent(adultChannel1)).toBe(true);
      expect(isAdultContent(adultChannel2)).toBe(true);
      expect(isAdultContent(normalChannel)).toBe(false);
    });

    it('detects adult terms like sexyhot, redhot, brazzers, hentai', () => {
      const sexy: ChannelItem = {
        id: '4',
        name: 'SexyHot 24H',
        group: 'TV',
        url: 'http://test/4',
        mediaType: 'live',
      };
      const anime: ChannelItem = {
        id: '5',
        name: 'Hentai Channel',
        group: 'Anime',
        url: 'http://test/5',
        mediaType: 'live',
      };
      expect(isAdultContent(sexy)).toBe(true);
      expect(isAdultContent(anime)).toBe(true);
    });
  });

  describe('Parental PIN management', () => {
    it('returns default 0000 when no PIN is set', () => {
      expect(getParentalPin()).toBe(DEFAULT_PARENTAL_PIN);
      expect(getParentalPin()).toBe('0000');
    });

    it('updates and persists valid 4-digit PIN', () => {
      const success = setParentalPin('1234');
      expect(success).toBe(true);
      expect(getParentalPin()).toBe('1234');
      expect(localStorage.getItem(STORAGE_KEYS_PARENTAL.PIN)).toBe('1234');
    });

    it('rejects invalid PINs that are not 4 numeric digits', () => {
      expect(setParentalPin('123')).toBe(false);
      expect(setParentalPin('12345')).toBe(false);
      expect(setParentalPin('abcd')).toBe(false);
      expect(getParentalPin()).toBe(DEFAULT_PARENTAL_PIN);
    });
  });
});
