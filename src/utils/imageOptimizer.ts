/**
 * Otimizador Automático de Capas e Backdrops para Smart TV / Android TV
 * Reduz imagens gigantes do TMDB/IPTV (ex: /original/ ou /w600_and_h900/ de 500KB+)
 * para miniaturas leves na medida exata do card (w185 = ~12KB), cortando até 90% do uso de VRAM na TV.
 */
export function optimizePosterUrl(
  rawUrl?: string | null,
  targetSize: 'w185' | 'w300' | 'w780' = 'w185'
): string {
  if (!rawUrl) return '';
  const url = rawUrl.trim();
  if (!url) return '';

  // Otimiza links oficiais do TMDB (usados por 95% dos servidores Xtream Codes / IPTV)
  if (url.includes('image.tmdb.org/t/p/')) {
    return url.replace(
      /image\.tmdb\.org\/t\/p\/(original|w\d+|w\d+_and_h\d+_[a-z0-9]+)\//i,
      `image.tmdb.org/t/p/${targetSize}/`
    );
  }

  return url;
}
