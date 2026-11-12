import React, { useEffect, useState } from 'react';
import {
  X,
  Link2,
  Unlink,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
  User,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { PublicServerOption, UserAccount } from '../types/iptv';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  servers: PublicServerOption[];
  onLinkIptvAndConnect: (
    serverId: string,
    username: string,
    password: string
  ) => Promise<void>;
  onUnlinkIptv: () => Promise<void>;
  onLoadDemo: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  servers,
  onLinkIptvAndConnect,
  onUnlinkIptv,
  onLoadDemo,
}) => {
  const [selectedServerId, setSelectedServerId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSuccessMsg(null);
    if (currentUser?.iptvLink) {
      setSelectedServerId(currentUser.iptvLink.serverId);
      setUsername(currentUser.iptvLink.username);
      setPassword(currentUser.iptvLink.password);
    } else if (servers.length > 0) {
      const def = servers.find((s) => s.isDefault) || servers[0];
      if (def) setSelectedServerId(def.id);
    }
  }, [isOpen, currentUser, servers]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServerId || !username.trim() || !password.trim()) {
      setError('Selecione o servidor e informe seu usuário e senha IPTV.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await onLinkIptvAndConnect(selectedServerId, username.trim(), password.trim());
      setSuccessMsg('Lista IPTV vinculada e sincronizada com sucesso!');
      setTimeout(() => onClose(), 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível validar o usuário e senha no servidor selecionado.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm('Deseja desvincular esta lista IPTV da sua conta?')) return;
    setIsLoading(true);
    setError(null);
    try {
      await onUnlinkIptv();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desvincular lista.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg bg-[#0e151d] border border-cyan-500/30 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#121b25]">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-cyan-400" />
              Lista IPTV Vinculada à Conta
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentUser
                ? `Conta: ${currentUser.name} (${currentUser.email})`
                : 'Selecione seu servidor e credenciais IPTV'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[78vh] overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2">
                Servidor IPTV
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {servers.map((srv) => {
                  const isSelected = selectedServerId === srv.id;
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setSelectedServerId(srv.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-400 text-white'
                          : 'bg-[#090d12] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Server className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{srv.name}</p>
                          <p className="text-[10px] text-slate-400">{srv.region || 'Brasil'}</p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Usuário IPTV
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Seu usuário"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#090d12] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Senha IPTV
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#090d12] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-cyan-300 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold text-sm hover:brightness-110 transition shadow-neon-cyan flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando e Sincronizando...
                </>
              ) : (
                <>Salvar e Atualizar Lista Vinculada</>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            {currentUser?.iptvLink && (
              <button
                type="button"
                onClick={handleUnlink}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
                Desvincular Lista da Conta
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onLoadDemo();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/20 transition cursor-pointer ml-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Modo Demonstração
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
