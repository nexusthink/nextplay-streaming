import React, { useState, useEffect } from 'react';
import {
  Clapperboard,
  Play,
  Clock,
  Star,
  ChevronDown,
  ChevronUp,
  Loader2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { SeriesDetails, SeriesEpisode } from '../types/iptv';

interface SeriesEpisodeSelectorProps {
  seriesDetails: SeriesDetails | null;
  isLoading: boolean;
  error: string | null;
  activeEpisodeId?: string;
  onSelectEpisode: (episode: SeriesEpisode, series: SeriesDetails) => void;
}

export const SeriesEpisodeSelector: React.FC<SeriesEpisodeSelectorProps> = ({
  seriesDetails,
  isLoading,
  error,
  activeEpisodeId,
  onSelectEpisode,
}) => {
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Sincroniza a temporada ativa quando uma nova série é carregada
  useEffect(() => {
    if (seriesDetails && seriesDetails.seasons.length > 0) {
      setSelectedSeasonNum(seriesDetails.seasons[0].seasonNumber);
      setIsExpanded(true);
    }
  }, [seriesDetails?.seriesId]);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#0d151e]/95 border border-cyan-500/30 px-4 py-3 flex items-center justify-between shadow-neon-cyan shrink-0">
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          <span className="text-xs font-bold text-cyan-200">
            Sincronizando temporadas e episódios da série no servidor IPTV...
          </span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400/80">
          XTREAM SERIES ENGINE
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-rose-950/30 border border-rose-500/30 px-4 py-2.5 flex items-center justify-between shrink-0">
        <span className="text-xs text-rose-300 font-medium">{error}</span>
      </div>
    );
  }

  if (!seriesDetails || seriesDetails.seasons.length === 0) {
    return null;
  }

  const currentSeason =
    seriesDetails.seasons.find((s) => s.seasonNumber === selectedSeasonNum) ||
    seriesDetails.seasons[0];

  const totalEpisodes = seriesDetails.seasons.reduce((acc, s) => acc + s.episodes.length, 0);

  return (
    <div className="rounded-2xl bg-[#0c141d]/95 border border-cyan-500/35 shadow-[0_10px_30px_rgba(0,0,0,0.65)] overflow-hidden shrink-0 transition-all">
      {/* Barra Superior da Série: Capa + Título + Seletor de Temporadas */}
      <div className="px-3.5 py-2.5 bg-gradient-to-r from-[#0f1a26] via-[#111e2c] to-[#0d151f] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {seriesDetails.cover ? (
            <img
              src={seriesDetails.cover}
              alt={seriesDetails.name}
              className="w-9 h-12 rounded-lg object-cover border border-cyan-400/30 shrink-0"
            />
          ) : (
            <div className="w-9 h-12 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center shrink-0">
              <Clapperboard className="w-4 h-4 text-cyan-300" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Série On-Demand
              </span>
              <h4 className="text-xs sm:text-sm font-extrabold text-white truncate">
                {seriesDetails.name}
              </h4>
              {seriesDetails.rating && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[10px] font-bold">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  {seriesDetails.rating}
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 truncate mt-0.5 max-w-2xl">
              <span className="text-cyan-300 font-semibold">
                {seriesDetails.seasons.length}{' '}
                {seriesDetails.seasons.length === 1 ? 'Temporada' : 'Temporadas'}
              </span>{' '}
              •{' '}
              <span className="text-teal-300 font-semibold">
                {totalEpisodes} {totalEpisodes === 1 ? 'Episódio' : 'Episódios'}
              </span>
              {seriesDetails.genre ? ` • ${seriesDetails.genre}` : ''}
              {seriesDetails.plot ? ` — ${seriesDetails.plot}` : ''}
            </p>
          </div>
        </div>

        {/* Abas de Temporadas + Botão Recolher/Expandir */}
        <div className="flex items-center gap-2 max-w-full overflow-x-auto">
          <div className="flex items-center gap-1 bg-[#090e14] p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-[420px] custom-scrollbar">
            {seriesDetails.seasons.map((season) => {
              const active = season.seasonNumber === currentSeason.seasonNumber;
              return (
                <button
                  key={season.seasonNumber}
                  onClick={() => {
                    setSelectedSeasonNum(season.seasonNumber);
                    setIsExpanded(true);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shrink-0 flex items-center gap-1.5 ${
                    active
                      ? 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 shadow-neon-cyan'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>T{season.seasonNumber}</span>
                  <span
                    className={`text-[9px] px-1 rounded ${
                      active ? 'bg-slate-950/25 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {season.episodes.length}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="p-1.5 rounded-lg bg-[#111b26] hover:bg-cyan-500/20 border border-slate-700 text-slate-300 hover:text-cyan-200 transition shrink-0"
            title={isExpanded ? 'Ocultar lista de episódios' : 'Mostrar lista de episódios'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Carrossel Horizontal de Episódios da Temporada Selecionada */}
      {isExpanded && currentSeason && (
        <div className="p-3 bg-[#0a1017] flex items-center gap-2.5 overflow-x-auto custom-scrollbar">
          {currentSeason.episodes.map((ep) => {
            const isPlayingEp = activeEpisodeId === `xt-ep-${ep.id}` || activeEpisodeId === ep.id;
            return (
              <button
                key={ep.id}
                onClick={() => onSelectEpisode(ep, seriesDetails)}
                className={`group relative flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all shrink-0 w-64 ${
                  isPlayingEp
                    ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/10 border-cyan-400 shadow-neon-cyan'
                    : 'bg-[#101924]/90 border-slate-800/90 hover:border-cyan-500/40 hover:bg-[#14202e]'
                }`}
              >
                {/* Thumbnail / Número do Episódio */}
                <div className="relative w-14 h-14 rounded-lg bg-[#090e14] border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                  {ep.cover || seriesDetails.cover ? (
                    <img
                      src={ep.cover || seriesDetails.cover}
                      alt={ep.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <Clapperboard className="w-5 h-5 text-cyan-400/60" />
                  )}
                  <div
                    className={`absolute inset-0 flex items-center justify-center transition ${
                      isPlayingEp
                        ? 'bg-cyan-500/40'
                        : 'bg-black/40 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                  <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/85 text-[9px] font-mono font-bold text-cyan-300">
                    E{String(ep.episodeNum).padStart(2, '0')}
                  </span>
                </div>

                {/* Metadados do Episódio */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                      T{String(ep.seasonNumber).padStart(2, '0')} • EP{' '}
                      {String(ep.episodeNum).padStart(2, '0')}
                    </span>
                    {ep.duration && (
                      <span className="flex items-center gap-0.5 text-[9px] text-slate-400 font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        {ep.duration}
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-bold text-white truncate mt-0.5" title={ep.title}>
                    {ep.title}
                  </p>

                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {isPlayingEp ? (
                      <span className="text-emerald-300 font-bold">● Reproduzindo agora</span>
                    ) : (
                      ep.plot || 'Clique para reproduzir este episódio'
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

