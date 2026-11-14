import React, { useState, useEffect } from 'react';
import {
  Play,
  Heart,
  Star,
  Calendar,
  Clock,
  Film,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import { ChannelItem, SeriesDetails, SeriesEpisode } from '../types/iptv';

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

export const MediaDetailsModal: React.FC<MediaDetailsModalProps> = ({
  item,
  isOpen,
  onClose,
  onPlay,
  isFavorite,
  onToggleFavorite,
  seriesDetails,
  isLoadingSeries = false,
  onSelectEpisode,
  savedProgressSeconds = 0,
}) => {
  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  useEffect(() => {
    if (seriesDetails && seriesDetails.seasons.length > 0) {
      setSelectedSeason(seriesDetails.seasons[0].seasonNumber);
    } else {
      setSelectedSeason(1);
    }
  }, [seriesDetails, item?.id]);

  if (!isOpen || !item) return null;

  const isSeries = item.mediaType === 'series';
  const coverImage = seriesDetails?.cover || item.logo || item.backdropUrl;
  const ratingText = seriesDetails?.rating || item.rating;
  const genreText = seriesDetails?.genre || item.genre || item.group;
  const releaseYear = seriesDetails?.releaseDate || item.year;
  const prologueText =
    seriesDetails?.plot ||
    item.plot ||
    item.epgCurrent?.description ||
    'Nenhuma sinopse ou prólogo disponível para este título.';

  const currentSeasonObj =
    seriesDetails?.seasons.find((s) => s.seasonNumber === selectedSeason) ||
    seriesDetails?.seasons[0];

  const handlePlayMain = () => {
    if (isSeries && seriesDetails && seriesDetails.seasons.length > 0) {
      const firstSeason = seriesDetails.seasons[0];
      const firstEp = firstSeason?.episodes[0];
      if (firstEp && onSelectEpisode) {
        onSelectEpisode(firstEp, seriesDetails);
        onClose();
        return;
      }
    }
    onPlay(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0f15] text-slate-100 overflow-y-auto select-none">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-6 sm:py-8">
        {/* Topo: Botão Voltar */}
        <div className="mb-6">
          <button
            type="button"
            data-tv-back="true"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 focus:bg-emerald-500 focus:text-slate-950 text-slate-200 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Catálogo</span>
          </button>
        </div>

        {/* Bloco Principal: Imagem do Filme/Série + Informações */}
        <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-start bg-[#111722] border border-slate-800 rounded-2xl p-5 sm:p-7">
          {/* Imagem (Capa) do Filme ou Série */}
          <div className="w-44 sm:w-56 shrink-0 mx-auto md:mx-0">
            {coverImage ? (
              <img
                src={coverImage}
                alt={item.name}
                className="w-full aspect-[2/3] object-cover rounded-xl border border-slate-700 bg-slate-900"
              />
            ) : (
              <div className="w-full aspect-[2/3] rounded-xl border border-slate-800 bg-slate-900 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                <Film className="w-10 h-10 mb-2" />
                <span className="text-xs font-semibold">{item.name}</span>
              </div>
            )}
          </div>

          {/* Informações do Filme ou Série */}
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-800 text-emerald-400 text-[11px] font-bold uppercase tracking-wider mb-2">
                {isSeries ? 'Série' : item.mediaType === 'movie' ? 'Filme' : 'Canal ao Vivo'}
              </span>
              <h1 className="text-xl sm:text-3xl font-extrabold text-white leading-tight">
                {seriesDetails?.name || item.name}
              </h1>
            </div>

            {/* Metadados: Nota, Ano, Gênero, Duração */}
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-300">
              {ratingText && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  Nota: {ratingText}
                </span>
              )}

              {releaseYear && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {releaseYear}
                </span>
              )}

              {genreText && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium">
                  {genreText}
                </span>
              )}
            </div>

            {/* Prólogo / Sinopse */}
            <div className="pt-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Prólogo / Sinopse
              </h2>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {prologueText}
              </p>
            </div>

            {/* Elenco (se houver) */}
            {item.cast && (
              <div className="pt-1 text-xs text-slate-400">
                <p>
                  <strong className="text-slate-300">Elenco:</strong> {item.cast}
                </p>
              </div>
            )}

            {/* Botões de Ação: Assistir e Favoritar */}
            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                autoFocus
                onClick={handlePlayMain}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 focus:bg-white text-slate-950 font-black text-sm flex items-center gap-2 transition cursor-pointer shadow-md"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>
                  {isSeries
                    ? 'Assistir 1º Episódio'
                    : savedProgressSeconds > 15
                    ? `Continuar (${Math.floor(savedProgressSeconds / 60)} min)`
                    : 'Assistir Agora'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onToggleFavorite(item.id)}
                className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 border transition cursor-pointer ${
                  isFavorite
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
                <span>{isFavorite ? 'Favoritado' : 'Favoritar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Seção de Temporadas e Episódios (Exibida quando for Série) */}
        {isSeries && (
          <div className="mt-6 bg-[#111722] border border-slate-800 rounded-2xl p-5 sm:p-7">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                Temporadas e Episódios
              </h2>
            </div>

            {isLoadingSeries ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Carregando temporadas e episódios...
              </div>
            ) : seriesDetails && seriesDetails.seasons.length > 0 ? (
              <div className="mt-4 space-y-5">
                {/* Abas de Temporadas */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {seriesDetails.seasons.map((season) => (
                    <button
                      key={season.seasonNumber}
                      type="button"
                      onClick={() => setSelectedSeason(season.seasonNumber)}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition cursor-pointer ${
                        selectedSeason === season.seasonNumber
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      Temporada {season.seasonNumber} ({season.episodes.length})
                    </button>
                  ))}
                </div>

                {/* Lista de Episódios da Temporada */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentSeasonObj?.episodes.map((ep) => (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => {
                        if (onSelectEpisode && seriesDetails) {
                          onSelectEpisode(ep, seriesDetails);
                          onClose();
                        }
                      }}
                      className="w-full text-left p-3.5 rounded-xl bg-[#0b0f15] hover:bg-slate-800/80 focus:bg-emerald-500 focus:text-slate-950 border border-slate-800 transition flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white group-focus:text-slate-950 truncate">
                          Episódio {ep.episodeNum} — {ep.title}
                        </p>
                        {ep.plot && (
                          <p className="text-xs text-slate-400 group-focus:text-slate-900 line-clamp-2 mt-1">
                            {ep.plot}
                          </p>
                        )}
                        {ep.duration && (
                          <span className="inline-block text-[11px] text-slate-500 group-focus:text-slate-900 mt-1">
                            Duração: {ep.duration}
                          </span>
                        )}
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/15 group-hover:bg-emerald-500 text-emerald-400 group-hover:text-slate-950 flex items-center justify-center shrink-0 transition">
                        <Play className="w-4 h-4 fill-current" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 text-sm text-slate-400">
                Clique em <strong>Assistir 1º Episódio</strong> acima para iniciar a reprodução.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
