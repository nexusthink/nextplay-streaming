import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, Tv, Film, Clapperboard, History as HistoryIcon, AlertTriangle, X } from 'lucide-react';
import { WatchHistoryItem } from '../types/iptv';
import {
  HistoryClearScope,
  HISTORY_SCOPE_LABELS,
  countHistoryByType,
} from '../services/historyManager';

interface HistoryManagerPanelProps {
  history: WatchHistoryItem[];
  onClear: (scope: HistoryClearScope) => void;
}

const SCOPE_ICONS: Record<HistoryClearScope, React.ReactNode> = {
  live: <Tv className="w-3.5 h-3.5" />,
  movie: <Film className="w-3.5 h-3.5" />,
  series: <Clapperboard className="w-3.5 h-3.5" />,
  all: <Trash2 className="w-3.5 h-3.5" />,
};

const SCOPES: HistoryClearScope[] = ['live', 'movie', 'series', 'all'];

/**
 * Painel "Apagar Histórico": limpa Canais, Filmes, Séries ou Tudo
 * com confirmação em 2 cliques para evitar exclusões acidentais.
 */
export const HistoryManagerPanel: React.FC<HistoryManagerPanelProps> = ({ history, onClear }) => {
  const counts = useMemo(() => countHistoryByType(history), [history]);
  const [pendingScope, setPendingScope] = useState<HistoryClearScope | null>(null);
  const [feedback, setFeedback] = useState<string>('');

  // Cancela a confirmação automaticamente após 5s
  useEffect(() => {
    if (!pendingScope) return;
    const t = window.setTimeout(() => setPendingScope(null), 5000);
    return () => window.clearTimeout(t);
  }, [pendingScope]);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(''), 2500);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const handleConfirm = useCallback(() => {
    if (!pendingScope) return;
    const removed = counts[pendingScope];
    onClear(pendingScope);
    setFeedback(
      pendingScope === 'all'
        ? `Histórico completo apagado (${removed} itens).`
        : `Histórico de ${HISTORY_SCOPE_LABELS[pendingScope]} apagado (${removed} itens).`
    );
    setPendingScope(null);
  }, [pendingScope, counts, onClear]);

  return (
    <div className="shrink-0 rounded-xl bg-[#0d141c] border border-slate-800 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <HistoryIcon className="w-4 h-4 text-cyan-400" />
          Apagar Histórico
          {feedback && (
            <span className="ml-2 text-[11px] font-semibold text-emerald-400">{feedback}</span>
          )}
        </div>

        {pendingScope ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5" />
              Apagar {counts[pendingScope]} itens de{' '}
              {pendingScope === 'all' ? 'todo o histórico' : HISTORY_SCOPE_LABELS[pendingScope]}?
            </span>
            <button
              onClick={handleConfirm}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500 text-white hover:bg-rose-400 transition"
            >
              Confirmar
            </button>
            <button
              onClick={() => setPendingScope(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
              aria-label="Cancelar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {SCOPES.map((scope) => {
              const disabled = counts[scope] === 0;
              const isAll = scope === 'all';
              return (
                <button
                  key={scope}
                  disabled={disabled}
                  onClick={() => setPendingScope(scope)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                    disabled
                      ? 'opacity-40 cursor-not-allowed border-slate-800 text-slate-500'
                      : isAll
                      ? 'border-rose-500/40 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20'
                      : 'border-slate-700 text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {SCOPE_ICONS[scope]}
                  {HISTORY_SCOPE_LABELS[scope]}
                  <span className="text-[10px] text-slate-500">{counts[scope]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

