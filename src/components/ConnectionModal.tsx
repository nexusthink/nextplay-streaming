import React, { useState } from 'react';
import {
  X,
  KeyRound,
  Link2,
  FileUp,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
  User,
  Lock,
  Trash2,
} from 'lucide-react';
import { PlaylistProfile } from '../types/iptv';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: PlaylistProfile[];
  activeProfileId: string;
  onSelectProfile: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onConnectXtream: (
    name: string,
    serverUrl: string,
    username: string,
    password: string,
    format: 'm3u8' | 'ts'
  ) => Promise<void>;
  onConnectM3uUrl: (name: string, m3uUrl: string) => Promise<void>;
  onConnectM3uFile: (name: string, rawContent: string) => Promise<void>;
  onLoadDemo: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  profiles,
  activeProfileId,
  onSelectProfile,
  onDeleteProfile,
  onConnectXtream,
  onConnectM3uUrl,
  onConnectM3uFile,
  onLoadDemo,
}) => {
  const [activeTab, setActiveTab] = useState<'xtream' | 'm3u' | 'profiles'>('xtream');

  // Estados Xtream Codes (Login e Senha)
  const [xtreamName, setXtreamName] = useState('Meu Servidor IPTV');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [streamFormat, setStreamFormat] = useState<'m3u8' | 'ts'>('m3u8');

  // Estados Lista M3U (Link ou Arquivo)
  const [m3uName, setM3uName] = useState('Minha Lista M3U');
  const [m3uUrl, setM3uUrl] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleXtreamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      setError('Preencha a URL do servidor, usuário e senha.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await onConnectXtream(xtreamName || 'Servidor Xtream', serverUrl, username, password, streamFormat);
      setSuccessMsg('Login Xtream Codes autenticado com sucesso!');
      setTimeout(() => onClose(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao autenticar no servidor Xtream Codes.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleM3uUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!m3uUrl.trim()) {
      setError('Informe a URL da lista .m3u ou .m3u8.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await onConnectM3uUrl(m3uName || 'Lista M3U Remota', m3uUrl);
      setSuccessMsg('Lista M3U carregada com sucesso!');
      setTimeout(() => onClose(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao baixar ou processar a lista M3U.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const content = await file.text();
      await onConnectM3uFile(file.name.replace(/\.(m3u8?|txt)$/i, ''), content);
      setSuccessMsg(`Arquivo "${file.name}" importado com sucesso!`);
      setTimeout(() => onClose(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ler arquivo M3U.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-xl bg-[#0e151d] border border-cyan-500/30 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#121b25]">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Central de Conexão IPTV — NextPlay
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Conecte via Login e Senha (Xtream Codes) ou Lista M3U / M3U8
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navegação de Abas */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-[#0a1016] border-b border-slate-800/80">
          <button
            onClick={() => {
              setActiveTab('xtream');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition ${
              activeTab === 'xtream'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-neon-cyan'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Login e Senha (Xtream)
          </button>

          <button
            onClick={() => {
              setActiveTab('m3u');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition ${
              activeTab === 'm3u'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-neon-cyan'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Link2 className="w-4 h-4" />
            Lista M3U / Arquivo
          </button>

          <button
            onClick={() => {
              setActiveTab('profiles');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition ${
              activeTab === 'profiles'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-neon-cyan'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Server className="w-4 h-4" />
            Perfis ({profiles.length})
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ABA 1: LOGIN E SENHA (XTREAM CODES) */}
          {activeTab === 'xtream' && (
            <form onSubmit={handleXtreamSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome do Perfil / Provedor
                </label>
                <input
                  type="text"
                  value={xtreamName}
                  onChange={(e) => setXtreamName(e.target.value)}
                  placeholder="Ex: IPTV Principal Casa"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d12] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  URL do Servidor (DNS / Host:Porta)
                </label>
                <div className="relative">
                  <Server className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://servidor.iptv.com:8080"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#090d12] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Usuário</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Seu usuário"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#090d12] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sua senha"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#090d12] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Formato de Transmissão Ao Vivo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStreamFormat('m3u8')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      streamFormat === 'm3u8'
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-[#090d12] border-slate-800 text-slate-400'
                    }`}
                  >
                    HLS Adaptativo (.m3u8) — Recomendado
                  </button>
                  <button
                    type="button"
                    onClick={() => setStreamFormat('ts')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      streamFormat === 'ts'
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-[#090d12] border-slate-800 text-slate-400'
                    }`}
                  >
                    MPEG-TS Direto (.ts) — Baixa Latência
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold text-sm hover:brightness-110 transition shadow-neon-cyan flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Autenticando e Sincronizando Catálogo...
                  </>
                ) : (
                  <>Conectar com Login e Senha</>
                )}
              </button>
            </form>
          )}

          {/* ABA 2: LISTA M3U / M3U8 (URL OU ARQUIVO LOCAL) */}
          {activeTab === 'm3u' && (
            <div className="space-y-5">
              <form onSubmit={handleM3uUrlSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome da Lista
                  </label>
                  <input
                    type="text"
                    value={m3uName}
                    onChange={(e) => setM3uName(e.target.value)}
                    placeholder="Ex: Canais Esportes & Filmes"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d12] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    URL da Lista M3U / M3U8
                  </label>
                  <input
                    type="url"
                    value={m3uUrl}
                    onChange={(e) => setM3uUrl(e.target.value)}
                    placeholder="http://servidor.com/get.php?username=...&password=...&type=m3u_plus"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d12] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold text-sm hover:brightness-110 transition shadow-neon-cyan flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Carregando Lista M3U...
                    </>
                  ) : (
                    <>Carregar Lista por URL</>
                  )}
                </button>
              </form>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800" />
                <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-slate-500">
                  Ou envie do seu dispositivo
                </span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-cyan-500/30 hover:border-cyan-400 rounded-2xl bg-[#090d12]/70 cursor-pointer transition group">
                <FileUp className="w-7 h-7 text-cyan-400 group-hover:scale-110 transition-transform mb-2" />
                <span className="text-xs font-semibold text-slate-200">
                  Selecionar arquivo .M3U ou .M3U8 local
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  Suporta listas gigantes (+50.000 canais) com carregamento instantâneo
                </span>
                <input
                  type="file"
                  accept=".m3u,.m3u8,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* ABA 3: PERFIS SALVOS & PLAYLIST DEMO */}
          {activeTab === 'profiles' && (
            <div className="space-y-3">
              {profiles.map((prof) => {
                const isCurrent = prof.id === activeProfileId;
                return (
                  <div
                    key={prof.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
                      isCurrent
                        ? 'bg-cyan-500/15 border-cyan-400/60'
                        : 'bg-[#090d12] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{prof.name}</span>
                        <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                          {prof.type === 'xtream'
                            ? 'Xtream Login'
                            : prof.type === 'demo'
                            ? 'Demo Oficial'
                            : 'Lista M3U'}
                        </span>
                      </div>
                      {prof.accountInfo && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          Status: <strong className="text-emerald-400">{prof.accountInfo.status}</strong> •
                          Expira: {prof.accountInfo.expDate} • Conexões: {prof.accountInfo.activeCons}/
                          {prof.accountInfo.maxConnections}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCurrent && (
                        <button
                          onClick={() => {
                            onSelectProfile(prof.id);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 transition"
                        >
                          Ativar
                        </button>
                      )}
                      {prof.type !== 'demo' && (
                        <button
                          onClick={() => onDeleteProfile(prof.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Remover perfil da lista"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  onLoadDemo();
                  onClose();
                }}
                className="w-full mt-2 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/20 transition"
              >
                Restaurar / Carregar Playlist de Demonstração Oficial NextPlay
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

