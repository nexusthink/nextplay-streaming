import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  User,
  Lock,
  Sparkles,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Minus,
  Square,
  X,
  Eye,
  EyeOff,
  Zap,
  RotateCcw,
  Mail,
  LogOut,
  CheckCircle2,
  Shield,
  Link2,
  RefreshCw,
} from 'lucide-react';
import { PublicAppConfig, PublicServerOption, UserAccount } from '../types/iptv';
import { getSavedGoogleAccounts } from '../services/authService';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
        };
      };
    };
  }
}

export type UpscalingMode = 'off' | 'hd' | '4k';
export type ZeroDelayMode = 'off' | 'equilibrado' | 'agressivo';

interface AuthPortalScreenProps {
  currentUser: UserAccount | null;
  servers: PublicServerOption[];
  appConfig: PublicAppConfig;
  autoConnectError?: string | null;
  isAutoConnecting?: boolean;
  upscaling: UpscalingMode;
  onChangeUpscaling: (mode: UpscalingMode) => void;
  zeroDelay: ZeroDelayMode;
  onChangeZeroDelay: (mode: ZeroDelayMode) => void;
  smartAudio: boolean;
  onChangeSmartAudio: (enabled: boolean) => void;
  onReplayIntro: () => void;
  onLoginEmail: (email: string, password: string) => Promise<void>;
  onRegisterEmail: (name: string, email: string, password: string) => Promise<void>;
  onLoginGoogle: (payload: {
    email?: string;
    name?: string;
    credential?: string;
  }) => Promise<void>;
  onLinkIptvAndConnect: (
    serverId: string,
    username: string,
    password: string
  ) => Promise<void>;
  onRetryAutoConnect?: () => Promise<void>;
  onLogoutAccount: () => void;
  onOpenAdminPanel: () => void;
  onEnterDemoMode: () => void;
}

export const AuthPortalScreen: React.FC<AuthPortalScreenProps> = ({
  currentUser,
  servers,
  appConfig,
  autoConnectError,
  isAutoConnecting = false,
  upscaling,
  onChangeUpscaling,
  zeroDelay,
  onChangeZeroDelay,
  smartAudio,
  onChangeSmartAudio,
  onReplayIntro,
  onLoginEmail,
  onRegisterEmail,
  onLoginGoogle,
  onLinkIptvAndConnect,
  onRetryAutoConnect,
  onLogoutAccount,
  onOpenAdminPanel,
  onEnterDemoMode,
}) => {
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Estado Etapa 1: Login ou Cadastro da Conta do Cliente
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [showAccountPass, setShowAccountPass] = useState(false);

  // Modal de Login com Google
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');

  // Estado Etapa 2: Seleção do Servidor (definido pelo Admin) + Usuário e Senha IPTV
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [iptvUsername, setIptvUsername] = useState('');
  const [iptvPassword, setIptvPassword] = useState('');
  const [showIptvPassword, setShowIptvPassword] = useState(false);

  // Status de carregamento e erros
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Autenticando...');
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Pré-seleciona o servidor padrão definido pelo Admin ou o já vinculado ao usuário
  useEffect(() => {
    if (currentUser?.iptvLink) {
      setSelectedServerId(currentUser.iptvLink.serverId);
      setIptvUsername(currentUser.iptvLink.username);
      setIptvPassword(currentUser.iptvLink.password);
      return;
    }
    if (servers.length > 0 && !selectedServerId) {
      const def = servers.find((s) => s.isDefault) || servers[0];
      if (def) setSelectedServerId(def.id);
    }
  }, [servers, currentUser, selectedServerId]);

  // Efeito de Ondas Sonoras Cyberpunk Interativas no Fundo
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

  // Submit Etapa 1: Login ou Registro por E-mail
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!accountEmail.trim() || !accountPassword.trim()) {
      setError('Informe seu e-mail e sua senha.');
      return;
    }

    setIsLoading(true);
    setLoadingText(
      authTab === 'login'
        ? 'Entrando na sua conta e verificando lista vinculada...'
        : 'Criando sua conta NextPlay...'
    );

    try {
      if (authTab === 'login') {
        await onLoginEmail(accountEmail.trim(), accountPassword);
      } else {
        await onRegisterEmail(
          accountName.trim() || accountEmail.split('@')[0],
          accountEmail.trim(),
          accountPassword
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autenticar conta.');
    } finally {
      setIsLoading(false);
    }
  };

  // Carrega a biblioteca oficial Google Identity Services se houver googleClientId configurado
  useEffect(() => {
    const clientId = appConfig.googleClientId?.trim();
    if (!clientId) return;
    if (document.getElementById('google-gsi-client-script')) return;
    const script = document.createElement('script');
    script.id = 'google-gsi-client-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [appConfig.googleClientId]);

  // Escuta o retorno da Janela Popup do Google (postMessage)
  useEffect(() => {
    const handlePopupMessage = async (event: MessageEvent) => {
      if (event.data?.type !== 'NEXTPLAY_GOOGLE_AUTH_SUCCESS') return;
      const { email, name, avatarUrl } = event.data;
      if (!email) return;

      setIsGoogleModalOpen(false);
      setIsLoading(true);
      setLoadingText('Autenticando com Google e verificando sua lista...');
      setError(null);
      try {
        await onLoginGoogle({
          email: String(email).trim(),
          name: String(name || email.split('@')[0]).trim(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha no login com Google.');
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handlePopupMessage);
    return () => window.removeEventListener('message', handlePopupMessage);
  }, [onLoginGoogle]);

  // Abre a Janela Popup Direta de Seleção de Conta Google
  const handleOpenGooglePopup = () => {
    setError(null);
    const clientId = appConfig.googleClientId?.trim();

    // 1. Se o Admin configurou um Google OAuth Client ID oficial, abre o popup nativo accounts.google.com
    if (clientId && window.google?.accounts?.oauth2) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          prompt: 'select_account',
          callback: async (tokenResponse) => {
            if (tokenResponse.error || !tokenResponse.access_token) {
              setError('Autenticação Google cancelada ou não autorizada.');
              return;
            }
            setIsLoading(true);
            setLoadingText('Vinculando sua conta Google...');
            try {
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              const profile = await userInfoRes.json();
              await onLoginGoogle({
                email: profile.email,
                name: profile.name || profile.given_name || profile.email?.split('@')[0],
              });
            } catch (err) {
              setError(
                err instanceof Error ? err.message : 'Erro ao obter dados da conta Google.'
              );
            } finally {
              setIsLoading(false);
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch {
        // Fallback para a janela popup direta abaixo
      }
    }

    // No aplicativo Android Nativo (Celular, Tablet, Android TV), WebViews não usam window.opener em popups externos
    const isAndroidWebView =
      Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
      /;\s*wv\)/i.test(navigator.userAgent);
    if (isAndroidWebView) {
      setIsGoogleModalOpen(true);
      return;
    }

    // 2. Abre a Janela Popup Externa Direta (estilo Seletor de Contas Google)
    const width = 450;
    const height = 580;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

    const popup = window.open(
      '',
      'NextPlayGoogleSignInPopup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no`
    );

    if (!popup) {
      // Caso o navegador bloqueie popups, abre o seletor na tela
      setIsGoogleModalOpen(true);
      return;
    }

    const savedAccounts = getSavedGoogleAccounts();
    const appTitle = (appConfig.appName || 'NextPlay').replace(/</g, '&lt;');

    const savedAccountsHtml = savedAccounts
      .map((acc) => {
        const initial = (acc.name || acc.email || 'G').trim().charAt(0).toUpperCase();
        const safeEmail = acc.email.replace(/"/g, '&quot;');
        const safeName = (acc.name || acc.email.split('@')[0]).replace(/"/g, '&quot;');
        return `
          <button type="button" class="acc-item" data-email="${safeEmail}" data-name="${safeName}">
            <div class="acc-avatar">${initial}</div>
            <div class="acc-info">
              <div class="acc-name">${safeName}</div>
              <div class="acc-email">${safeEmail}</div>
            </div>
          </button>
        `;
      })
      .join('');

    popup.document.open();
    popup.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Fazer login nas Contas do Google</title>
  <style>
    * { box-sizing: border-box; font-family: 'Segoe UI', Roboto, Arial, sans-serif; }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #202124;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .header {
      padding: 14px 24px;
      border-bottom: 1px solid #dadce0;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      color: #5f6368;
    }
    .container {
      flex: 1;
      padding: 32px 36px 24px;
      max-width: 450px;
      margin: 0 auto;
      width: 100%;
    }
    h1 {
      font-size: 24px;
      font-weight: 400;
      margin: 0 0 8px;
      color: #202124;
      text-align: center;
    }
    .subtitle {
      font-size: 16px;
      color: #202124;
      text-align: center;
      margin-bottom: 28px;
    }
    .subtitle strong {
      color: #1a73e8;
      font-weight: 500;
    }
    .acc-list {
      border-top: 1px solid #dadce0;
      margin-bottom: 16px;
    }
    .acc-item {
      width: 100%;
      background: none;
      border: none;
      border-bottom: 1px solid #dadce0;
      padding: 12px 8px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      text-align: left;
      transition: background 0.15s;
    }
    .acc-item:hover {
      background: #f8f9fa;
    }
    .acc-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #1a73e8;
      color: #fff;
      font-weight: 600;
      font-size: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .acc-name {
      font-size: 14px;
      font-weight: 500;
      color: #3c4043;
    }
    .acc-email {
      font-size: 12px;
      color: #5f6368;
    }
    .form-section {
      margin-top: 14px;
    }
    .field {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #5f6368;
      margin-bottom: 6px;
    }
    input {
      width: 100%;
      padding: 13px 15px;
      font-size: 15px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      outline: none;
      color: #202124;
    }
    input:focus {
      border-color: #1a73e8;
      box-shadow: 0 0 0 1px #1a73e8;
    }
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 24px;
    }
    .btn-cancel {
      background: none;
      border: none;
      color: #1a73e8;
      font-weight: 500;
      font-size: 14px;
      cursor: pointer;
      padding: 8px 12px;
      border-radius: 4px;
    }
    .btn-cancel:hover {
      background: #f1f3f4;
    }
    .btn-submit {
      background: #1a73e8;
      color: #fff;
      border: none;
      padding: 10px 24px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-submit:hover {
      background: #1557b0;
    }
    .footer-note {
      font-size: 12px;
      color: #5f6368;
      line-height: 1.5;
      margin-top: 28px;
      border-top: 1px solid #f1f3f4;
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="header">
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"/>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"/>
      <path fill="#FBBC05" d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"/>
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.9C3.5 21.4 7.4 24 12 24z"/>
    </svg>
    <span>Fazer login com o Google</span>
  </div>
  <div class="container">
    <h1>Escolha uma conta</h1>
    <div class="subtitle">para prosseguir para <strong>${appTitle}</strong></div>

    ${savedAccountsHtml ? `<div class="acc-list" id="savedList">${savedAccountsHtml}</div>` : ''}

    <form id="googleForm" class="form-section">
      <div class="field">
        <label>E-mail do Google (Gmail)</label>
        <input type="email" id="gEmail" required autocomplete="email" placeholder="seuemail@gmail.com" autofocus />
      </div>
      <div class="field">
        <label>Seu nome (opcional)</label>
        <input type="text" id="gName" autocomplete="name" placeholder="Seu nome" />
      </div>
      <div class="actions">
        <button type="button" class="btn-cancel" onclick="window.close()">Cancelar</button>
        <button type="submit" class="btn-submit">Continuar</button>
      </div>
    </form>

    <div class="footer-note">
      Para continuar, o Google compartilhará seu nome e endereço de e-mail com o aplicativo <strong>${appTitle}</strong> para vincular sua lista IPTV.
    </div>
  </div>
  <script>
    function finishLogin(email, name) {
      if (window.opener) {
        window.opener.postMessage({
          type: 'NEXTPLAY_GOOGLE_AUTH_SUCCESS',
          email: email,
          name: name || email.split('@')[0]
        }, '*');
      }
      window.close();
    }
    document.querySelectorAll('.acc-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        finishLogin(btn.getAttribute('data-email'), btn.getAttribute('data-name'));
      });
    });
    document.getElementById('googleForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var email = document.getElementById('gEmail').value.trim();
      var name = document.getElementById('gName').value.trim();
      if (!email) return;
      finishLogin(email, name);
    });
  </script>
</body>
</html>`);
    popup.document.close();
    popup.focus();
  };

  // Submit Login com Google (Fallback caso o navegador bloqueie popups)
  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail.trim() || !googleEmail.includes('@')) {
      setError('Informe um e-mail Google válido.');
      return;
    }
    setIsGoogleModalOpen(false);
    setIsLoading(true);
    setLoadingText('Autenticando com Google e verificando sua lista...');
    setError(null);
    try {
      await onLoginGoogle({
        email: googleEmail.trim(),
        name: googleName.trim() || googleEmail.split('@')[0],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login com Google.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Etapa 2: Vincular Servidor + Usuário e Senha IPTV
  const handleLinkIptvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedServerId) {
      setError('Selecione o servidor antes de continuar.');
      return;
    }
    if (!iptvUsername.trim() || !iptvPassword.trim()) {
      setError('Informe o Usuário e a Senha da sua lista IPTV.');
      return;
    }

    setIsLoading(true);
    setLoadingText('Validando acesso no servidor e vinculando lista à sua conta...');

    try {
      await onLinkIptvAndConnect(selectedServerId, iptvUsername.trim(), iptvPassword.trim());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível validar o usuário e senha neste servidor.'
      );
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

      {/* Header Superior */}
      <header
        className="h-14 px-5 flex items-center justify-between border-b border-cyan-500/15 bg-[#090e15]/85 backdrop-blur-xl z-20 shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div
          className="flex items-center gap-3"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="w-9 h-9 rounded-xl bg-[#0e1722] border border-cyan-400/40 flex items-center justify-center shadow-neon-cyan">
            <svg viewBox="0 0 40 40" className="w-6 h-6">
              <path d="M9 9 L23 20 L9 31 Z" fill="#0891b2" opacity="0.75" />
              <path d="M16 8 L32 20 L16 32 Z" fill="#00f2fe" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-black tracking-tight text-xl text-white">
              {appConfig.appName || 'NextPlay'}
            </span>
          </div>
        </div>

        <div
          className="flex items-center gap-2.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={onOpenAdminPanel}
            title="Abrir Painel Administrativo (/admin)"
            className="px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Painel Admin</span>
          </button>

          <button
            type="button"
            onClick={onReplayIntro}
            title="Repetir Abertura"
            className="px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Intro</span>
          </button>

          {appConfig.allowDemoMode && (
            <button
              type="button"
              onClick={onEnterDemoMode}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-teal-500/10 hover:from-cyan-500/30 hover:to-teal-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>Demonstração</span>
            </button>
          )}

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

      {/* Conteúdo Central */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-6 z-10 flex flex-col justify-center overflow-y-auto">
        {isAutoConnecting ? (
          /* TELA DE CARREGAMENTO AUTOMÁTICO DA LISTA VINCULADA */
          <div className="max-w-md mx-auto w-full bg-[#0b121a]/95 border border-cyan-500/30 rounded-3xl p-8 text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center mx-auto text-cyan-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-xl font-black text-white">Carregando sua Lista Vinculada</h2>
            <p className="text-xs text-slate-400">
              Olá, <strong className="text-white">{currentUser?.name}</strong>! Conectando
              automaticamente ao servidor{' '}
              <strong className="text-cyan-300">
                {currentUser?.iptvLink?.serverName || 'IPTV'}
              </strong>
              ...
            </p>
          </div>
        ) : !currentUser ? (
          /* ===================================================================
             ETAPA 1: LOGIN OU CADASTRO DE CONTA (E-MAIL OU GOOGLE)
          =================================================================== */
          <div className="max-w-md mx-auto w-full py-2">
            <div className="mb-6 text-center">
              <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-cyan-400 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Conta Unificada NextPlay
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {authTab === 'login' ? 'Entre na sua conta' : 'Crie sua conta grátis'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                Sua lista IPTV fica vinculada à sua conta. Entre com seu e-mail ou Google para
                carregar seus canais automaticamente.
              </p>
            </div>

            <div className="bg-[#0b121a]/95 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-500 opacity-80" />

              {/* Abas Entrar vs Criar Conta */}
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#060a0f] border border-slate-800/80 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('login');
                    setError(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    authTab === 'login'
                      ? 'bg-gradient-to-r from-cyan-500/25 to-teal-500/15 text-cyan-200 border border-cyan-400/50 shadow-neon-cyan'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  Entrar na Conta
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('register');
                    setError(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    authTab === 'register'
                      ? 'bg-gradient-to-r from-cyan-500/25 to-teal-500/15 text-cyan-200 border border-cyan-400/50 shadow-neon-cyan'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  Criar Nova Conta
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Botão Login com Google (Abre Janela Popup Direta do Google) */}
              <button
                type="button"
                disabled={isLoading}
                onClick={handleOpenGooglePopup}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-gray-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-2.5 transition shadow-md cursor-pointer mb-5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.9C3.5 21.4 7.4 24 12 24z"
                  />
                </svg>
                <span>Continuar com conta Google</span>
              </button>

              <div className="relative flex py-1 items-center mb-5">
                <div className="flex-grow border-t border-slate-800" />
                <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  ou com seu e-mail
                </span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              <form onSubmit={handleAccountSubmit} className="space-y-4">
                {authTab === 'register' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Seu Nome
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-cyan-400/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="Como podemos te chamar?"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#070d14] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-cyan-300 mb-1.5">
                    E-mail da Conta *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-cyan-400/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
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
                      type={showAccountPass ? 'text' : 'password'}
                      required
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#070d14] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccountPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-300 p-1 cursor-pointer"
                    >
                      {showAccountPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-300 text-slate-950 font-black text-sm tracking-wide uppercase hover:brightness-105 transition shadow-neon-cyan flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{loadingText}</span>
                    </>
                  ) : (
                    <>
                      <span>{authTab === 'login' ? 'Entrar na Conta' : 'Criar Minha Conta'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* ===================================================================
             ETAPA 2: CONTA LOGADA -> SELECIONAR SERVIDOR E INSERIR USUÁRIO/SENHA IPTV
          =================================================================== */
          <div className="max-w-xl mx-auto w-full py-2">
            {/* Barra da Conta Logada */}
            <div className="mb-5 p-4 rounded-2xl bg-[#0b121a]/90 border border-cyan-500/25 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 font-black text-base flex items-center justify-center">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{currentUser.name}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      {currentUser.provider === 'google' ? 'Conta Google' : 'Conta E-mail'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{currentUser.email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogoutAccount}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Trocar Conta
              </button>
            </div>

            {/* Cabeçalho Etapa 2 */}
            <div className="mb-5 text-center">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-emerald-400 mb-1">
                <Link2 className="w-3.5 h-3.5" />
                Vínculo Automático de Lista IPTV
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Vincule seu Acesso IPTV
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Selecione o seu servidor abaixo e digite seu usuário e senha IPTV. Sua lista ficará
                salva na sua conta para os próximos acessos.
              </p>
            </div>

            <div className="bg-[#0b121a]/95 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-500 opacity-80" />

              {(error || autoConnectError) && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{error || autoConnectError}</span>
                  </div>
                  {currentUser.iptvLink && onRetryAutoConnect && (
                    <button
                      type="button"
                      onClick={onRetryAutoConnect}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold shrink-0 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Tentar Novamente
                    </button>
                  )}
                </div>
              )}

              {servers.length === 0 ? (
                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-3">
                  <Server className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-sm font-bold text-amber-200">
                    Nenhum servidor IPTV ativo no momento
                  </p>
                  <p className="text-xs text-slate-400">
                    O administrador precisa cadastrar ou ativar ao menos um servidor no Painel
                    Admin.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenAdminPanel}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Abrir Painel Admin
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLinkIptvSubmit} className="space-y-5">
                  {/* SELETOR DE SERVIDOR DEFINIDO PELO ADMIN */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2">
                      1. Escolha o Servidor *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {servers.map((srv) => {
                        const isSelected = selectedServerId === srv.id;
                        return (
                          <button
                            key={srv.id}
                            type="button"
                            onClick={() => setSelectedServerId(srv.id)}
                            className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-500/15 border-cyan-400 shadow-neon-cyan'
                                : 'bg-[#070d14] border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-cyan-400 text-slate-950'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                <Server className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{srv.name}</p>
                                <p className="text-[10px] text-slate-400">
                                  {srv.region || 'Brasil'} • Online
                                </p>
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CREDENCIAIS DO USUÁRIO IPTV */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2">
                      2. Dados de Acesso da sua Lista *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Usuário IPTV
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-cyan-400/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            value={iptvUsername}
                            onChange={(e) => setIptvUsername(e.target.value)}
                            placeholder="Seu usuário"
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#070d14] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Senha IPTV
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-cyan-400/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type={showIptvPassword ? 'text' : 'password'}
                            required
                            value={iptvPassword}
                            onChange={(e) => setIptvPassword(e.target.value)}
                            placeholder="Sua senha"
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#070d14] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowIptvPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-300 p-1 cursor-pointer"
                          >
                            {showIptvPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-slate-950 font-black text-sm tracking-wide uppercase hover:brightness-105 transition shadow-neon-cyan flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{loadingText}</span>
                      </>
                    ) : (
                      <>
                        <span>Vincular Lista à Minha Conta e Entrar</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Opções Avançadas Recolhíveis (GPU, Latência, DSP) */}
              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-cyan-300 font-semibold py-1 transition cursor-pointer"
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
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
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
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
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
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
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

        {/* Rodapé de Status Hardware */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-slate-400 pt-6 mt-4 max-w-lg mx-auto">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Upscaling: <strong className="text-cyan-300 uppercase">{upscaling}</strong>
            </span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Buffer: <strong className="text-cyan-300 uppercase">{zeroDelay}</strong>
            </span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Smart DSP:{' '}
              <strong className="text-cyan-300">{smartAudio ? 'ATIVO' : 'DESLIGADO'}</strong>
            </span>
          </div>
        </div>
      </main>

      {/* MODAL DE LOGIN COM CONTA GOOGLE */}
      {isGoogleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111622] border border-white/15 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.9C3.5 21.4 7.4 24 12 24z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Fazer login com o Google</h3>
                  <p className="text-xs text-slate-400">Prosseguir para {appConfig.appName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGoogleModalOpen(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleGoogleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Seu E-mail do Google (Gmail) *
                </label>
                <input
                  type="email"
                  required
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  placeholder="seu.nome@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Seu Nome (Opcional)
                </label>
                <input
                  type="text"
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  placeholder="Ex: Guilherme"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGoogleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg shadow-blue-600/25 cursor-pointer"
                >
                  Continuar com Google
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
