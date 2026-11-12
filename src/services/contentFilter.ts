import { ChannelItem } from '../types/iptv';

// Padrões de detecção de conteúdo adulto / +18 / XXX
const ADULT_PATTERNS = [
  /adulto/i,
  /adultos/i,
  /\bxxx\b/i,
  /\+18\b/i,
  /\b18\+/i,
  /erotico/i,
  /erótico/i,
  /porn/i,
  /playboy/i,
  /venus/i,
  /sexy/i,
  /sexzone/i,
  /for man/i,
  /redlight/i,
  /privê/i,
  /prive/i,
  /hustler/i,
  /penthouse/i,
  /brazzers/i,
  /hentai/i,
  /red\s*hot/i,
  /x-rated/i,
  /nsfw/i,
  /hot\s*pack/i,
  /babes/i,
  /red\s*light/i,
  /man\s*pack/i,
];

/**
 * Detecta se um item (canal, filme ou série) pertence à categoria adulta (+18 / XXX)
 */
export function isAdultContent(item?: ChannelItem | null): boolean {
  if (!item) return false;
  const target = `${item.name || ''} ${item.group || ''} ${item.genre || ''}`.toLowerCase();
  return ADULT_PATTERNS.some((pattern) => pattern.test(target));
}

export const STORAGE_KEYS_PARENTAL = {
  PIN: 'nextplay_parental_pin_v1',
};

export const DEFAULT_PARENTAL_PIN = '0000';

/**
 * Obtém o PIN Parental salvo no dispositivo (ou '0000' por padrão)
 */
export function getParentalPin(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS_PARENTAL.PIN);
    if (saved && /^\d{4}$/.test(saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return DEFAULT_PARENTAL_PIN;
}

/**
 * Define e persiste um novo PIN Parental de 4 dígitos
 */
export function setParentalPin(newPin: string): boolean {
  if (!/^\d{4}$/.test(newPin)) return false;
  try {
    localStorage.setItem(STORAGE_KEYS_PARENTAL.PIN, newPin);
    return true;
  } catch {
    return false;
  }
}

