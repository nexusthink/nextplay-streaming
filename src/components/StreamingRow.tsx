import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChannelItem } from '../types/iptv';
import { optimizePosterUrl } from '../utils/imageOptimizer';

interface StreamingRowProps {
  title: string;
  items: ChannelItem[];
  rowIndex?: number;
  activeChannelId?: string;
  favorites: Set<string>;
  onSelectChannel: (channel: ChannelItem) => void;
  onToggleFavorite: (channelId: string) => void;
  aspect?: 'poster' | 'landscape';
}

const cleanCardTitle = (rawName: string) => {
  if (!rawName) return '';
  return rawName
    .replace(/^(BR|US|PT|EN|ES)\s*[:||\-]\s*/i, '')
    .replace(/\[(FHD|4K|HD|SD|VIP|H265|HEVC|LEG|DUB)\]/gi, '')
    .replace(/\s+(FHD|4K|HD|SD|H265|HEVC|1080P|720P)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

export const StreamingRow: React.FC<StreamingRowProps> = React.memo(
  ({
    title,
    items,
    rowIndex,
    activeChannelId,
    onSelectChannel,
    aspect = 'poster',
  }) => {
    const rowRef = useRef<HTMLDivElement | null>(null);

    if (!items || items.length === 0) return null;

    const visibleSlice = items.slice(0, 16);
    const isPoster = aspect === 'poster';

    const scroll = (direction: 'left' | 'right') => {
      if (rowRef.current) {
        const scrollAmount =
          direction === 'left'
            ? -rowRef.current.clientWidth * 0.75
            : rowRef.current.clientWidth * 0.75;
        rowRef.current.scrollLeft += scrollAmount;
      }
    };

    return (
      <div
        className="space-y-2 group/row relative my-4 select-none"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 220px' }}
      >
        {/* Título da Fileira */}
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wide">
            {title}
          </h3>
        </div>

        {/* Fileira Ultra-Leve de 1 Camada Estilo Prime Video */}
        <div className="relative">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => scroll('left')}
            className="hidden sm:flex absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-14 rounded-r-xl bg-black/90 text-white border border-slate-700 items-center justify-center opacity-0 group-hover/row:opacity-100"
            title="Rolar para esquerda"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div
            ref={rowRef}
            data-tv-row="true"
            className="flex items-start gap-2.5 sm:gap-3 overflow-x-auto scrollbar-none pb-2 pt-1 px-2"
          >
            {visibleSlice.map((item, colIdx) => {
              const isSelected = item.id === activeChannelId;
              const displayName = cleanCardTitle(item.name) || item.name;
              const thumbUrl = optimizePosterUrl(item.logo, isPoster ? 'w185' : 'w300');

              return (
                <button
                  key={item.id}
                  type="button"
                  data-tv-card="true"
                  data-tv-row-idx={rowIndex !== undefined ? String(rowIndex) : undefined}
                  data-tv-col-idx={String(colIdx)}
                  onClick={() => onSelectChannel(item)}
                  className={`shrink-0 text-left rounded-lg overflow-hidden cursor-pointer bg-[#0a0f16] border ${
                    isPoster
                      ? 'w-28 sm:w-32 md:w-36'
                      : 'w-44 sm:w-52 md:w-56'
                  } ${
                    isSelected ? 'border-lime-400' : 'border-slate-800/80'
                  }`}
                >
                  <div
                    className={`w-full bg-black overflow-hidden ${
                      isPoster ? 'aspect-[2/3]' : 'aspect-video'
                    }`}
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={displayName}
                        loading="lazy"
                        decoding="async"
                        width={isPoster ? 144 : 224}
                        height={isPoster ? 216 : 126}
                        className="w-full h-full object-cover bg-black pointer-events-none"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                        }}
                      />
                    ) : null}
                  </div>
                  <p className="px-2 py-1.5 text-[11px] font-bold text-slate-200 truncate">
                    {displayName}
                  </p>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            tabIndex={-1}
            onClick={() => scroll('right')}
            className="hidden sm:flex absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-14 rounded-l-xl bg-black/90 text-white border border-slate-700 items-center justify-center opacity-0 group-hover/row:opacity-100"
            title="Rolar para direita"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }
);
