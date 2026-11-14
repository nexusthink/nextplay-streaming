import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const TOKEN_SECRET = process.env.NEXTPLAY_SECRET || 'nextplay-local-hmac-secret-key-2026';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch {
    return false;
  }
}

export function createToken(payload) {
  const data = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Date.now(),
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 dias
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

const DEFAULT_DB = {
  admin: {
    email: 'admin@nextplay.com',
    name: 'Administrador NextPlay',
    passwordHash: hashPassword('admin123'),
  },
  settings: {
    appName: 'NextPlay',
    supportWhatsapp: '5511999999999',
    googleClientId: '',
    googleClientIdWeb: '',
    googleClientIdAndroid: '',
    googleClientIdTv: '',
    googleSmartSwitch: true,
    allowDemoMode: true,
  },
  servers: [
    {
      id: 'srv-1',
      name: 'Servidor 01 — Principal 4K',
      dnsUrl: 'http://cinemaxhub.xyz',
      format: 'm3u8',
      region: 'Brasil • Ultra Rápido',
      active: true,
      isDefault: true,
      createdAt: Date.now(),
    },
    {
      id: 'srv-2',
      name: 'Servidor 02 — Rota Backup FHD',
      dnsUrl: 'http://e.cinemaxhub.xyz',
      format: 'm3u8',
      region: 'Brasil • Rota 2',
      active: true,
      isDefault: false,
      createdAt: Date.now(),
    },
  ],
  users: [],
};

export function loadDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
      return structuredClone(DEFAULT_DB);
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      admin: parsed.admin || DEFAULT_DB.admin,
      settings: { ...DEFAULT_DB.settings, ...(parsed.settings || {}) },
      servers: Array.isArray(parsed.servers) ? parsed.servers : DEFAULT_DB.servers,
      users: Array.isArray(parsed.users) ? parsed.users : [],
    };
  } catch (err) {
    console.error('[NextPlay DB] Erro ao carregar banco local, usando padrão:', err);
    return structuredClone(DEFAULT_DB);
  }
}

export function saveDb(dbData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[NextPlay DB] Erro ao salvar banco local:', err);
    return false;
  }
}

export function ensureUserProfiles(user) {
  if (!user) return [];
  if (!Array.isArray(user.profiles) || user.profiles.length === 0) {
    const firstName = String(user.name || 'Principal')
      .trim()
      .split(/\s+/)[0]
      .slice(0, 18);
    user.profiles = [
      {
        id: `prf-${user.id || Date.now()}-1`,
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
  return user.profiles.slice(0, 5);
}

export function sanitizeUserForClient(user, servers = []) {
  if (!user) return null;
  let linkedServer = null;
  if (user.iptvLink && user.iptvLink.serverId) {
    linkedServer = servers.find((s) => s.id === user.iptvLink.serverId) || null;
  }

  const profiles = ensureUserProfiles(user).map((p) => ({
    id: p.id,
    name: p.name,
    avatarId: p.avatarId || 'cyber-wolf',
    isKids: Boolean(p.isKids),
    pin: p.pin ? String(p.pin) : null,
    favorites: Array.isArray(p.favorites) ? p.favorites : [],
    history: Array.isArray(p.history) ? p.history.slice(0, 50) : [],
    createdAt: p.createdAt || Date.now(),
  }));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    provider: user.provider || 'email',
    avatarUrl: user.avatarUrl || null,
    status: user.status || 'active',
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    profiles,
    iptvLink:
      user.iptvLink && user.iptvLink.serverId && user.iptvLink.username
        ? {
            serverId: user.iptvLink.serverId,
            serverName: linkedServer ? linkedServer.name : user.iptvLink.serverName || 'Servidor Vinculado',
            format: linkedServer ? linkedServer.format || 'm3u8' : user.iptvLink.format || 'm3u8',
            username: user.iptvLink.username,
            password: user.iptvLink.password,
            linkedAt: user.iptvLink.linkedAt,
            accountInfo: user.iptvLink.accountInfo || null,
          }
        : null,
  };
}

