import React, { useState, useEffect, useRef } from 'react';
import {
  KeyRound,
  Link2,
  FileUp,
  Server,
  User,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Tv,
  Minus,
  Square,
  X,
  Eye,
  EyeOff,
  Zap,
  Activity,
  RotateCcw,
  Radio,
  PlusCircle,
  ArrowLeft,
} from 'lucide-react';
import { PlaylistProfile } from '../types/iptv';

export type UpscalingMode = 'off' | 'hd' | '4k';
export type ZeroDelayMode = 'off' | 'equilibrado' | 'agressivo';

interface AuthPortalScreenProps {
  profiles: PlaylistProfile[];
  upscaling: UpscalingMode;
  onChangeUpscaling: (mode: UpscalingMode) => void;
  zeroDelay: ZeroDelayMode;
  onChangeZeroDelay: (mode: ZeroDelayMode) => void;
  smartAudio: boolean;
  onChangeSmartAudio: (enabled: boolean) => void;
  onReplayIntro: () => void;
  onConnectXtream: (
    name: string,
    serverUrl: string,
    username: string,
    password: string,
    format: 'm3u8' | 'ts'
  ) => Promise<void>;
  onConnectM3uUrl: (name: string, m3uUrl: string) => Promise<void>;
  onConnectM3uFile: (name: string, rawContent: string) => Promise<void>;
  onSelectSavedProfile: (profile: PlaylistProfile) => Promise<void>;
  onDeleteProfile: (profileId: string) => void;
  onEnterDemoMode: () => void;
}

export const AuthPortalScreen: React.FC<AuthPortalScreenProps> = ({
  profiles,
  upscaling,
  onChangeUpscaling,
  zeroDelay,
  onChangeZeroDelay,
  smartAudio,
  onChangeSmartAudio,
  onReplayIntro,
  onConnectXtream,
  onConnectM3uUrl,
  onConnectM3uFile,
  onSelectSavedProfile,
  onDeleteProfile,
  onEnterDemoMode,
}) => {
  const [activeMode, setActiveMode] = useState<'xtream' | 'm3u_url' | 'm3u_file'>('xtream');
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Campos Login e Senha (Xtream Codes)
  const [xtreamName, setXtreamName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [streamFormat, setStreamFormat] = useState<'m3u8' | 'ts'>('m3u8');

  // Campos Lista M3U
  const [m3uName, setM3uName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');

  // Status de carregamento e erros
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Sincronizando com o motor Express...');
  const [error, setError] = useState<string | null>(null);

  const userProfiles = profiles.filter((p) => p.type !== 'demo');
  // Sempre prioriza a tela de Perfis estilo Netflix / Streaming
  const [viewState, setViewState] = useState<'profiles' | 'form'>('profiles');
  const [isManagingProfiles, setIsManagingProfiles] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  useEffect(() => {
    if (userProfiles.length === 0 && viewState === 'profiles') {
      setViewState('form');
    }
  }, [userProfiles.length, viewState]);

  // Efeito de Ondas Sonoras Cyberpunk Interativas no Fundo do Command Deck
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // 3 ondas harmônicas suaves de áudio no rodapé
      const lines = [
        { color: 'rgba(0, 242, 254, 0.16)', amp: 24 * dpr, freq: 0.003, speed: 0.002 },
        { color: 'rgba(16, 185, 129, 0.12)', amp: 18 * dpr, freq: 0.0045, speed: -0.0015 },
        { color: 'rgba(139, 92, 246, 0.10)', amp: 30 * dpr, freq: 0.0022, speed: 0.001 },
      ];

      for (const l of lines) {
        ctx.beginPath();
        ctx.strokeStyle = l.color;
        ctx.lineWidth = 2 * dpr;
        for (let x = 0; x <= w; x += 12 * dpr) {
          const y =
            h * 0.86 +
            Math.sin(x * l.freq + t * l.speed) * l.amp +
            Math.cos(x * l.freq * 0.5 - t * l.speed) * (l.amp * 0.5);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleXtreamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      setError('Preencha a URL do Servidor (DNS), o Usuário e a Senha.');
      return;
    }

    setIsLoading(true);
    setLoadingText('Autenticando via Xtream Engine e indexando catálogo...');
    setError(null);

    try {
      const profileTitle = xtreamName.trim() || `NextPlay (${username.trim()})`;
      await onConnectXtream(profileTitle, serverUrl, username, password, streamFormat);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha na autenticação Xtream Codes. Verifique o DNS, usuário e senha.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleM3uUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!m3uUrl.trim()) {
      setError('Informe a URL da sua playlist .M3U ou .M3U8.');
      return;
    }

    setIsLoading(true);
    setLoadingText('Baixando playlist via Micro-Servidor Express...');
    setError(null);

    try {
      const profileTitle = m3uName.trim() || `Playlist #${userProfiles.length + 1}`;
      await onConnectM3uUrl(profileTitle, m3uUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar a URL M3U. Verifique se o link está online.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setLoadingText(`Indexando canais de "${file.name}" em memória...`);
    setError(null);

    try {
      const text = await file.text();
      const cleanName = m3uName.trim() || file.name.replace(/\.(m3u8?|txt)$/i, '');
      await onConnectM3uFile(cleanName, text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo M3U.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavedProfileClick = async (prof: PlaylistProfile) => {
    setIsLoading(true);
    setLoadingText(`Inicializando slot "${prof.name}"...`);
    setError(null);
    try {
      await onSelectSavedProfile(prof);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar no slot salvo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#06090e] text-slate-100 flex flex-col justify-between relative overflow-x-hidden select-none">
      {/* Canvas de Ondas Sonoras Cyberpunk */}
      <canvas ref={bgCanvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-0" />

      {/* Luzes de Ambiência */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-36 left-1/4 w-[480px] h-[480px] rounded-full bg-cyan-500/10 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[420px] h-[420px] rounded-full bg-teal-500/10 blur-[150px]" />
      </div>

      {/* Header Superior Customizado com Prisma Duplo NextPlay */}
      <header
        className="h-14 px-5 flex items-center justify-between border-b border-cyan-500/15 bg-[#090e15]/85 backdrop-blur-xl z-20 shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div
          className="flex items-center gap-3"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Emblema Duplo Prisma NextPlay */}
          <div className="w-9 h-9 rounded-xl bg-[#0e1722] border border-cyan-400/40 flex items-center justify-center shadow-neon-cyan">
            <svg viewBox="0 0 40 40" className="w-6 h-6">
              <path d="M9 9 L23 20 L9 31 Z" fill="#0891b2" opacity="0.75" />
              <path d="M16 8 L32 20 L16 32 Z" fill="#00f2fe" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-black tracking-tight text-xl text-white">Next</span>
            <span className="font-black tracking-tight text-xl bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">Play</span>
          </div>
        </div>

        <div
          className="flex items-center gap-2.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={onReplayIntro}
            title="Repetir Abertura"
            className="px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Intro</span>
          </button>

          <button
            type="button"
            onClick={onEnterDemoMode}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-teal-500/10 hover:from-cyan-500/30 hover:to-teal-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>Demonstração</span>
          </button>

          <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-slate-800 text-slate-400">
            <button
              onClick={() => window.nextplayDesktop?.minimize()}
              title="Minimizar"
              className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => window.nextplayDesktop?.toggleMaximize()}
              title="Maximizar"
              className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={() => window.nextplayDesktop?.close()}
              title="Fechar"
              className="p-1.5 hover:text-rose-400 hover:bg-rose-500/15 rounded-lg transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Cockpit Principal NextPlay */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 z-10 flex flex-col justify-center overflow-y-auto">
        {viewState === 'profiles' ? (
          /* MODO SELEÇÃO DE PERFIL ESTILO NETFLIX / STREAMING */
          <div className="flex-1 flex flex-col justify-center items-center py-4 sm:py-8 max-w-4xl mx-auto w-full">
            {/* Header da Seleção de Perfis */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-cyan-400 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                NextPlay Profile Gateway
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md">
                Quem está assistindo?
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto">
                Selecione seu perfil para acessar o catálogo de canais, filmes e séries instantaneamente.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5 max-w-md">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Grid dos Perfis Estilo Netflix / Streaming */}
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 max-w-4xl mx-auto mb-10">
              {userProfiles.map((prof, idx) => {
                const gradients = [
                  'from-cyan-400 via-teal-500 to-blue-600',
                  'from-fuchsia-500 via-purple-600 to-indigo-700',
                  'from-emerald-400 via-teal-500 to-cyan-600',
                  'from-amber-400 via-orange-500 to-rose-600',
                ];
                const bgGrad = gradients[idx % gradients.length];
                const initial = prof.name ? prof.name.trim().charAt(0).toUpperCase() : 'P';

                return (
                  <div
                    key={prof.id}
                    onClick={() => !isLoading && handleSavedProfileClick(prof)}
                    className="group relative w-44 sm:w-52 h-64 sm:h-72 rounded-2xl bg-[#0b121b]/90 border border-slate-800 hover:border-cyan-400 p-5 flex flex-col items-center justify-between transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 hover:shadow-[0_16px_40px_rgba(0,242,254,0.35)] cursor-pointer overflow-hidden backdrop-blur-xl"
                  >
                    {/* Linha Neon Superior no Hover */}
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Botão de Excluir Perfil */}
                    {isManagingProfiles && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProfile(prof.id);
                        }}
                        className="absolute top-3 right-3 p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 transition z-10"
                        title="Remover Perfil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Avatar do Perfil */}
                    <div className="flex flex-col items-center mt-2">
                      <div
                        className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br ${bgGrad} flex items-center justify-center text-4xl sm:text-5xl font-black text-white shadow-xl border border-white/20 group-hover:scale-105 group-hover:rotate-1 transition-all duration-300`}
                      >
                        {initial}
                      </div>

                      {/* Nome do Perfil */}
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-300 transition line-clamp-1 text-center mt-3">
                        {prof.name}
                      </h3>

                      {/* Badge Xtream / M3U */}
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 mt-1">
                        {prof.type === 'xtream' ? 'Xtream Codes' : 'Lista M3U'}
                      </span>
                    </div>

                    {/* Botão Acessar Perfil */}
                    <div className="w-full">
                      <button
                        type="button"
                        disabled={isLoading}
                        className="w-full py-2 rounded-xl bg-[#101822] group-hover:bg-cyan-400 text-slate-300 group-hover:text-slate-950 text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-700/60 group-hover:border-cyan-400 shadow-neon-cyan"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <span>Entrar</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Card "+ Adicionar Perfil" */}
              <div
                onClick={() => setViewState('form')}
                className="group w-44 sm:w-52 h-64 sm:h-72 rounded-2xl border-2 border-dashed border-slate-700/80 hover:border-cyan-400/80 bg-[#070c12]/60 hover:bg-cyan-500/10 p-5 flex flex-col items-center justify-center transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 cursor-pointer backdrop-blur-xl"
              >
                <div className="w-20 h-20 rounded-2xl bg-slate-800/80 group-hover:bg-cyan-500/20 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-cyan-300 transition-all mb-3 group-hover:scale-105">
                  <PlusCircle className="w-10 h-10" />
                </div>
                <span className="text-sm font-bold text-slate-300 group-hover:text-white transition">
                  Adicionar Perfil
                </span>
                <span className="text-[10px] text-slate-500 text-center mt-1 font-mono">
                  Novo Login ou Lista
                </span>
              </div>
            </div>

            {/* Ações Inferiores da Seleção de Perfil */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <button
                type="button"
                onClick={() => setIsManagingProfiles(!isManagingProfiles)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                  isManagingProfiles
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : 'bg-[#101822] text-slate-400 hover:text-white border-slate-800 hover:border-slate-700'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isManagingProfiles ? 'Concluir Gerenciamento' : 'Gerenciar Perfis'}</span>
              </button>

              <button
                type="button"
                onClick={onEnterDemoMode}
                className="px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Entrar em Demonstração</span>
              </button>
            </div>

            {/* Configurações Rápidas de GPU / DSP no Rodapé do Perfil */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-slate-400 pt-4 border-t border-slate-800/60 w-full max-w-lg">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Upscaling: <strong className="text-cyan-300 uppercase">{upscaling}</strong></span>
              </div>
              <span className="text-slate-700">•</span>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Buffer: <strong className="text-cyan-300 uppercase">{zeroDelay}</strong></span>
              </div>
              <span className="text-slate-700">•</span>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Smart DSP: <strong className="text-cyan-300">{smartAudio ? 'ATIVO' : 'DESLIGADO'}</strong></span>
              </div>
            </div>
          </div>
        ) : (
          /* MODO FORMULÁRIO (NOVA CONEXÃO / ADICIONAR PERFIL) - DESIGN LIMPO & MODERNO */
          <div className="max-w-2xl mx-auto w-full py-2">
            {/* Botão de Retorno para Seleção de Perfis */}
            <div className="mb-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewState('profiles')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white text-xs font-semibold transition border border-slate-700/80 group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span>Voltar para Perfis</span>
              </button>

              <button
                type="button"
                onClick={onEnterDemoMode}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold transition border border-cyan-400/30 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Testar Modo Demonstração</span>
              </button>
            </div>

            {/* Cabeçalho do Formulário */}
            <div className="mb-6 text-center">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Adicionar Nova Conexão
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
                Insira os dados do seu provedor Xtream Codes ou envie sua lista M3U para carregar o catálogo completo.
              </p>
            </div>

            {/* Card do Formulário */}
            <div className="bg-[#0b121a]/95 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-500 opacity-80" />

              {/* Abas de Conexão */}
              <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-[#060a0f] border border-slate-800/80 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('xtream');
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                    activeMode === 'xtream'
                      ? 'bg-gradient-to-r from-cyan-500/25 to-teal-500/15 text-cyan-200 border border-cyan-400/50 shadow-neon-cyan'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Login & Senha</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('m3u_url');
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                    activeMode === 'm3u_url'
                      ? 'bg-gradient-to-r from-cyan-500/25 to-teal-500/15 text-cyan-200 border border-cyan-400/50 shadow-neon-cyan'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Link M3U</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('m3u_file');
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                    activeMode === 'm3u_file'
                      ? 'bg-gradient-to-r from-cyan-500/25 to-teal-500/15 text-cyan-200 border border-cyan-400/50 shadow-neon-cyan'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <FileUp className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Arquivo M3U</span>
                </button>
              </div>

              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* MODO 01: XTREAM CODES LOGIN E SENHA */}
              {activeMode === 'xtream' && (
                <form onSubmit={handleXtreamSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                    <div className="sm:col-span-5">
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Nome do Perfil
                      </label>
                      <input
                        type="text"
                        value={xtreamName}
                        onChange={(e) => setXtreamName(e.target.value)}
                        placeholder="Ex: Minha Conta"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#070d14] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition"
                      />
                    </div>

                    <div className="sm:col-span-7">
                      <label className="block text-xs font-semibold text-cyan-300 mb-1.5">
                        Servidor (URL / Host) *
                      </label>
                      <div className="relative">
                        <Server className="w-4 h-4 text-cyan-400/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={serverUrl}
                          onChange={(e) => setServerUrl(e.target.value)}
                          placeholder="http://servidor.com:8080"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#070d14] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-cyan-300 mb-1.5">
                        Usuário *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-cyan-400/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Seu usuário"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#070d14] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-cyan-300 mb-1.5">
                        Senha *
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-cyan-400/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Sua senha"
                          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#070d14] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-300 p-1"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-400">Formato da Transmissão</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStreamFormat('m3u8')}
                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition ${
                          streamFormat === 'm3u8'
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                            : 'bg-[#070d14] border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        HLS (.m3u8)
                      </button>
                      <button
                        type="button"
                        onClick={() => setStreamFormat('ts')}
                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition ${
                          streamFormat === 'ts'
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                            : 'bg-[#070d14] border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        TS Raw (.ts)
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-300 text-slate-950 font-black text-sm tracking-wide uppercase hover:brightness-105 transition shadow-neon-cyan flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{loadingText}</span>
                      </>
                    ) : (
                      <>
                        <span>Conectar e Acessar Catálogo</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* MODO 02: LINK REMOTO M3U */}
              {activeMode === 'm3u_url' && (
                <form onSubmit={handleM3uUrlSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Nome do Perfil
                    </label>
                    <input
                      type="text"
                      value={m3uName}
                      onChange={(e) => setM3uName(e.target.value)}
                      placeholder="Ex: Minha Lista de Canais"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070d14] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-cyan-300 mb-1.5">
                      URL da Playlist (.M3U / .M3U8) *
                    </label>
                    <div className="relative">
                      <Link2 className="w-4 h-4 text-cyan-400/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="url"
                        required
                        value={m3uUrl}
                        onChange={(e) => setM3uUrl(e.target.value)}
                        placeholder="http://servidor.com/get.php?username=...&password=..."
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#070d14] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-300 text-slate-950 font-black text-sm tracking-wide uppercase hover:brightness-105 transition shadow-neon-cyan flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{loadingText}</span>
                      </>
                    ) : (
                      <>
                        <span>Carregar Playlist e Acessar</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* MODO 03: ARQUIVO M3U LOCAL */}
              {activeMode === 'm3u_file' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Nome do Perfil (Opcional)
                    </label>
                    <input
                      type="text"
                      value={m3uName}
                      onChange={(e) => setM3uName(e.target.value)}
                      placeholder="Ex: Minha Lista Local"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070d14] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition"
                    />
                  </div>

                  <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-cyan-500/30 hover:border-cyan-400 rounded-2xl bg-[#070d14] cursor-pointer transition group text-center">
                    {isLoading ? (
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                    ) : (
                      <FileUp className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition-transform mb-2" />
                    )}
                    <span className="text-sm font-bold text-white">
                      {isLoading ? loadingText : 'Clique ou arraste um arquivo .M3U / .M3U8'}
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      Carregamento ultra-rápido otimizado para catálogos com milhares de canais
                    </span>
                    <input
                      type="file"
                      accept=".m3u,.m3u8,.txt"
                      onChange={handleFileChange}
                      disabled={isLoading}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Opções Avançadas Recolhíveis (GPU, Latência, DSP) */}
              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-cyan-300 font-semibold py-1 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    Preferências de Vídeo & Áudio (Opcional)
                  </span>
                  <span>{showAdvancedSettings ? '▲ Ocultar' : '▼ Expandir'}</span>
                </button>

                {showAdvancedSettings && (
                  <div className="mt-4 space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Upscaling de Vídeo (GPU):</span>
                      <div className="flex items-center gap-1">
                        {(['off', 'hd', '4k'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => onChangeUpscaling(m)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                              upscaling === m
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                                : 'bg-[#070d14] border-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {m.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Latência do Buffer ao Vivo:</span>
                      <div className="flex items-center gap-1">
                        {(['off', 'equilibrado', 'agressivo'] as const).map((z) => (
                          <button
                            key={z}
                            type="button"
                            onClick={() => onChangeZeroDelay(z)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition ${
                              zeroDelay === z
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                                : 'bg-[#070d14] border-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {z === 'off' ? 'PADRÃO' : z === 'equilibrado' ? 'EQUILIBRADO' : 'ULTRA'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Áudio Normalizer DSP:</span>
                      <button
                        type="button"
                        onClick={() => onChangeSmartAudio(!smartAudio)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                          smartAudio
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-[#070d14] border-slate-800 text-slate-500'
                        }`}
                      >
                        {smartAudio ? 'ATIVADO' : 'DESLIGADO'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
