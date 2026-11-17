import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Heart,
  Star,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Film,
  Layers,
} from 'lucide-react';
import { ChannelItem } from '../types/iptv';
import { optimizePosterUrl } from '../utils/imageOptimizer';

interface StreamingHeroBannerProps {
  items?: ChannelItem[];
  channel?: ChannelItem | null;
  favorites?: Set<string>;
  isFavorite?: boolean;
  onPlay: (channel: ChannelItem) => void;
  onToggleFavorite: (channelId: string) => void;
}

// Higieniza nomes poluídos de IPTV (ex: "BR | GLOBO SP FHD H265 [VIP]" -> "Globo SP")
const cleanTitle = (rawName: string) => {
  if (!rawName) return '';
  return rawName
    .replace(/^(BR|US|PT|EN|ES)\s*[:||\-]\s*/i, '')
    .replace(/\[(FHD|4K|HD|SD|VIP|H265|HEVC|LEG|DUB)\]/gi, '')
    .replace(/\s+(FHD|4K|HD|SD|H265|HEVC|1080P|720P)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

export const StreamingHeroBanner: React.FC<StreamingHeroBannerProps> = ({
  items,
  channel,
  favorites,
  isFavorite = false,
  onPlay,
  onToggleFavorite,
}) => {
  const bannerItems = React.useMemo(() => {
    if (items && items.length > 0) return items;
    if (channel) return [channel];
    return [];
  }, [items, channel]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Reseta o índice caso a lista mude de tamanho drasticamente
  useEffect(() => {
    if (currentIndex >= bannerItems.length) {
      setCurrentIndex(0);
    }
  }, [bannerItems.length, currentIndex]);

  const handleNext = useCallback(() => {
    if (bannerItems.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % bannerItems.length);
  }, [bannerItems.length]);

  const handlePrev = useCallback(() => {
    if (bannerItems.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + bannerItems.length) % bannerItems.length);
  }, [bannerItems.length]);

  // Rolo Automático de Destaques: gira a cada 6 segundos quando não está pausado
  useEffect(() => {
    if (bannerItems.length <= 1 || isPaused) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerItems.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [bannerItems.length, isPaused]);

  const activeItem = bannerItems[currentIndex] || bannerItems[0];
  if (!activeItem) return null;

  const bgImage = optimizePosterUrl(activeItem.backdropUrl || activeItem.logo, 'w780');
  const displayName = cleanTitle(activeItem.name) || activeItem.name;
  const currentIsFavorite = favorites ? favorites.has(activeItem.id) : isFavorite;
  const isSeries = activeItem.mediaType === 'series';

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      className="relative w-full h-[220px] sm:h-[260px] md:h-[300px] lg:h-[330px] rounded-2xl overflow-hidden shadow-xl mb-4 border border-slate-800/70 group select-none bg-black"
    >
      {/* Imagem de Fundo / Backdrop do Destaque Atual */}
      {bgImage ? (
        <img
          key={activeItem.id}
          src={bgImage}
          alt={activeItem.name}
          className="w-full h-full object-cover object-center filter brightness-90 bg-black"
        />
      ) : (
        <div className="w-full h-full bg-black" />
      )}

      {/* Gradientes Múltiplos Estilo Netflix sobre Fundo Preto */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent w-full md:w-3/4" />
      <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/80 to-transparent" />

      {/* Setas Laterais do Rolo de Destaques (Esquerda / Direita) */}
      {bannerItems.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            title="Destaque Anterior"
            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 border border-white/15 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleNext}
            title="Próximo Destaque"
            className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 border border-white/15 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Conteúdo Principal do Destaque */}
      <div className="absolute inset-0 p-4 sm:p-6 md:p-8 flex flex-col justify-end max-w-xl z-10">
        {/* Badges de Categoria & Especificações Técnicas Limpas */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase flex items-center gap-1 shadow-md ${
              isSeries
                ? 'bg-emerald-400 text-slate-950'
                : 'bg-cyan-400 text-slate-950'
            }`}
          >
            {isSeries ? (
              <>
                <Layers className="w-3 h-3" />
                SÉRIE EM DESTAQUE
              </>
            ) : (
              <>
                <Film className="w-3 h-3" />
                FILME EM DESTAQUE
              </>
            )}
          </span>

          {bannerItems.length > 1 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/60 text-slate-300 border border-white/15">
              {currentIndex + 1} / {bannerItems.length}
            </span>
          )}

          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/10 text-slate-200 border border-white/10">
            {activeItem.group || 'Destaque'}
          </span>

          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-cyan-300 border border-cyan-400/30">
            4K ULTRA HD
          </span>

          {activeItem.rating && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-400/40">
              <Star className="w-3 h-3 fill-amber-400" />
              {activeItem.rating}
            </span>
          )}
        </div>

        {/* Título Principal */}
        <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] tracking-tight mb-2 line-clamp-1">
          {displayName}
        </h1>

        {/* Sinopse / Prólogo */}
        <p className="text-xs sm:text-sm text-slate-300/90 line-clamp-2 mb-4 leading-relaxed font-medium drop-shadow-md max-w-lg">
          {activeItem.plot ||
            (activeItem.epgCurrent
              ? `Agora transmitindo: ${activeItem.epgCurrent.title} (${activeItem.epgCurrent.start} - ${activeItem.epgCurrent.end})`
              : isSeries
              ? 'Assista a todas as temporadas e episódios desta série em alta definição com reprodução instantânea.'
              : 'Aproveite a melhor transmissão em ultra definição com som cinematográfico, cores vívidas e abertura imediata em tela cheia.')}
        </p>

        {/* Botões de Ação (Assistir Agora + Minha Lista) */}
        <div className="flex items-center gap-2.5" data-tv-row="true">
          <button
            type="button"
            data-tv-card="true"
            data-tv-row-idx="0"
            data-tv-col-idx="0"
            onClick={() => onPlay(activeItem)}
            className="flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl bg-white hover:bg-slate-200 focus:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Assistir Agora</span>
          </button>

          <button
            type="button"
            data-tv-card="true"
            data-tv-row-idx="0"
            data-tv-col-idx="1"
            onClick={() => onToggleFavorite(activeItem.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold cursor-pointer ${
              currentIsFavorite
                ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 hover:bg-rose-500/30'
                : 'bg-black/80 hover:bg-slate-900 border-white/20 text-white'
            }`}
          >
            <Heart
              className={`w-4 h-4 ${currentIsFavorite ? 'fill-rose-500 text-rose-500' : ''}`}
            />
            <span>{currentIsFavorite ? 'Salvo' : 'Minha Lista'}</span>
          </button>
        </div>
      </div>

      {/* Indicadores do Rolo de Destaques (Canto Inferior Direito) */}
      {bannerItems.length > 1 && (
        <div className="absolute bottom-5 right-6 z-20 hidden sm:flex items-center gap-2 bg-black/50 px-3 py-2 rounded-full border border-white/10">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 mr-1" />
          {bannerItems.map((item, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                title={cleanTitle(item.name)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  isActive
                    ? 'w-7 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                    : 'w-2 bg-white/30 hover:bg-white/60'
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
