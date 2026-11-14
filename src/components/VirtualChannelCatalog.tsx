import React, { useRef, useState, useMemo, useCallback } from 'react';
import { Heart, Play, Radio, Film, Tv, Star, Clapperboard } from 'lucide-react';
import { ChannelItem } from '../types/iptv';

interface VirtualChannelCatalogProps {
  channels: ChannelItem[];
  activeChannelId?: string;
  activeSeriesId?: number | string;
  favorites: Set<string>;
  onSelectChannel: (channel: ChannelItem) => void;
  onToggleFavorite: (channelId: string) => void;
}

const ROW_HEIGHT = 76; // Altura fixa de cada linha na lista virtualizada
const OVERSCAN = 6;

export const VirtualChannelCatalog: React.FC<VirtualChannelCatalogProps> = ({
  channels,
  activeChannelId,
  activeSeriesId,
  favorites,
  onSelectChannel,
  onToggleFavorite,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(420);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    if (e.currentTarget.clientHeight !== viewportHeight) {
      setViewportHeight(e.currentTarget.clientHeight);
    }
  }, [viewportHeight]);

  const { visibleItems, startIndex, totalHeight } = useMemo(() => {
    const total = channels.length;
    const totalH = total * ROW_HEIGHT;
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
    const end = Math.min(total, start + visibleCount);

    return {
      visibleItems: channels.slice(start, end),
      startIndex: start,
      totalHeight: totalH,
    };
  }, [channels, scrollTop, viewportHeight]);

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-400 border border-dashed border-slate-800 rounded-2xl p-6 text-center">
        <Tv className="w-8 h-8 text-cyan-400/50 mb-2" />
        <p className="text-sm font-medium text-slate-300">Nenhum canal ou mídia encontrado neste filtro.</p>
        <p className="text-xs text-slate-500 mt-1">
          Experimente limpar a busca ou adicionar uma nova lista M3U / Login Xtream Codes.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="relative w-full h-full overflow-y-auto pr-1 custom-scrollbar"
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        {visibleItems.map((item, idx) => {
          const realIndex = startIndex + idx;
          const topOffset = realIndex * ROW_HEIGHT;
          const isSelected =
            item.id === activeChannelId ||
            (Boolean(activeSeriesId) && Boolean(item.seriesId) && String(item.seriesId) === String(activeSeriesId));
          const isFav = favorites.has(item.id);

          return (
            <div
              key={item.id}
              tabIndex={0}
              role="button"
              data-tv-card="true"
              style={{
                position: 'absolute',
                top: `${topOffset}px`,
                left: 0,
                right: 0,
                height: `${ROW_HEIGHT - 8}px`,
              }}
              onClick={() => onSelectChannel(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectChannel(item);
                }
              }}
              className={`group flex items-center justify-between px-3.5 py-2 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent border-cyan-400/60 shadow-neon-cyan'
                  : 'bg-[#121a23]/90 hover:bg-[#17222e] border-slate-800/80 hover:border-cyan-500/30'
              }`}
            >
              {/* Esquerda: Número, Logo e Metadados + EPG */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-[11px] font-mono text-slate-500 w-7 text-right shrink-0">
                  {String(realIndex + 1).padStart(3, '0')}
                </span>

                <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-slate-900 border border-slate-700/60 shrink-0 flex items-center justify-center">
                  {item.logo ? (
                    <img
                      src={item.logo}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : item.mediaType === 'movie' ? (
                    <Film className="w-5 h-5 text-purple-400" />
                  ) : item.mediaType === 'series' ? (
                    <Clapperboard className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Radio className="w-5 h-5 text-cyan-400" />
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 bg-cyan-500/30 backdrop-blur-[1px] flex items-center justify-center">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`text-sm font-semibold truncate ${
                        isSelected ? 'text-cyan-300' : 'text-slate-100 group-hover:text-cyan-200'
                      }`}
                    >
                      {item.name}
                    </h4>
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800/90 text-slate-400 border border-slate-700/60 shrink-0">
                      {item.group}
                    </span>
                    {item.rating && (
                      <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-400 shrink-0">
                        <Star className="w-2.5 h-2.5 fill-amber-400" /> {item.rating}
                      </span>
                    )}
                  </div>

                  {/* Barra de Programação EPG ou Sinopse VOD */}
                  {item.epgCurrent ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-400 truncate max-w-[260px] sm:max-w-md">
                        Agora: <strong className="text-slate-300 font-medium">{item.epgCurrent.title}</strong>
                      </span>
                      <div className="hidden md:block w-20 h-1 bg-slate-800 rounded-full overflow-hidden shrink-0">
                        <div
                          className="h-full bg-cyan-400 rounded-full"
                          style={{ width: `${item.epgCurrent.progress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.plot ||
                        (item.mediaType === 'series'
                          ? 'Clique para selecionar Temporadas e Episódios • Sob Demanda'
                          : 'Stream direto com aceleração de hardware pronta')}
                    </p>
                  )}
                </div>
              </div>

              {/* Direita: Botão de Favorito e Indicador */}
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(item.id);
                  }}
                  className={`p-2 rounded-lg transition ${
                    isFav
                      ? 'text-rose-400 bg-rose-500/15 border border-rose-500/30'
                      : 'text-slate-500 hover:text-rose-300 hover:bg-slate-800'
                  }`}
                  title={isFav ? 'Remover dos Favoritos' : 'Favoritar'}
                >
                  <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500' : ''}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

