import React, { useState } from 'react';
import {
  X,
  Play,
  Heart,
  Star,
  Clock,
  Calendar,
  Sparkles,
  Film,
  Clapperboard,
  Tv,
  Check,
  ChevronRight,
  Info,
} from 'lucide-react';
import { ChannelItem, SeriesDetails, SeriesEpisode } from '../types/iptv';
import { isLegendadoItem } from '../services/subtitleEngine';
import { formatProgressTime } from '../services/historyManager';

interface MediaDetailsModalProps {
  item: ChannelItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (item: ChannelItem) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  seriesDetails?: SeriesDetails | null;
  isLoadingSeries?: boolean;
  onSelectEpisode?: (episode: SeriesEpisode, series: SeriesDetails) => void;
  savedProgressSeconds?: number;
}

// Limpa títulos poluídos de IPTV (ex: "BR: Oppenheimer (2023) FHD [LEG]" -> "Oppenheimer")
const sanitizeTitle = (rawName: string) => {
  if (!rawName) return '';
  return rawName
    .replace(/^(BR|US|PT|EN|ES)\s*[:||\-]\s*/i, '')
    .replace(/\[(FHD|4K|HD|SD|VIP|H265|HEVC|LEG|DUB)\]/gi, '')
    .replace(/\s+(FHD|4K|HD|SD|H265|HEVC|1080P|720P)\b/gi, '')
    .replace(/\s*\(\d{4}\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const extractYear = (rawName: string, fallbackYear?: string) => {
  if (fallbackYear) return fallbackYear;
  const match = rawName.match(/\b(19\d\d|20\d\d)\b/);
  return match ? match[1] : '';
};

export const MediaDetailsModal: React.FC<MediaDetailsModalProps> = ({
  item,
  isOpen,
  onClose,
  onPlay,
  isFavorite,
  onToggleFavorite,
  seriesDetails,
  isLoadingSeries,
  onSelectEpisode,
  savedProgressSeconds,
}) => {
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number>(1);

  if (!isOpen || !item) return null;

  const isMovie = item.mediaType === 'movie';
  const isSeries = item.mediaType === 'series';
  const cleanTitle = sanitizeTitle(item.name);
  const year = extractYear(item.name, item.year);
  const isLeg = isLegendadoItem(item);
  const rating = item.rating && item.rating !== '0' ? item.rating : '7.8';

  // Temporadas da série
  const seasons = seriesDetails?.seasons || [];
  const currentSeason =
    seasons.find((s) => s.seasonNumber === selectedSeasonNumber) || seasons[0];

  const backdrop = item.backdropUrl || seriesDetails?.backdropUrl || item.logo;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-[#0a0f16] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col my-auto transition-all animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar Flutuante */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white border border-white/10 backdrop-blur-md transition shadow-lg"
          title="Fechar Detalhes"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 1. HERO BACKDROP BANNER */}
        <div className="relative w-full h-72 sm:h-96 bg-slate-950 overflow-hidden flex items-end">
          {backdrop ? (
            <img
              src={backdrop}
              alt={cleanTitle}
              className="absolute inset-0 w-full h-full object-cover filter brightness-75 scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f16] via-[#111927] to-[#0d141f]" />
          )}

          {/* Gradientes cinematográficos de fusão */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f16] via-[#0a0f16]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f16] via-transparent to-transparent opacity-80" />

          {/* Informações Sobrepostas no Banner */}
          <div className="relative z-10 p-6 sm:p-8 flex items-end gap-6 w-full">
            {/* Pôster Vertical Pequeno */}
            {item.logo && (
              <div className="hidden sm:block w-32 md:w-36 aspect-[2/3] rounded-2xl overflow-hidden border border-white/20 shadow-2xl shrink-0 bg-slate-900">
                <img
                  src={item.logo}
                  alt={cleanTitle}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold uppercase tracking-wider">
                  {isMovie ? 'Filme' : isSeries ? 'Série' : 'Canal'}
                </span>

                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{rating} IMDb</span>
                </span>

                {year && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                    {year}
                  </span>
                )}

                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[11px] font-bold">
                  {item.containerExtension ? item.containerExtension.toUpperCase() : '4K UHD'}
                </span>

                {isLeg ? (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/90 text-slate-950 font-bold text-[10px]">
                    LEGENDADO
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-teal-500/90 text-slate-950 font-bold text-[10px]">
                    DUBLADO
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
                {cleanTitle}
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Categoria: <span className="text-cyan-300">{item.group || 'Geral'}</span>
              </p>

              {/* Botões de Ação */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    onPlay(item);
                    onClose();
                  }}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-sm transition shadow-neon-cyan transform hover:scale-105"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>
                    {savedProgressSeconds && savedProgressSeconds > 15
                      ? `Continuar (${formatProgressTime(savedProgressSeconds)})`
                      : 'Assistir Agora'}
                  </span>
                </button>

                <button
                  onClick={() => onToggleFavorite(item.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-bold transition ${
                    isFavorite
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-md'
                      : 'bg-[#0f1724] border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span>{isFavorite ? 'Na Minha Lista' : 'Salvar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. CORPO DO MODAL: Sinopse, Elenco & Temporadas */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[45vh] overflow-y-auto custom-scrollbar">
          {/* Sinopse */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Sinopse do Título
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed font-normal">
              {item.plot ||
                seriesDetails?.plot ||
                `Assista ${cleanTitle} completo em alta definição com áudio estéreo imersivo e aceleração de vídeo ativa no NextPlay.`}
            </p>
          </div>

          {/* Elenco e Gênero */}
          {(item.cast || item.genre || seriesDetails?.cast || seriesDetails?.genre) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60 text-xs">
              {(item.genre || seriesDetails?.genre) && (
                <div>
                  <span className="text-slate-400 font-medium">Gênero: </span>
                  <span className="text-slate-200 font-semibold">
                    {item.genre || seriesDetails?.genre}
                  </span>
                </div>
              )}
              {(item.cast || seriesDetails?.cast) && (
                <div>
                  <span className="text-slate-400 font-medium">Elenco: </span>
                  <span className="text-slate-200 font-semibold line-clamp-2">
                    {item.cast || seriesDetails?.cast}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 3. SEÇÃO ESPECÍFICA PARA SÉRIES: Temporadas e Episódios */}
          {isSeries && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clapperboard className="w-4 h-4 text-cyan-400" />
                  <span>Episódios & Temporadas</span>
                </h3>
                {isLoadingSeries && (
                  <span className="text-xs text-cyan-400 animate-pulse">Carregando episódios...</span>
                )}
              </div>

              {/* Seletor de Temporadas */}
              {seasons.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {seasons.map((s) => (
                    <button
                      key={s.seasonNumber}
                      onClick={() => setSelectedSeasonNumber(s.seasonNumber)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                        selectedSeasonNumber === s.seasonNumber
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-neon-cyan'
                          : 'bg-[#0f1724] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      Temporada {s.seasonNumber} ({s.episodes.length})
                    </button>
                  ))}
                </div>
              )}

              {/* Lista de Episódios da Temporada Selecionada */}
              {currentSeason && currentSeason.episodes.length > 0 ? (
                <div className="space-y-2.5">
                  {currentSeason.episodes.map((ep) => (
                    <div
                      key={ep.id}
                      onClick={() => {
                        if (onSelectEpisode && seriesDetails) {
                          onSelectEpisode(ep, seriesDetails);
                          onClose();
                        }
                      }}
                      className="group flex items-center justify-between p-3.5 rounded-2xl bg-[#0c121b] hover:bg-[#131d2a] border border-slate-800 hover:border-cyan-500/60 cursor-pointer transition shadow-sm"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 group-hover:bg-cyan-400 group-hover:text-slate-950 transition">
                          <Play className="w-4 h-4 text-cyan-400 group-hover:text-slate-950 ml-0.5 transition" />
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition truncate">
                            {ep.episodeNum}. {ep.title}
                          </h4>
                          {ep.duration && (
                            <span className="text-[10px] text-slate-400">{ep.duration}</span>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition shrink-0" />
                    </div>
                  ))}
                </div>
              ) : (
                !isLoadingSeries && (
                  <p className="text-xs text-slate-400 italic">
                    Clique em "Assistir Agora" para reproduzir a transmissão principal desta série.
                  </p>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
