import React, { useRef } from 'react';
import { Play, Heart, Star, ChevronLeft, ChevronRight, Film, Clapperboard, Radio, Sparkles } from 'lucide-react';
import { ChannelItem } from '../types/iptv';

interface StreamingRowProps {
  title: string;
  items: ChannelItem[];
  activeChannelId?: string;
  favorites: Set<string>;
  onSelectChannel: (channel: ChannelItem) => void;
  onToggleFavorite: (channelId: string) => void;
  aspect?: 'poster' | 'landscape';
}

// Higieniza nomes poluídos de IPTV no card (ex: "BR | HBO FHD H265" -> "HBO")
const cleanCardTitle = (rawName: string) => {
  if (!rawName) return '';
  return rawName
    .replace(/^(BR|US|PT|EN|ES)\s*[:||\-]\s*/i, '')
    .replace(/\[(FHD|4K|HD|SD|VIP|H265|HEVC|LEG|DUB)\]/gi, '')
    .replace(/\s+(FHD|4K|HD|SD|H265|HEVC|1080P|720P)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

export const StreamingRow: React.FC<StreamingRowProps> = ({
  title,
  items,
  activeChannelId,
  favorites,
  onSelectChannel,
  onToggleFavorite,
  aspect = 'poster',
}) => {
  const rowRef = useRef<HTMLDivElement | null>(null);

  if (!items || items.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const scrollAmount = direction === 'left' ? -rowRef.current.clientWidth * 0.75 : rowRef.current.clientWidth * 0.75;
      rowRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const isPoster = aspect === 'poster';

  return (
    <div className="space-y-3 group/row relative my-5 select-none">
      {/* Título da Fileira */}
      <div className="flex items-center justify-between px-2">
        <h3 className="text-base sm:text-lg font-extrabold text-white tracking-wide flex items-center gap-2">
          {title}
          <span className="text-xs font-mono font-medium text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </h3>
      </div>

      {/* Carrossel com Botões de Navegação Estilo Netflix */}
      <div className="relative">
        <button
          tabIndex={-1}
          onClick={() => scroll('left')}
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-16 sm:w-12 sm:h-20 rounded-r-2xl bg-black/85 hover:bg-black/95 text-white/80 hover:text-cyan-400 border border-slate-700/60 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-200 backdrop-blur-md shadow-2xl"
          title="Rolar para esquerda"
        >
          <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>

        <div
          ref={rowRef}
          data-tv-row="true"
          className="flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-none scroll-smooth pb-3 pt-2 px-2 custom-scrollbar"
        >
          {items.map((item) => {
            const isSelected = item.id === activeChannelId;
            const isFav = favorites.has(item.id);
            const displayName = cleanCardTitle(item.name) || item.name;

            return (
              <div
                key={item.id}
                tabIndex={0}
                role="button"
                data-tv-card="true"
                onClick={() => onSelectChannel(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectChannel(item);
                  }
                }}
                className={`group/card relative shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 transform hover:-translate-y-2 hover:scale-[1.04] border ${
                  isPoster
                    ? 'w-32 sm:w-40 md:w-48 aspect-[2/3]'
                    : 'w-56 sm:w-64 md:w-72 aspect-video'
                } ${
                  isSelected
                    ? 'border-cyan-400 shadow-neon-cyan ring-2 ring-cyan-400/50 bg-slate-900'
                    : 'border-slate-800/80 hover:border-cyan-400/60 bg-[#0e1622] hover:shadow-[0_14px_35px_rgba(0,0,0,0.85)]'
                }`}
              >
                {/* Imagem de Capa / Poster */}
                {item.logo ? (
                  <img
                    src={item.logo}
                    alt={item.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0c141e] to-[#14202e] text-slate-500 p-3 text-center">
                    {item.mediaType === 'movie' ? (
                      <Film className="w-9 h-9 text-purple-400/60 mb-2" />
                    ) : item.mediaType === 'series' ? (
                      <Clapperboard className="w-9 h-9 text-emerald-400/60 mb-2" />
                    ) : (
                      <Radio className="w-9 h-9 text-cyan-400/60 mb-2" />
                    )}
                    <span className="text-xs line-clamp-2 text-slate-200 font-bold">
                      {displayName}
                    </span>
                  </div>
                )}

                {/* Gradiente Escuro Netflix no Card (Foco perfeito na leitura) */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent opacity-85 group-hover/card:opacity-95 transition-opacity" />

                {/* Badges de Topo (Nota, Live, ou Grupo) */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                  {item.mediaType === 'live' ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600/90 text-white font-black text-[9px] uppercase tracking-wider shadow-md backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      Ao Vivo
                    </span>
                  ) : item.rating ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-bold text-amber-400 border border-amber-400/30">
                      <Star className="w-2.5 h-2.5 fill-amber-400" />
                      {item.rating}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[9px] font-semibold text-slate-300 border border-slate-700/60 truncate max-w-[90px]">
                      {item.group}
                    </span>
                  )}

                  {/* Botão de Favoritar Rápido com Coração */}
                  <button
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(item.id);
                    }}
                    className="pointer-events-auto p-1.5 rounded-full bg-black/65 hover:bg-rose-500/30 text-slate-300 hover:text-rose-400 transition backdrop-blur-md"
                    title={isFav ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>
                </div>

                {/* Botão Central de Play no Hover (Animação Suave Netflix) */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 group-focus/card:opacity-100 transition-opacity duration-200 z-10">
                  <div className="w-12 h-12 rounded-full bg-white text-slate-950 flex items-center justify-center shadow-[0_4px_20px_rgba(255,255,255,0.4)] transform scale-90 group-hover/card:scale-100 group-focus/card:scale-100 transition-transform">
                    <Play className="w-6 h-6 fill-slate-950 ml-0.5" />
                  </div>
                </div>

                {/* Informações na Base do Card */}
                <div className="absolute bottom-2.5 inset-x-2.5 pointer-events-none z-10">
                  <p className="text-xs sm:text-sm font-extrabold text-white line-clamp-1 drop-shadow-md">
                    {displayName}
                  </p>

                  {item.epgCurrent ? (
                    <div className="mt-1">
                      <p className="text-[10px] text-cyan-300/90 truncate drop-shadow font-medium">
                        {item.epgCurrent.title}
                      </p>
                      {/* Barra de Progresso do Programa Atual no EPG */}
                      <div className="w-full h-1 bg-white/20 rounded-full mt-1 overflow-hidden">
                        <div className="w-2/5 h-full bg-cyan-400 rounded-full" />
                      </div>
                    </div>
                  ) : item.seriesName ? (
                    <p className="text-[10px] text-emerald-300/90 truncate mt-0.5 font-medium">
                      {item.seriesName} {item.seasonNumber ? `• T${item.seasonNumber}` : ''}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                      {item.group}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          tabIndex={-1}
          onClick={() => scroll('right')}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-16 sm:w-12 sm:h-20 rounded-l-2xl bg-black/85 hover:bg-black/95 text-white/80 hover:text-cyan-400 border border-slate-700/60 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-200 backdrop-blur-md shadow-2xl"
          title="Rolar para direita"
        >
          <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      </div>
    </div>
  );
};

