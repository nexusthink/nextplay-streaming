import {
  AdminServerItem,
  PublicAppConfig,
  PublicServerOption,
  UserAccount,
  UserSubProfile,
  WatchHistoryItem,
  XtreamAccountInfo,
} from '../types/iptv';

export const AUTH_STORAGE_KEYS = {
  USER_TOKEN: 'nextplay_user_token_v1',
  ADMIN_TOKEN: 'nextplay_admin_token_v1',
  LOCAL_DB_FALLBACK: 'nextplay_local_db_fallback_v1',
  GOOGLE_SAVED_ACCOUNTS: 'nextplay_google_accounts_v1',
};

interface LocalFallbackDb {
  settings: PublicAppConfig & {
    adminEmail: string;
    adminName: string;
    adminPassword: string;
  };
  servers: AdminServerItem[];
  users: (UserAccount & { password?: string })[];
}

function getLocalFallbackDb(): LocalFallbackDb {
  const defaultDb: LocalFallbackDb = {
    settings: {
      appName: 'NextPlay',
      supportWhatsapp: '5511999999999',
      googleClientId: '',
      allowDemoMode: true,
      adminEmail: 'admin@nextplay.com',
      adminName: 'Administrador NextPlay',
      adminPassword: 'admin123',
    },
    servers: [
      {
        id: 'srv-1',
        name: 'Servidor 01 — Principal 4K',
        dnsUrl: 'http://e.cinemaxhub.xyz:80',
        region: 'Brasil • Ultra Rápido',
        format: 'm3u8',
        active: true,
        isDefault: true,
        createdAt: Date.now(),
      },
      {
        id: 'srv-2',
        name: 'Servidor 02 — Rota Backup FHD',
        dnsUrl: 'http://cinemaxhub.xyz:80',
        region: 'Brasil • Rota 2',
        format: 'm3u8',
        active: true,
        isDefault: false,
        createdAt: Date.now(),
      },
    ],
    users: [],
  };
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.LOCAL_DB_FALLBACK);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        settings: { ...defaultDb.settings, ...(parsed.settings || {}) },
        servers: Array.isArray(parsed.servers) ? parsed.servers : defaultDb.servers,
        users: Array.isArray(parsed.users) ? parsed.users : [],
      };
    }
  } catch {
    // ignore
  }
  return defaultDb;
}

function saveLocalFallbackDb(db: LocalFallbackDb) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.LOCAL_DB_FALLBACK, JSON.stringify(db));
  } catch {
    // ignore
  }
}

export function resolveServerDnsLocally(serverId: string): string | null {
  const db = getLocalFallbackDb();
  const srv = db.servers.find((s) => s.id === serverId);
  return srv?.dnsUrl || null;
}

export function getApiServerBaseUrl(): string {
  const envUrl = ((import.meta as any).env?.VITE_API_URL || '').trim();
  try {
    return (
      localStorage.getItem('nextplay_api_server_url_v1') ||
      envUrl ||
      'http://192.168.80.110:4150'
    ).replace(/\/+$/, '');
  } catch {
    return (envUrl || 'http://192.168.80.110:4150').replace(/\/+$/, '');
  }
}

export function setApiServerBaseUrl(url: string) {
  try {
    localStorage.setItem('nextplay_api_server_url_v1', url.trim().replace(/\/+$/, ''));
  } catch {
    // ignore
  }
}

// Helper que tenta chamar '/api/...', depois o IP da rede local (Celular/Tablet/Android TV) e 'http://127.0.0.1:4150'
async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const isCapacitorNative =
    typeof window !== 'undefined' &&
    (Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
      (window.location.hostname === 'localhost' && !window.location.port));

  const candidates = isCapacitorNative
    ? [getApiServerBaseUrl(), 'http://192.168.80.110:4150', 'http://10.0.2.2:4150']
    : ['', 'http://127.0.0.1:4150', getApiServerBaseUrl()];

  let lastErr: unknown = null;
  for (const base of Array.from(new Set(candidates))) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${base}${path}`, {
        ...options,
        signal: options?.signal || controller.signal,
      });
      clearTimeout(timer);
      // No APK Capacitor, uma requisição relativa '/api/...' pode retornar o index.html (text/html)
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return res;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to fetch');
}

export function getUserToken(): string | null {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEYS.USER_TOKEN);
  } catch {
    return null;
  }
}

export function setUserToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(AUTH_STORAGE_KEYS.USER_TOKEN, token);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEYS.USER_TOKEN);
    }
  } catch {
    // ignore
  }
}

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEYS.ADMIN_TOKEN);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(AUTH_STORAGE_KEYS.ADMIN_TOKEN, token);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEYS.ADMIN_TOKEN);
    }
  } catch {
    // ignore
  }
}

export interface SavedGoogleAccount {
  email: string;
  name: string;
  avatarUrl?: string;
}

export function getSavedGoogleAccounts(): SavedGoogleAccount[] {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.GOOGLE_SAVED_ACCOUNTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveGoogleAccountLocally(acc: SavedGoogleAccount) {
  try {
    const list = getSavedGoogleAccounts().filter(
      (a) => a.email.toLowerCase() !== acc.email.toLowerCase()
    );
    list.unshift(acc);
    localStorage.setItem(AUTH_STORAGE_KEYS.GOOGLE_SAVED_ACCOUNTS, JSON.stringify(list.slice(0, 5)));
  } catch {
    // ignore
  }
}

export async function fetchPublicConfig(): Promise<{
  settings: PublicAppConfig;
  servers: PublicServerOption[];
}> {
  try {
    const res = await apiFetch('/api/public/config');
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Fallback local
  }
  const db = getLocalFallbackDb();
  return {
    settings: {
      appName: db.settings.appName,
      supportWhatsapp: db.settings.supportWhatsapp,
      googleClientId: db.settings.googleClientId,
      allowDemoMode: db.settings.allowDemoMode,
    },
    servers: db.servers
      .filter((s) => s.active)
      .map((s) => ({
        id: s.id,
        name: s.name,
        region: s.region,
        format: s.format,
        isDefault: s.isDefault,
      })),
  };
}

export async function registerAccount(
  name: string,
  email: string,
  password: string
): Promise<{ token: string; user: UserAccount }> {
  try {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao criar conta.');
    }
    setUserToken(data.token);
    return data;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) {
      throw err;
    }
    // Fallback local caso a porta 4150 esteja offline
    const db = getLocalFallbackDb();
    const cleanEmail = email.trim().toLowerCase();
    if (db.users.some((u) => u.email === cleanEmail)) {
      throw new Error('Já existe uma conta cadastrada com este e-mail.');
    }
    const newUser: UserAccount & { password?: string } = {
      id: `usr-${Date.now()}`,
      name: name.trim() || cleanEmail.split('@')[0],
      email: cleanEmail,
      password,
      provider: 'email',
      status: 'active',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      iptvLink: null,
    };
    db.users.push(newUser);
    saveLocalFallbackDb(db);
    const token = `local-token:${newUser.id}`;
    setUserToken(token);
    return { token, user: newUser };
  }
}

export async function loginAccount(
  email: string,
  password: string
): Promise<{ token: string; user: UserAccount }> {
  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'E-mail ou senha inválidos.');
    }
    setUserToken(data.token);
    return data;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) {
      throw err;
    }
    const db = getLocalFallbackDb();
    const cleanEmail = email.trim().toLowerCase();
    const user = db.users.find((u) => u.email === cleanEmail && u.password === password);
    if (!user) {
      throw new Error('E-mail ou senha incorretos.');
    }
    const token = `local-token:${user.id}`;
    setUserToken(token);
    return { token, user };
  }
}

export async function loginWithGoogle(payload: {
  email?: string;
  name?: string;
  avatarUrl?: string;
  credential?: string;
  accessToken?: string;
}): Promise<{ token: string; user: UserAccount }> {
  try {
    const res = await apiFetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao autenticar com o Google.');
    }
    if (data.user?.email) {
      saveGoogleAccountLocally({
        email: data.user.email,
        name: data.user.name || data.user.email.split('@')[0],
        avatarUrl: data.user.avatarUrl,
      });
    }
    setUserToken(data.token);
    return data;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) {
      throw err;
    }
    const db = getLocalFallbackDb();
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    let user = db.users.find((u) => u.email === cleanEmail);
    if (!user) {
      user = {
        id: `usr-${Date.now()}`,
        name: (payload.name || cleanEmail.split('@')[0]).trim(),
        email: cleanEmail,
        provider: 'google',
        avatarUrl: payload.avatarUrl || '',
        status: 'active',
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
        iptvLink: null,
      };
      db.users.push(user);
    } else {
      user.lastLoginAt = Date.now();
    }
    saveLocalFallbackDb(db);
    saveGoogleAccountLocally({
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl || undefined,
    });
    const token = `local-token:${user.id}`;
    setUserToken(token);
    return { token, user };
  }
}

export async function fetchCurrentSession(): Promise<{
  user: UserAccount;
  servers: PublicServerOption[];
}> {
  const token = getUserToken();
  if (!token) {
    throw new Error('Sem sessão ativa');
  }
  if (token.startsWith('local-token:')) {
    const userId = token.replace('local-token:', '');
    const db = getLocalFallbackDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      setUserToken(null);
      throw new Error('Sessão expirada');
    }
    return {
      user,
      servers: db.servers
        .filter((s) => s.active)
        .map((s) => ({
          id: s.id,
          name: s.name,
          region: s.region,
          format: s.format,
          isDefault: s.isDefault,
        })),
    };
  }
  const res = await apiFetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    setUserToken(null);
    throw new Error(data.error || 'Sessão expirada.');
  }
  return data;
}

export async function linkIptvToAccount(
  serverId: string,
  username: string,
  password: string,
  accountInfo?: XtreamAccountInfo | null
): Promise<UserAccount> {
  const token = getUserToken();
  if (!token) {
    throw new Error('Faça login na sua conta antes de vincular sua lista.');
  }
  try {
    const res = await apiFetch('/api/user/link-iptv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ serverId, username, password, accountInfo }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao vincular lista IPTV à sua conta.');
    }
    return data.user;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) {
      throw err;
    }
    const db = getLocalFallbackDb();
    const userId = token.replace('local-token:', '');
    const user = db.users.find((u) => u.id === userId) || db.users[0];
    const srv = db.servers.find((s) => s.id === serverId) || db.servers[0];
    if (!user || !srv) throw new Error('Conta ou servidor não encontrado.');
    user.iptvLink = {
      serverId: srv.id,
      serverName: srv.name,
      format: srv.format,
      username: username.trim(),
      password: password.trim(),
      linkedAt: Date.now(),
      accountInfo: accountInfo || null,
    };
    saveLocalFallbackDb(db);
    return user;
  }
}

export async function unlinkIptvFromAccount(): Promise<UserAccount> {
  const token = getUserToken();
  if (!token) {
    throw new Error('Sem sessão ativa.');
  }
  try {
    const res = await apiFetch('/api/user/link-iptv', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao desvincular lista.');
    }
    return data.user;
  } catch {
    const db = getLocalFallbackDb();
    const userId = token.replace('local-token:', '');
    const user = db.users.find((u) => u.id === userId) || db.users[0];
    if (!user) throw new Error('Usuário não encontrado');
    user.iptvLink = null;
    saveLocalFallbackDb(db);
    return user;
  }
}

// ============================================================================
// CHAMADAS DO PAINEL ADMINISTRATIVO (/admin)
// ============================================================================

export interface AdminOverviewData {
  stats: {
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    linkedUsers: number;
    totalServers: number;
    activeServers: number;
    activeStreams: number;
    totalMBTransferred: number;
    memoryMB: { rss: number; heapUsed: number };
    uptimeSec: number;
  };
  servers: AdminServerItem[];
  users: UserAccount[];
  settings: PublicAppConfig & {
    adminEmail: string;
    adminName: string;
  };
}

export async function adminLogin(
  email: string,
  password: string
): Promise<{ token: string; admin: { email: string; name: string } }> {
  try {
    const res = await apiFetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Credenciais de administrador incorretas.');
    }
    setAdminToken(data.token);
    return data;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) {
      throw err;
    }
    const db = getLocalFallbackDb();
    if (
      email.trim().toLowerCase() === db.settings.adminEmail.toLowerCase() &&
      password === db.settings.adminPassword
    ) {
      const token = 'local-admin-token';
      setAdminToken(token);
      return {
        token,
        admin: { email: db.settings.adminEmail, name: db.settings.adminName },
      };
    }
    throw new Error('E-mail ou senha de administrador inválidos.');
  }
}

export async function fetchAdminOverview(): Promise<AdminOverviewData> {
  const token = getAdminToken();
  if (!token) throw new Error('Não autenticado como administrador');
  try {
    const res = await apiFetch('/api/admin/overview', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) setAdminToken(null);
      throw new Error(data.error || 'Falha ao carregar dados do painel administrativo.');
    }
    return data;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) {
      throw err;
    }
    const db = getLocalFallbackDb();
    return {
      stats: {
        totalUsers: db.users.length,
        activeUsers: db.users.filter((u) => u.status !== 'blocked').length,
        blockedUsers: db.users.filter((u) => u.status === 'blocked').length,
        linkedUsers: db.users.filter((u) => u.iptvLink).length,
        totalServers: db.servers.length,
        activeServers: db.servers.filter((s) => s.active).length,
        activeStreams: 0,
        totalMBTransferred: 0,
        memoryMB: { rss: 45, heapUsed: 28 },
        uptimeSec: 120,
      },
      servers: db.servers,
      users: db.users,
      settings: db.settings,
    };
  }
}

export async function adminCreateServer(payload: {
  name: string;
  dnsUrl: string;
  region: string;
  format: 'm3u8' | 'ts';
  active: boolean;
  isDefault: boolean;
}): Promise<AdminServerItem> {
  const token = getAdminToken();
  try {
    const res = await apiFetch('/api/admin/servers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro ao adicionar servidor.');
    return data.server;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) throw err;
    const db = getLocalFallbackDb();
    if (payload.isDefault) db.servers.forEach((s) => (s.isDefault = false));
    const srv: AdminServerItem = {
      id: `srv-${Date.now()}`,
      name: payload.name,
      dnsUrl: payload.dnsUrl,
      region: payload.region,
      format: payload.format,
      active: payload.active,
      isDefault: payload.isDefault,
      createdAt: Date.now(),
    };
    db.servers.push(srv);
    saveLocalFallbackDb(db);
    return srv;
  }
}

export async function adminUpdateServer(
  id: string,
  payload: Partial<{
    name: string;
    dnsUrl: string;
    region: string;
    format: 'm3u8' | 'ts';
    active: boolean;
    isDefault: boolean;
  }>
): Promise<AdminServerItem> {
  const token = getAdminToken();
  try {
    const res = await apiFetch(`/api/admin/servers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar servidor.');
    return data.server;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) throw err;
    const db = getLocalFallbackDb();
    const srv = db.servers.find((s) => s.id === id);
    if (!srv) throw new Error('Servidor não encontrado.');
    if (payload.isDefault) db.servers.forEach((s) => (s.isDefault = false));
    Object.assign(srv, payload);
    saveLocalFallbackDb(db);
    return srv;
  }
}

export async function adminDeleteServer(id: string): Promise<void> {
  const token = getAdminToken();
  try {
    const res = await apiFetch(`/api/admin/servers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erro ao remover servidor.');
    }
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) throw err;
    const db = getLocalFallbackDb();
    db.servers = db.servers.filter((s) => s.id !== id);
    saveLocalFallbackDb(db);
  }
}

export async function adminCreateUser(payload: {
  name: string;
  email: string;
  password?: string;
  serverId?: string;
  iptvUsername?: string;
  iptvPassword?: string;
}): Promise<UserAccount> {
  const token = getAdminToken();
  try {
    const res = await apiFetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro ao criar usuário.');
    return data.user;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) throw err;
    const db = getLocalFallbackDb();
    const srv = db.servers.find((s) => s.id === payload.serverId);
    const user: UserAccount & { password?: string } = {
      id: `usr-${Date.now()}`,
      name: payload.name,
      email: payload.email.toLowerCase(),
      password: payload.password || '123456',
      provider: 'email',
      status: 'active',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      iptvLink:
        srv && payload.iptvUsername && payload.iptvPassword
          ? {
              serverId: srv.id,
              serverName: srv.name,
              format: srv.format,
              username: payload.iptvUsername,
              password: payload.iptvPassword,
              linkedAt: Date.now(),
              accountInfo: null,
            }
          : null,
    };
    db.users.push(user);
    saveLocalFallbackDb(db);
    return user;
  }
}

export async function adminUpdateUser(
  id: string,
  payload: {
    name?: string;
    email?: string;
    newPassword?: string;
    status?: 'active' | 'blocked';
    iptvLink?: { serverId: string; username: string; password: string } | null;
  }
): Promise<UserAccount> {
  const token = getAdminToken();
  try {
    const res = await apiFetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar usuário.');
    return data.user;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) throw err;
    const db = getLocalFallbackDb();
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new Error('Usuário não encontrado');
    if (payload.name) user.name = payload.name;
    if (payload.email) user.email = payload.email;
    if (payload.newPassword) user.password = payload.newPassword;
    if (payload.status) user.status = payload.status;
    if (payload.iptvLink === null) {
      user.iptvLink = null;
    } else if (payload.iptvLink) {
      const srv = db.servers.find((s) => s.id === payload.iptvLink?.serverId) || db.servers[0];
      if (srv) {
        user.iptvLink = {
          serverId: srv.id,
          serverName: srv.name,
          format: srv.format,
          username: payload.iptvLink.username,
          password: payload.iptvLink.password,
          linkedAt: Date.now(),
          accountInfo: null,
        };
      }
    }
    saveLocalFallbackDb(db);
    return user;
  }
}

export async function adminDeleteUser(id: string): Promise<void> {
  const token = getAdminToken();
  try {
    const res = await apiFetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erro ao remover usuário.');
    }
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) throw err;
    const db = getLocalFallbackDb();
    db.users = db.users.filter((u) => u.id !== id);
    saveLocalFallbackDb(db);
  }
}

export async function adminUpdateSettings(payload: {
  appName?: string;
  supportWhatsapp?: string;
  googleClientId?: string;
  allowDemoMode?: boolean;
  adminEmail?: string;
  adminName?: string;
  adminNewPassword?: string;
}): Promise<AdminOverviewData['settings']> {
  const token = getAdminToken();
  try {
    const res = await apiFetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar configurações.');
    return data.settings;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) throw err;
    const db = getLocalFallbackDb();
    Object.assign(db.settings, payload);
    if (payload.adminNewPassword) db.settings.adminPassword = payload.adminNewPassword;
    saveLocalFallbackDb(db);
    return db.settings;
  }
}

// ============================================================================
// PERFIS ESTILO NETFLIX (ATÉ 5 PERFIS COM AVATARES, PIN RESERVADO E HISTÓRICO)
// ============================================================================

export function ensureClientUserProfiles(user: UserAccount | null): UserSubProfile[] {
  if (!user) {
    return [
      {
        id: 'prf-demo-1',
        name: 'Principal',
        avatarId: 'cyber-wolf',
        isKids: false,
        pin: null,
        favorites: [],
        history: [],
        createdAt: Date.now(),
      },
    ];
  }
  if (Array.isArray(user.profiles) && user.profiles.length > 0) {
    return user.profiles.slice(0, 5);
  }
  const firstName = (user.name || 'Principal').trim().split(/\s+/)[0].slice(0, 18);
  return [
    {
      id: `prf-${user.id}-1`,
      name: firstName || 'Principal',
      avatarId: 'cyber-wolf',
      isKids: false,
      pin: null,
      favorites: [],
      history: [],
      createdAt: Date.now(),
    },
  ];
}

export async function createUserProfile(payload: {
  name: string;
  avatarId: string;
  isKids?: boolean;
  pin?: string | null;
}): Promise<{ profile: UserSubProfile; user: UserAccount }> {
  const token = getUserToken();
  if (!token) throw new Error('Faça login na sua conta para criar um perfil.');

  try {
    const res = await apiFetch('/api/user/profiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao criar perfil.');
    }
    return data;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) {
      throw err;
    }
    const db = getLocalFallbackDb();
    const userId = token.replace('local-token:', '');
    const user = db.users.find((u) => u.id === userId) || db.users[0];
    if (!user) throw new Error('Conta não encontrada.');
    const currentProfiles = ensureClientUserProfiles(user);
    if (currentProfiles.length >= 5) {
      throw new Error('Limite máximo de 5 perfis por conta atingido.');
    }
    const newProfile: UserSubProfile = {
      id: `prf-${Date.now()}`,
      name: payload.name.trim().slice(0, 22),
      avatarId: payload.avatarId || 'cyber-wolf',
      isKids: Boolean(payload.isKids),
      pin: payload.pin && /^\d{4}$/.test(payload.pin.trim()) ? payload.pin.trim() : null,
      favorites: [],
      history: [],
      createdAt: Date.now(),
    };
    user.profiles = [...currentProfiles, newProfile];
    saveLocalFallbackDb(db);
    return { profile: newProfile, user };
  }
}

export async function updateUserProfile(
  profileId: string,
  payload: {
    name?: string;
    avatarId?: string;
    isKids?: boolean;
    pin?: string | null;
  }
): Promise<{ profile: UserSubProfile; user: UserAccount }> {
  const token = getUserToken();
  if (!token) throw new Error('Sem sessão ativa.');

  try {
    const res = await apiFetch(`/api/user/profiles/${profileId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao atualizar perfil.');
    }
    return data;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) {
      throw err;
    }
    const db = getLocalFallbackDb();
    const userId = token.replace('local-token:', '');
    const user = db.users.find((u) => u.id === userId) || db.users[0];
    if (!user) throw new Error('Conta não encontrada.');
    const currentProfiles = ensureClientUserProfiles(user);
    const target = currentProfiles.find((p) => p.id === profileId);
    if (!target) throw new Error('Perfil não encontrado.');
    if (payload.name !== undefined && payload.name.trim()) {
      target.name = payload.name.trim().slice(0, 22);
    }
    if (payload.avatarId !== undefined) target.avatarId = payload.avatarId;
    if (payload.isKids !== undefined) target.isKids = Boolean(payload.isKids);
    if (payload.pin !== undefined) {
      target.pin = payload.pin && /^\d{4}$/.test(payload.pin.trim()) ? payload.pin.trim() : null;
    }
    user.profiles = currentProfiles;
    saveLocalFallbackDb(db);
    return { profile: target, user };
  }
}

export async function deleteUserProfile(profileId: string): Promise<UserAccount> {
  const token = getUserToken();
  if (!token) throw new Error('Sem sessão ativa.');

  try {
    const res = await apiFetch(`/api/user/profiles/${profileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao excluir perfil.');
    }
    return data.user;
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) {
      throw err;
    }
    const db = getLocalFallbackDb();
    const userId = token.replace('local-token:', '');
    const user = db.users.find((u) => u.id === userId) || db.users[0];
    if (!user) throw new Error('Conta não encontrada.');
    const currentProfiles = ensureClientUserProfiles(user);
    if (currentProfiles.length <= 1) {
      throw new Error('A conta precisa ter pelo menos 1 perfil ativo.');
    }
    user.profiles = currentProfiles.filter((p) => p.id !== profileId);
    saveLocalFallbackDb(db);
    return user;
  }
}

export async function syncUserProfileState(
  profileId: string,
  payload: { favorites?: string[]; history?: WatchHistoryItem[] }
): Promise<void> {
  const token = getUserToken();
  if (!token || !profileId) return;

  try {
    await apiFetch(`/api/user/profiles/${profileId}/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fallback local
    const db = getLocalFallbackDb();
    const userId = token.replace('local-token:', '');
    const user = db.users.find((u) => u.id === userId) || db.users[0];
    if (user) {
      const currentProfiles = ensureClientUserProfiles(user);
      const target = currentProfiles.find((p) => p.id === profileId);
      if (target) {
        if (payload.favorites) target.favorites = payload.favorites.slice(0, 500);
        if (payload.history) target.history = payload.history.slice(0, 50);
        user.profiles = currentProfiles;
        saveLocalFallbackDb(db);
      }
    }
  }
}
