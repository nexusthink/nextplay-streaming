import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Tv,
  Film,
  Clapperboard,
  Play,
  Star,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { ChannelItem } from '../types/iptv';
import { isAdultContent } from '../services/contentFilter';

interface GlobalOmniSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: ChannelItem[];
  onSelectChannel: (channel: ChannelItem) => void;
  isParentalUnlocked: boolean;
  onRequestParentalUnlock: (channel: ChannelItem) => void;
}

export const GlobalOmniSearchModal: React.FC<GlobalOmniSearchModalProps> = ({
  isOpen,
  onClose,
  channels,
  onSelectChannel,
  isParentalUnlocked,
  onRequestParentalUnlock,
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'movie' | 'series'>('all');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-foco ao abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Tecla Escape para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtra itens com segurança de conteúdo adulto
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) {
      return { live: [], movie: [], series: [], total: 0 };
    }

    const safeList = channels.filter((c) => isParentalUnlocked || !isAdultContent(c));

    const matched = safeList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        (c.cast && c.cast.toLowerCase().includes(q)) ||
        (c.epgCurrent && c.epgCurrent.title.toLowerCase().includes(q))
    );

    const live = matched.filter((c) => c.mediaType === 'live').slice(0, 30);
    const movie = matched.filter((c) => c.mediaType === 'movie').slice(0, 30);
    const series = matched.filter((c) => c.mediaType === 'series').slice(0, 30);

    return {
      live,
      movie,
      series,
      total: matched.length,
    };
  }, [query, channels, isParentalUnlocked]);

  if (!isOpen) return null;

  const handleItemClick = (item: ChannelItem) => {
    if (isAdultContent(item) && !isParentalUnlocked) {
      onRequestParentalUnlock(item);
    } else {
      onSelectChannel(item);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center pt-12 sm:pt-20 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#0a0f16] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Busca Superior */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar canais de TV, filmes, séries ou atores..."
            className="w-full bg-transparent border-none text-white text-base sm:text-lg placeholder:text-slate-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-900 text-xs font-bold text-slate-400 hover:text-white border border-slate-800"
          >
            ESC
          </button>
        </div>

        {/* Abas de Resultados */}
        {query.length >= 2 && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-slate-800/80 bg-[#070b10] text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                activeTab === 'all'
                  ? 'bg-cyan-500 text-slate-950 shadow-neon-cyan'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({results.total})
            </button>
            <button
              onClick={() => setActiveTab('live')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                activeTab === 'live'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              TV ao Vivo ({results.live.length})
            </button>
            <button
              onClick={() => setActiveTab('movie')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                activeTab === 'movie'
                  ? 'bg-cyan-500 text-slate-950 shadow-neon-cyan'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Filmes ({results.movie.length})
            </button>
            <button
              onClick={() => setActiveTab('series')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                activeTab === 'series'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Séries ({results.series.length})
            </button>
          </div>
        )}

        {/* Lista de Resultados Rolável */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          {query.length < 2 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
              <Sparkles className="w-8 h-8 text-cyan-400/50 mb-2" />
              <p className="text-sm">Digite ao menos 2 caracteres para pesquisar</p>
              <p className="text-xs text-slate-600 mt-1">Busca instantânea em mais de {channels.length.toLocaleString('pt-BR')} itens</p>
            </div>
          ) : results.total === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
              <X className="w-8 h-8 text-rose-500/50 mb-2" />
              <p className="text-sm font-semibold text-slate-400">Nenhum resultado para "{query}"</p>
              <p className="text-xs text-slate-600 mt-1">Tente conferir a ortografia ou use outro termo.</p>
            </div>
          ) : (
            <>
              {/* Canais Ao Vivo */}
              {(activeTab === 'all' || activeTab === 'live') && results.live.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5" />
                    <span>TV ao Vivo ({results.live.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {results.live.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className="group flex items-center justify-between p-3 rounded-2xl bg-[#0c121b] hover:bg-[#131d2a] border border-slate-800 hover:border-cyan-500/60 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 p-1 flex items-center justify-center shrink-0">
                            {item.logo ? (
                              <img src={item.logo} alt="" className="max-w-full max-h-full object-contain" />
                            ) : (
                              <Tv className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                              {item.name}
                            </h5>
                            <span className="text-[10px] text-slate-400 truncate block">
                              {item.group}
                            </span>
                          </div>
                        </div>
                        <Play className="w-4 h-4 text-cyan-400 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filmes VOD */}
              {(activeTab === 'all' || activeTab === 'movie') && results.movie.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5" />
                    <span>Filmes ({results.movie.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {results.movie.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className="group flex items-center justify-between p-3 rounded-2xl bg-[#0c121b] hover:bg-[#131d2a] border border-slate-800 hover:border-cyan-500/60 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-14 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0">
                            {item.logo ? (
                              <img src={item.logo} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Film className="w-4 h-4 text-slate-500 m-auto mt-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                              {item.name}
                            </h5>
                            <span className="text-[10px] text-slate-400 truncate block">
                              {item.group}
                            </span>
                          </div>
                        </div>
                        <Play className="w-4 h-4 text-cyan-400 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Séries */}
              {(activeTab === 'all' || activeTab === 'series') && results.series.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Clapperboard className="w-3.5 h-3.5" />
                    <span>Séries ({results.series.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {results.series.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className="group flex items-center justify-between p-3 rounded-2xl bg-[#0c121b] hover:bg-[#131d2a] border border-slate-800 hover:border-cyan-500/60 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-14 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0">
                            {item.logo ? (
                              <img src={item.logo} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Clapperboard className="w-4 h-4 text-slate-500 m-auto mt-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                              {item.name}
                            </h5>
                            <span className="text-[10px] text-slate-400 truncate block">
                              {item.group}
                            </span>
                          </div>
                        </div>
                        <Play className="w-4 h-4 text-cyan-400 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

