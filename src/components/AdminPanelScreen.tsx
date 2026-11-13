import React, { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  Server,
  Users,
  Settings,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LogOut,
  ArrowLeft,
  Link2,
  Unlink,
  Lock,
  Unlock,
  KeyRound,
  Search,
  Eye,
  EyeOff,
  Star,
  Activity,
  Tv,
  AlertCircle,
  Check,
  Globe,
  Mail,
} from 'lucide-react';
import {
  AdminOverviewData,
  adminCreateServer,
  adminCreateUser,
  adminDeleteServer,
  adminDeleteUser,
  adminLogin,
  adminUpdateServer,
  adminUpdateSettings,
  adminUpdateUser,
  fetchAdminOverview,
  getAdminToken,
  setAdminToken,
} from '../services/authService';
import { AdminServerItem, UserAccount } from '../types/iptv';

interface AdminPanelScreenProps {
  onBackToApp: () => void;
  onConfigChanged?: () => void;
}

export const AdminPanelScreen: React.FC<AdminPanelScreenProps> = ({
  onBackToApp,
  onConfigChanged,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getAdminToken()));
  const [loginEmail, setLoginEmail] = useState('admin@nextplay.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'servers' | 'users' | 'settings'>('servers');

  // Server Modal State
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<AdminServerItem | null>(null);
  const [srvName, setSrvName] = useState('');
  const [srvDnsUrl, setSrvDnsUrl] = useState('');
  const [srvRegion, setSrvRegion] = useState('Brasil');
  const [srvFormat, setSrvFormat] = useState<'m3u8' | 'ts'>('m3u8');
  const [srvActive, setSrvActive] = useState(true);
  const [srvDefault, setSrvDefault] = useState(false);
  const [isSavingServer, setIsSavingServer] = useState(false);

  // User Search & Filter
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'linked' | 'unlinked' | 'blocked'>('all');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Create User Modal State
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserServerId, setNewUserServerId] = useState('');
  const [newUserIptvUsername, setNewUserIptvUsername] = useState('');
  const [newUserIptvPassword, setNewUserIptvPassword] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Edit User / Link IPTV Modal State
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserNewPassword, setEditUserNewPassword] = useState('');
  const [editUserServerId, setEditUserServerId] = useState('');
  const [editUserIptvUsername, setEditUserIptvUsername] = useState('');
  const [editUserIptvPassword, setEditUserIptvPassword] = useState('');

  // Settings State
  const [appName, setAppName] = useState('NextPlay');
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [allowDemoMode, setAllowDemoMode] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(msg);
      setErrorMsg(null);
    }
    setTimeout(() => {
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 4000);
  };

  const loadOverview = useCallback(async () => {
    if (!getAdminToken()) {
      setIsAuthenticated(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchAdminOverview();
      setOverview(data);
      setAppName(data.settings.appName || 'NextPlay');
      setSupportWhatsapp(data.settings.supportWhatsapp || '');
      setGoogleClientId(data.settings.googleClientId || '');
      setAllowDemoMode(data.settings.allowDemoMode !== false);
      setAdminEmail(data.settings.adminEmail || 'admin@nextplay.com');
      setAdminName(data.settings.adminName || 'Administrador');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar painel.';
      if (!getAdminToken()) {
        setIsAuthenticated(false);
      } else {
        showToast(message, true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadOverview();
    }
  }, [isAuthenticated, loadOverview]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      await adminLogin(loginEmail.trim(), loginPassword);
      setIsAuthenticated(true);
      setLoginPassword('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Falha na autenticação.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setAdminToken(null);
    setIsAuthenticated(false);
    setOverview(null);
  };

  // ==========================================================================
  // HANDLERS DE SERVIDORES
  // ==========================================================================
  const openNewServerModal = () => {
    setEditingServer(null);
    setSrvName('');
    setSrvDnsUrl('http://');
    setSrvRegion('Brasil');
    setSrvFormat('m3u8');
    setSrvActive(true);
    setSrvDefault((overview?.servers.length || 0) === 0);
    setIsServerModalOpen(true);
  };

  const openEditServerModal = (srv: AdminServerItem) => {
    setEditingServer(srv);
    setSrvName(srv.name);
    setSrvDnsUrl(srv.dnsUrl);
    setSrvRegion(srv.region || 'Brasil');
    setSrvFormat(srv.format || 'm3u8');
    setSrvActive(srv.active);
    setSrvDefault(Boolean(srv.isDefault));
    setIsServerModalOpen(true);
  };

  const handleSaveServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingServer(true);
    try {
      if (editingServer) {
        await adminUpdateServer(editingServer.id, {
          name: srvName,
          dnsUrl: srvDnsUrl,
          region: srvRegion,
          format: srvFormat,
          active: srvActive,
          isDefault: srvDefault,
        });
        showToast(`Servidor "${srvName}" atualizado com sucesso!`);
      } else {
        await adminCreateServer({
          name: srvName,
          dnsUrl: srvDnsUrl,
          region: srvRegion,
          format: srvFormat,
          active: srvActive,
          isDefault: srvDefault,
        });
        showToast(`Servidor "${srvName}" adicionado com sucesso!`);
      }
      setIsServerModalOpen(false);
      await loadOverview();
      onConfigChanged?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar servidor.', true);
    } finally {
      setIsSavingServer(false);
    }
  };

  const handleToggleServerActive = async (srv: AdminServerItem) => {
    try {
      await adminUpdateServer(srv.id, { active: !srv.active });
      showToast(`Servidor "${srv.name}" ${!srv.active ? 'ativado' : 'desativado'}.`);
      await loadOverview();
      onConfigChanged?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao alterar status.', true);
    }
  };

  const handleSetDefaultServer = async (srv: AdminServerItem) => {
    try {
      await adminUpdateServer(srv.id, { isDefault: true, active: true });
      showToast(`"${srv.name}" definido como servidor padrão.`);
      await loadOverview();
      onConfigChanged?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao definir padrão.', true);
    }
  };

  const handleDeleteServer = async (srv: AdminServerItem) => {
    if (!window.confirm(`Deseja realmente remover o servidor "${srv.name}"?`)) return;
    try {
      await adminDeleteServer(srv.id);
      showToast(`Servidor "${srv.name}" removido.`);
      await loadOverview();
      onConfigChanged?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir servidor.', true);
    }
  };

  // ==========================================================================
  // HANDLERS DE USUÁRIOS
  // ==========================================================================
  const openCreateUserModal = () => {
    const defaultSrv =
      overview?.servers.find((s) => s.isDefault)?.id || overview?.servers[0]?.id || '';
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserServerId(defaultSrv);
    setNewUserIptvUsername('');
    setNewUserIptvPassword('');
    setIsCreateUserModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingUser(true);
    try {
      await adminCreateUser({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        serverId: newUserIptvUsername ? newUserServerId : undefined,
        iptvUsername: newUserIptvUsername || undefined,
        iptvPassword: newUserIptvPassword || undefined,
      });
      showToast(`Usuário "${newUserEmail}" criado com sucesso!`);
      setIsCreateUserModalOpen(false);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar usuário.', true);
    } finally {
      setIsSavingUser(false);
    }
  };

  const openEditUserModal = (user: UserAccount) => {
    const defaultSrv =
      user.iptvLink?.serverId ||
      overview?.servers.find((s) => s.isDefault)?.id ||
      overview?.servers[0]?.id ||
      '';
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserNewPassword('');
    setEditUserServerId(defaultSrv);
    setEditUserIptvUsername(user.iptvLink?.username || '');
    setEditUserIptvPassword(user.iptvLink?.password || '');
  };

  const handleSaveEditedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingUser(true);
    try {
      const hasIptvFields =
        editUserServerId && editUserIptvUsername.trim() && editUserIptvPassword.trim();
      await adminUpdateUser(editingUser.id, {
        name: editUserName,
        email: editUserEmail,
        newPassword: editUserNewPassword.trim() || undefined,
        iptvLink: hasIptvFields
          ? {
              serverId: editUserServerId,
              username: editUserIptvUsername.trim(),
              password: editUserIptvPassword.trim(),
            }
          : null,
      });
      showToast(`Dados do usuário "${editUserEmail}" atualizados!`);
      setEditingUser(null);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar usuário.', true);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleUnlinkUserIptv = async (user: UserAccount) => {
    if (!window.confirm(`Desvincular a lista IPTV da conta de "${user.name}" (${user.email})?`)) {
      return;
    }
    try {
      await adminUpdateUser(user.id, { iptvLink: null });
      showToast(`Lista IPTV desvinculada de ${user.email}.`);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao desvincular lista.', true);
    }
  };

  const handleToggleUserStatus = async (user: UserAccount) => {
    const nextStatus = user.status === 'blocked' ? 'active' : 'blocked';
    try {
      await adminUpdateUser(user.id, { status: nextStatus });
      showToast(
        `Conta "${user.email}" ${nextStatus === 'blocked' ? 'bloqueada' : 'desbloqueada'}.`
      );
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao alterar status.', true);
    }
  };

  const handleDeleteUser = async (user: UserAccount) => {
    if (!window.confirm(`Excluir permanentemente a conta de "${user.name}" (${user.email})?`)) {
      return;
    }
    try {
      await adminDeleteUser(user.id);
      showToast(`Usuário "${user.email}" removido.`);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao remover usuário.', true);
    }
  };

  // ==========================================================================
  // HANDLERS DE CONFIGURAÇÕES
  // ==========================================================================
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await adminUpdateSettings({
        appName,
        supportWhatsapp,
        googleClientId,
        allowDemoMode,
        adminEmail,
        adminName,
        adminNewPassword: adminNewPassword.trim() || undefined,
      });
      setAdminNewPassword('');
      showToast('Configurações salvas com sucesso!');
      await loadOverview();
      onConfigChanged?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar configurações.', true);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ==========================================================================
  // RENDER: TELA DE LOGIN DO ADMIN
  // ==========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#07080d] text-white flex flex-col justify-center items-center px-4 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 20% 20%, rgba(229,9,20,0.16), transparent 45%), radial-gradient(circle at 80% 80%, rgba(59,130,246,0.12), transparent 45%)',
          }}
        />
        <div className="relative z-10 w-full max-w-md bg-[#10131c]/95 border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">NextPlay Admin</h1>
                <p className="text-xs text-gray-400">Gerenciamento de Servidores & Clientes</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              App
            </button>
          </div>

          {loginError && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                E-mail do Administrador
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                placeholder="admin@nextplay.com"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-red-600/25 cursor-pointer"
            >
              {isLoggingIn ? 'Autenticando...' : 'Entrar no Painel Admin'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
            <span>Credencial padrão local:</span>
            <button
              type="button"
              onClick={() => {
                setLoginEmail('admin@nextplay.com');
                setLoginPassword('admin123');
              }}
              className="text-red-400 hover:text-red-300 font-semibold underline cursor-pointer"
            >
              Preencher (admin123)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filtragem de usuários
  const filteredUsers = (overview?.users || []).filter((u) => {
    const q = userSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.iptvLink?.username || '').toLowerCase().includes(q) ||
      (u.iptvLink?.serverName || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (userFilter === 'linked') return Boolean(u.iptvLink);
    if (userFilter === 'unlinked') return !u.iptvLink;
    if (userFilter === 'blocked') return u.status === 'blocked';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#07080d] text-white flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#0c0e16]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/brand/logo-icon.png"
              alt="NextPlay"
              className="w-10 h-10 object-contain"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight">
                  {overview?.settings.appName || 'NextPlay'} • Painel Admin
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                  Web Admin
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Gerencie servidores DNS Xtream, contas de clientes e vínculos de listas IPTV
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href="/download/nextplay.apk"
              download="NextPlay-Universal-Mobile-TV.apk"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition-colors cursor-pointer"
              title="Baixar APK Universal para Celular, Tablet e Android TV"
            >
              <Tv className="w-3.5 h-3.5 text-emerald-400" />
              Baixar APK (Mobile/TV)
            </a>
            <button
              type="button"
              onClick={loadOverview}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-200 transition-colors cursor-pointer"
            >
              <Tv className="w-3.5 h-3.5 text-red-400" />
              Abrir Player
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-xs font-semibold text-red-300 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Notifications */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-sm text-red-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-sm text-emerald-200 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#10131c] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Servidores DNS</span>
              <Server className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-2xl font-black text-white">
              {overview?.stats.activeServers ?? 0}
              <span className="text-xs font-normal text-gray-400 ml-1.5">
                / {overview?.stats.totalServers ?? 0} ativos
              </span>
            </p>
          </div>

          <div className="bg-[#10131c] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Contas de Clientes</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black text-white">
              {overview?.stats.totalUsers ?? 0}
              <span className="text-xs font-normal text-gray-400 ml-1.5">
                ({overview?.stats.activeUsers ?? 0} ativos)
              </span>
            </p>
          </div>

          <div className="bg-[#10131c] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Listas IPTV Vinculadas</span>
              <Link2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400">
              {overview?.stats.linkedUsers ?? 0}
              <span className="text-xs font-normal text-gray-400 ml-1.5">clientes conectados</span>
            </p>
          </div>

          <div className="bg-[#10131c] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Streams Ativos Agora</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-white">
              {overview?.stats.activeStreams ?? 0}
              <span className="text-xs font-normal text-gray-400 ml-1.5">
                ({overview?.stats.totalMBTransferred ?? 0} MB)
              </span>
            </p>
          </div>
        </div>

        {/* Banner de Distribuição do APK (Celular, Tablet e Android TV) */}
        <div className="bg-gradient-to-r from-emerald-950/50 via-[#10131c] to-[#10131c] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Tv className="w-3.5 h-3.5" /> App Android Universal (Mobile & TV)
              </span>
              <span className="text-xs text-gray-400">NextPlay-Universal-Mobile-TV.apk</span>
            </div>
            <p className="text-xs text-gray-300">
              Link direto do APK hospedado neste painel (para enviar aos clientes ou digitar no app{' '}
              <strong className="text-white">Downloader</strong> na Android TV / TV Box):
            </p>
            <div className="inline-flex items-center gap-2 font-mono text-xs text-emerald-300 bg-black/50 border border-white/10 px-3 py-1.5 rounded-xl break-all">
              <span>{`${window.location.origin}/apk`}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/apk`);
                showToast('Link do APK copiado para a área de transferência!');
              }}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white transition cursor-pointer"
            >
              Copiar Link Curto (/apk)
            </button>
            <a
              href="/download/nextplay.apk"
              download="NextPlay-Universal-Mobile-TV.apk"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition cursor-pointer"
            >
              <Tv className="w-4 h-4" />
              Baixar APK Agora
            </a>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('servers')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'servers'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Server className="w-4 h-4" />
            Servidores IPTV ({overview?.servers.length ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Users className="w-4 h-4" />
            Usuários & Listas ({overview?.users.length ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Settings className="w-4 h-4" />
            Configurações do App
          </button>
        </div>

        {/* ===================================================================
            ABA 1: SERVIDORES DNS
        =================================================================== */}
        {activeTab === 'servers' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#10131c] border border-white/10 rounded-2xl p-5">
              <div>
                <h2 className="text-base font-bold text-white">
                  Servidores Xtream Codes (DNS Oculto para o Cliente)
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Cadastre quantos servidores desejar. Na tela de vínculo, o cliente vê apenas o{' '}
                  <strong className="text-gray-200">Nome do Servidor</strong> e digita o usuário e
                  senha IPTV dele.
                </p>
              </div>
              <button
                type="button"
                onClick={openNewServerModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Adicionar Servidor
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(overview?.servers || []).map((srv) => {
                const linkedCount = (overview?.users || []).filter(
                  (u) => u.iptvLink?.serverId === srv.id
                ).length;

                return (
                  <div
                    key={srv.id}
                    className={`rounded-2xl border p-5 transition-all ${
                      srv.active
                        ? 'bg-[#10131c] border-white/10'
                        : 'bg-[#0b0d14] border-white/5 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-white">{srv.name}</h3>
                          {srv.isDefault && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              <Star className="w-3 h-3 fill-amber-400" /> Padrão
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              srv.active
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                            }`}
                          >
                            {srv.active ? 'Ativo' : 'Inativo'}
                          </span>
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10">
                            {srv.region || 'Brasil'} • {(srv.format || 'm3u8').toUpperCase()}
                          </span>
                        </div>

                        <div className="mt-2.5 flex items-center gap-2 text-xs text-gray-300 font-mono bg-black/40 border border-white/5 px-3 py-2 rounded-xl break-all">
                          <Globe className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>{srv.dnsUrl}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-gray-400">
                        <strong className="text-white">{linkedCount}</strong>{' '}
                        {linkedCount === 1 ? 'cliente vinculado' : 'clientes vinculados'}
                      </span>

                      <div className="flex items-center gap-2">
                        {!srv.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultServer(srv)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition-colors cursor-pointer"
                            title="Tornar servidor padrão"
                          >
                            Tornar Padrão
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleServerActive(srv)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition-colors cursor-pointer"
                        >
                          {srv.active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditServerModal(srv)}
                          className="p-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 transition-colors cursor-pointer"
                          title="Editar servidor"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteServer(srv)}
                          className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 transition-colors cursor-pointer"
                          title="Excluir servidor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================
            ABA 2: USUÁRIOS E LISTAS VINCULADAS
        =================================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#10131c] border border-white/10 rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar por nome, e-mail, usuário IPTV ou servidor..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
                  {(
                    [
                      ['all', 'Todos'],
                      ['linked', 'Com Lista'],
                      ['unlinked', 'Sem Lista'],
                      ['blocked', 'Bloqueados'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setUserFilter(key)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        userFilter === key
                          ? 'bg-red-600 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={openCreateUserModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Novo Usuário
              </button>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="bg-[#10131c] border border-white/10 rounded-2xl p-10 text-center">
                <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-300">Nenhum usuário encontrado</p>
                <p className="text-xs text-gray-500 mt-1">
                  Os usuários criados pelo site ou cadastrados manualmente aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((u) => {
                  const showPass = Boolean(visiblePasswords[u.id]);
                  return (
                    <div
                      key={u.id}
                      className="bg-[#10131c] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      {/* Info da Conta */}
                      <div className="space-y-1.5 min-w-[240px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{u.name}</span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              u.provider === 'google'
                                ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            }`}
                          >
                            {u.provider === 'google' ? 'Google' : 'E-mail'}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              u.status === 'blocked'
                                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {u.status === 'blocked' ? 'Bloqueado' : 'Ativo'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Mail className="w-3.5 h-3.5 text-gray-500" />
                          <span>{u.email}</span>
                        </div>
                      </div>

                      {/* Info da Lista IPTV Vinculada */}
                      <div className="flex-1 bg-black/40 border border-white/5 rounded-xl p-3">
                        {u.iptvLink ? (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                                  <Link2 className="w-3.5 h-3.5" />
                                  {u.iptvLink.serverName}
                                </span>
                                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-white/5 text-gray-400">
                                  {(u.iptvLink.format || 'm3u8').toUpperCase()}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300 font-mono">
                                <span>
                                  Login: <strong className="text-white">{u.iptvLink.username}</strong>
                                </span>
                                <span className="flex items-center gap-1">
                                  Senha:{' '}
                                  <strong className="text-white">
                                    {showPass ? u.iptvLink.password : '••••••••'}
                                  </strong>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVisiblePasswords((prev) => ({
                                        ...prev,
                                        [u.id]: !prev[u.id],
                                      }))
                                    }
                                    className="text-gray-400 hover:text-white ml-1 cursor-pointer"
                                    title="Mostrar/ocultar senha IPTV"
                                  >
                                    {showPass ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUnlinkUserIptv(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold transition-colors cursor-pointer"
                              title="Desvincular lista desta conta"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                              Desvincular
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-amber-300/90 flex items-center gap-1.5">
                              <XCircle className="w-4 h-4 text-amber-400" />
                              Nenhuma lista IPTV vinculada a esta conta
                            </span>
                            <button
                              type="button"
                              onClick={() => openEditUserModal(u)}
                              className="text-xs font-bold text-red-400 hover:text-red-300 underline cursor-pointer"
                            >
                              Vincular Agora
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Ações do Usuário */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditUserModal(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Editar / Lista
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-colors cursor-pointer"
                          title={u.status === 'blocked' ? 'Desbloquear conta' : 'Bloquear conta'}
                        >
                          {u.status === 'blocked' ? (
                            <Unlock className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Lock className="w-4 h-4 text-amber-400" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 transition-colors cursor-pointer"
                          title="Excluir conta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            ABA 3: CONFIGURAÇÕES DO APP
        =================================================================== */}
        {activeTab === 'settings' && (
          <form
            onSubmit={handleSaveSettings}
            className="bg-[#10131c] border border-white/10 rounded-2xl p-6 space-y-6 max-w-3xl"
          >
            <div>
              <h2 className="text-base font-bold text-white">Configurações Gerais & Autenticação</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Personalize o nome do aplicativo, Google Login e credenciais de administrador.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Nome do Aplicativo
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  WhatsApp / Link de Suporte (Opcional)
                </label>
                <input
                  type="text"
                  value={supportWhatsapp}
                  onChange={(e) => setSupportWhatsapp(e.target.value)}
                  placeholder="https://wa.me/5511999999999"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Google OAuth Client ID — Único para Web, Celular e Android TV
              </label>
              <input
                type="text"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                placeholder="Ex: 123456789-abcdef.apps.googleusercontent.com"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
              />

              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-xs text-gray-300 space-y-2">
                <p className="font-bold text-cyan-300">
                  Como usar 1 ÚNICO Client ID no Google Cloud para Web + Celular + TV:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-300">
                  <li>
                    No Google Cloud Console (<strong>Credenciais &rarr; Criar ID do cliente OAuth</strong>),
                    escolha <strong>APENAS</strong> o tipo <strong>&quot;Aplicativo da Web&quot;</strong> (não crie tipo Android nem TV, pois nosso APK Android/TV usa motor Web unificado).
                  </li>
                  <li>
                    Dentro desse único Client ID Web, adicione em{' '}
                    <strong>Origens JavaScript autorizadas</strong> e em{' '}
                    <strong>URIs de redirecionamento autorizados</strong> estas URLs:
                  </li>
                </ol>
                <div className="grid grid-cols-1 gap-1.5 pt-1 font-mono text-[11px]">
                  <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-emerald-300 flex items-center justify-between">
                    <span>https://nextplay.vps9818.panel.icontainer.run</span>
                    <span className="text-[10px] text-gray-400 font-sans">
                      (Domínio HTTPS oficial da sua VPS — aceito pelo Google!)
                    </span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-emerald-300 flex items-center justify-between">
                    <span>http://localhost</span>
                    <span className="text-[10px] text-gray-400 font-sans">
                      (Faz funcionar no APK Celular, Tablet e Android TV)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/10">
              <div>
                <p className="text-sm font-semibold text-white">Permitir Modo Demonstração</p>
                <p className="text-xs text-gray-400">
                  Exibe um botão para testar o catálogo de demonstração caso o usuário não tenha
                  login IPTV.
                </p>
              </div>
              <input
                type="checkbox"
                checked={allowDemoMode}
                onChange={(e) => setAllowDemoMode(e.target.checked)}
                className="w-5 h-5 accent-red-600 rounded cursor-pointer"
              />
            </div>

            <div className="pt-4 border-t border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-red-400" />
                Credenciais do Administrador (/admin)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    E-mail do Admin
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Nova Senha do Admin (deixe vazio para manter)
                  </label>
                  <input
                    type="password"
                    value={adminNewPassword}
                    onChange={(e) => setAdminNewPassword(e.target.value)}
                    placeholder="Nova senha..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-red-600/25 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {isSavingSettings ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* =====================================================================
          MODAL: ADICIONAR / EDITAR SERVIDOR DNS
      ===================================================================== */}
      {isServerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121621] border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingServer ? 'Editar Servidor IPTV' : 'Novo Servidor IPTV'}
              </h3>
              <button
                type="button"
                onClick={() => setIsServerModalOpen(false)}
                className="text-xs text-gray-400 hover:text-white cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSaveServer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Nome de Exibição para o Cliente
                </label>
                <input
                  type="text"
                  value={srvName}
                  onChange={(e) => setSrvName(e.target.value)}
                  required
                  placeholder="Ex: Servidor Principal 01 (Brasil)"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  URL / DNS do Servidor Xtream Codes (Oculto para o cliente)
                </label>
                <input
                  type="url"
                  value={srvDnsUrl}
                  onChange={(e) => setSrvDnsUrl(e.target.value)}
                  required
                  placeholder="http://dns-do-servidor.com:80"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Região / Selo
                  </label>
                  <input
                    type="text"
                    value={srvRegion}
                    onChange={(e) => setSrvRegion(e.target.value)}
                    placeholder="Brasil"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Formato Ao Vivo
                  </label>
                  <select
                    value={srvFormat}
                    onChange={(e) => setSrvFormat(e.target.value as 'm3u8' | 'ts')}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="m3u8">HLS (.m3u8)</option>
                    <option value="ts">MPEG-TS (.ts)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={srvActive}
                    onChange={(e) => setSrvActive(e.target.checked)}
                    className="w-4 h-4 accent-red-600 rounded"
                  />
                  Servidor Ativo (visível para clientes)
                </label>

                <label className="inline-flex items-center gap-2 text-xs text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={srvDefault}
                    onChange={(e) => setSrvDefault(e.target.checked)}
                    className="w-4 h-4 accent-red-600 rounded"
                  />
                  Pré-selecionado por padrão
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsServerModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingServer}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-lg shadow-red-600/25 cursor-pointer"
                >
                  {isSavingServer ? 'Salvando...' : 'Salvar Servidor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CRIAR NOVO USUÁRIO
      ===================================================================== */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121621] border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Criar Conta de Cliente</h3>
              <button
                type="button"
                onClick={() => setIsCreateUserModalOpen(false)}
                className="text-xs text-gray-400 hover:text-white cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  required
                  placeholder="Ex: João Silva"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    E-mail de Acesso
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                    placeholder="cliente@email.com"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Senha da Conta
                  </label>
                  <input
                    type="text"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    required
                    placeholder="Mínimo 4 caracteres"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Vincular Lista IPTV Inicial (Opcional)
                </p>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Servidor</label>
                  <select
                    value={newUserServerId}
                    onChange={(e) => setNewUserServerId(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    {(overview?.servers || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.dnsUrl})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Usuário IPTV</label>
                    <input
                      type="text"
                      value={newUserIptvUsername}
                      onChange={(e) => setNewUserIptvUsername(e.target.value)}
                      placeholder="Opcional"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Senha IPTV</label>
                    <input
                      type="text"
                      value={newUserIptvPassword}
                      onChange={(e) => setNewUserIptvPassword(e.target.value)}
                      placeholder="Opcional"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-lg shadow-red-600/25 cursor-pointer"
                >
                  {isSavingUser ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: EDITAR USUÁRIO / VINCULAR LISTA IPTV
      ===================================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121621] border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Gerenciar Cliente & Lista IPTV</h3>
                <p className="text-xs text-gray-400">{editingUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-xs text-gray-400 hover:text-white cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSaveEditedUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    required
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    required
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Redefinir Senha da Conta (deixe em branco para manter)
                </label>
                <input
                  type="text"
                  value={editUserNewPassword}
                  onChange={(e) => setEditUserNewPassword(e.target.value)}
                  placeholder="Nova senha de login no app..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Lista IPTV Vinculada à Conta
                  </p>
                  {editUserIptvUsername && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditUserIptvUsername('');
                        setEditUserIptvPassword('');
                      }}
                      className="text-[11px] text-red-400 hover:underline cursor-pointer"
                    >
                      Limpar campos (Desvincular)
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Servidor Selecionado</label>
                  <select
                    value={editUserServerId}
                    onChange={(e) => setEditUserServerId(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    {(overview?.servers || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.dnsUrl})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Usuário IPTV</label>
                    <input
                      type="text"
                      value={editUserIptvUsername}
                      onChange={(e) => setEditUserIptvUsername(e.target.value)}
                      placeholder="Usuário Xtream"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Senha IPTV</label>
                    <input
                      type="text"
                      value={editUserIptvPassword}
                      onChange={(e) => setEditUserIptvPassword(e.target.value)}
                      placeholder="Senha Xtream"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-lg shadow-red-600/25 cursor-pointer"
                >
                  {isSavingUser ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
