import express from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import zlib from 'zlib';
import path from 'path';
import fs from 'fs';
import { URL, fileURLToPath } from 'url';
import {
  loadDb,
  saveDb,
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  sanitizeUserForClient,
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4150;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Banco de dados local persistente (Contas de Clientes, Vínculo IPTV, Servidores DNS e Admin)
let db = loadDb();

// Métricas em tempo real do motor de buffers
let activeStreams = 0;
let totalBytesTransferred = 0;

const DEFAULT_IPTV_UA = 'VLC/3.0.20 LibVLC/3.0.20';

// Agentes HTTP/HTTPS com Keep-Alive persistente para reutilizar a mesma conexão TCP na CDN IPTV
// (Evita estourar o limite max_connections do painel Xtream e elimina latência de handshake)
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 6,
  maxFreeSockets: 2,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 6,
  maxFreeSockets: 2,
  rejectUnauthorized: false,
});

// Cache de redirecionamentos de sessões de stream (evita pedir novo token 302 a cada refresh do HLS)
const streamRedirectCache = new Map();

// Cache em memória de legendas automáticas baixadas (evita baixar novamente a mesma legenda)
const subtitleCache = new Map();

// Cache em memória de traduções em tempo real de Closed Caption (PT <-> EN)
const translationCache = new Map();

// Cache de offsets binários das faixas de áudio (soun) dentro do átomo moov de arquivos MP4 [Dual]
const mp4TrackOffsetsCache = new Map();

/**
 * Inspeciona o cabeçalho moov de um arquivo MP4 para localizar os offsets exatos das faixas de áudio (soun).
 * Permite alternar entre Áudio 1 (Dublado PT-BR) e Áudio 2 (Inglês Original) em tempo real direto no proxy!
 */
async function getMp4SounTrackOffsets(targetUrl) {
  if (mp4TrackOffsetsCache.has(targetUrl)) {
    return mp4TrackOffsetsCache.get(targetUrl);
  }
  try {
    const { res: probeRes } = await fetchUrlRaw(targetUrl, {
      headers: { Range: 'bytes=0-8388607' },
      timeout: 12000,
    });
    const chunks = [];
    let total = 0;
    for await (const chunk of probeRes) {
      chunks.push(chunk);
      total += chunk.length;
      if (total >= 8388608) break;
    }
    const buf = Buffer.concat(chunks);
    const sounTracks = [];
    let offset = 0;

    while (offset + 8 <= buf.length) {
      const size = buf.readUInt32BE(offset);
      const type = buf.slice(offset + 4, offset + 8).toString('ascii');
      if (size < 8) break;

      if (type === 'moov') {
        let mOff = offset + 8;
        const mEnd = Math.min(buf.length, offset + size);
        while (mOff + 8 <= mEnd) {
          const tSize = buf.readUInt32BE(mOff);
          const tType = buf.slice(mOff + 4, mOff + 8).toString('ascii');
          if (tSize < 8) break;

          if (tType === 'trak') {
            const trakSlice = buf.slice(mOff, Math.min(buf.length, mOff + tSize));
            const tkhdIdx = trakSlice.indexOf('tkhd');
            const hdlrIdx = trakSlice.indexOf('hdlr');
            const handler =
              hdlrIdx >= 0 ? trakSlice.slice(hdlrIdx + 12, hdlrIdx + 16).toString('ascii') : '';
            if (handler === 'soun' && tkhdIdx >= 0) {
              sounTracks.push({
                trakTypeOffset: mOff + 4,
                tkhdFlagsByteOffset: mOff + tkhdIdx + 7,
              });
            }
          }
          mOff += tSize;
        }
        break;
      }
      offset += size;
    }

    mp4TrackOffsetsCache.set(targetUrl, sounTracks);
    return sounTracks;
  } catch {
    return [];
  }
}

// Rastreia conexões upstream de streams contínuos (.ts) para fechar a anterior ao trocar de canal
const activeUpstreamStreams = new Set();

/**
 * Helper HTTP/HTTPS request com suporte a redirecionamentos (301, 302, 307, 308)
 * e Auto-Healer de subdomínios IPTV encurtados (ex: e.dominio.xyz -> dominio.xyz)
 */
function fetchUrlRaw(targetUrl, options = {}, maxRedirects = 5, triedRootFallback = false) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(targetUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const reqOptions = {
        agent: isHttps ? httpsAgent : httpAgent,
        headers: {
          'User-Agent': options.userAgent || DEFAULT_IPTV_UA,
          'Accept': '*/*',
          'Connection': 'keep-alive',
          ...(options.headers || {}),
        },
        timeout: options.timeout || 30000,
        rejectUnauthorized: false,
      };

      const req = client.get(parsedUrl, reqOptions, (res) => {
        if (
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location &&
          maxRedirects > 0
        ) {
          res.resume();
          const redirectUrl = new URL(res.headers.location, parsedUrl).toString();
          return resolve(fetchUrlRaw(redirectUrl, options, maxRedirects - 1, triedRootFallback));
        }

        // Se for um shortlink /p/{user}/{pass}/m3u que deu 404 no domínio raiz, converte para /get.php
        if (res.statusCode === 404) {
          const shortMatch = parsedUrl.pathname.match(/^\/p\/([^/]+)\/([^/]+)(\/m3u.*)?$/i);
          if (shortMatch) {
            res.resume();
            const [, u, p] = shortMatch;
            const healedUrl = `${parsedUrl.protocol}//${parsedUrl.host}/get.php?username=${encodeURIComponent(
              u
            )}&password=${encodeURIComponent(p)}&type=m3u_plus&output=ts`;
            return resolve(fetchUrlRaw(healedUrl, options, maxRedirects - 1, true));
          }
        }

        resolve({ res, finalUrl: parsedUrl.toString() });
      });

      req.on('error', (err) => {
        // Auto-Healer DNS: se o subdomínio encurtador (ex: e.cinemaxhub.xyz) não existir (ENOTFOUND),
        // remove o primeiro subdomínio e tenta no domínio principal (cinemaxhub.xyz)
        if (!triedRootFallback && err && (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN')) {
          const hostParts = parsedUrl.hostname.split('.');
          if (hostParts.length >= 3) {
            const rootHost = hostParts.slice(1).join('.');
            const fallbackUrlObj = new URL(parsedUrl.toString());
            fallbackUrlObj.hostname = rootHost;

            // Se for rota curta /p/{user}/{pass}/m3u, já converte para /get.php ou mantém
            const shortMatch = fallbackUrlObj.pathname.match(/^\/p\/([^/]+)\/([^/]+)(\/m3u.*)?$/i);
            if (shortMatch) {
              const [, u, p] = shortMatch;
              fallbackUrlObj.pathname = '/get.php';
              fallbackUrlObj.search = `?username=${encodeURIComponent(u)}&password=${encodeURIComponent(
                p
              )}&type=m3u_plus&output=ts`;
            }

            return resolve(
              fetchUrlRaw(fallbackUrlObj.toString(), options, maxRedirects, true)
            );
          }
        }
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout ao conectar no servidor IPTV'));
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Helper para extrair e validar token Bearer de Cliente ou Admin
function getAuthPayload(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return verifyToken(token);
}

function requireUserAuth(req, res, next) {
  const payload = getAuthPayload(req);
  if (!payload || payload.role !== 'user' || !payload.userId) {
    return res.status(401).json({ error: 'Sessão expirada ou não autenticada. Faça login novamente.' });
  }
  const user = db.users.find((u) => u.id === payload.userId);
  if (!user) {
    return res.status(401).json({ error: 'Conta de usuário não encontrada.' });
  }
  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'Sua conta está temporariamente bloqueada pelo administrador.' });
  }
  req.user = user;
  next();
}

function requireAdminAuth(req, res, next) {
  const payload = getAuthPayload(req);
  if (!payload || payload.role !== 'admin') {
    return res.status(401).json({ error: 'Acesso restrito ao Administrador.' });
  }
  req.admin = payload;
  next();
}

// 1. Health & Telemetria de Memória / Buffers
app.get('/api/health', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    engine: 'NextPlay Express Micro-Server v1.0',
    hwAcceleration: 'DirectComposition + D3D11 + ZeroCopy',
    activeStreams,
    totalMBTransferred: +(totalBytesTransferred / (1024 * 1024)).toFixed(2),
    memoryMB: {
      rss: +(mem.rss / (1024 * 1024)).toFixed(1),
      heapUsed: +(mem.heapUsed / (1024 * 1024)).toFixed(1),
    },
    uptimeSec: Math.floor(process.uptime()),
  });
});

// ============================================================================
// 1.1 ROTAS PÚBLICAS & AUTENTICAÇÃO DE CONTA DO CLIENTE (EMAIL / GOOGLE)
// ============================================================================

// Retorna configurações públicas e a lista de Servidores ativos definidos pelo Admin (SEM expor o DNS bruto)
app.get('/api/public/config', (_req, res) => {
  const activeServers = db.servers
    .filter((s) => s.active !== false)
    .map((s) => ({
      id: s.id,
      name: s.name,
      region: s.region || 'Brasil',
      format: s.format || 'm3u8',
      isDefault: Boolean(s.isDefault),
    }));

  res.json({
    settings: {
      appName: db.settings.appName || 'NextPlay',
      supportWhatsapp: db.settings.supportWhatsapp || '5511999999999',
      googleClientId: db.settings.googleClientId || '',
      allowDemoMode: db.settings.allowDemoMode !== false,
    },
    servers: activeServers,
  });
});

// Cadastro de nova conta com Email e Senha
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const rawPass = String(password || '');

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ error: 'Informe seu nome completo (mínimo 2 caracteres).' });
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Informe um endereço de e-mail válido.' });
  }
  if (rawPass.length < 4) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 4 caracteres.' });
  }

  const existing = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'Já existe uma conta cadastrada com este e-mail. Faça login!' });
  }

  const newUser = {
    id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    email: cleanEmail,
    passwordHash: hashPassword(rawPass),
    provider: 'email',
    avatarUrl: null,
    status: 'active',
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    iptvLink: null,
  };

  db.users.unshift(newUser);
  saveDb(db);

  const token = createToken({ role: 'user', userId: newUser.id, email: newUser.email });
  return res.json({
    token,
    user: sanitizeUserForClient(newUser, db.servers),
  });
});

// Login com Email e Senha
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const rawPass = String(password || '');

  if (!cleanEmail || !rawPass) {
    return res.status(400).json({ error: 'Informe seu e-mail e sua senha.' });
  }

  const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    return res.status(401).json({ error: 'Conta não encontrada com este e-mail.' });
  }
  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'Esta conta foi suspensa pelo administrador.' });
  }
  if (!user.passwordHash || !verifyPassword(rawPass, user.passwordHash)) {
    return res.status(401).json({ error: 'Senha incorreta. Verifique e tente novamente.' });
  }

  user.lastLoginAt = Date.now();
  saveDb(db);

  const token = createToken({ role: 'user', userId: user.id, email: user.email });
  return res.json({
    token,
    user: sanitizeUserForClient(user, db.servers),
  });
});

// Login / Cadastro com Conta Google (Suporta JWT real do Google Identity Services ou seletor Google local)
app.post('/api/auth/google', (req, res) => {
  let { email, name, avatarUrl, googleSub, credential } = req.body || {};

  // Se veio um JWT oficial do Google Identity Services, decodifica o payload
  if (credential && typeof credential === 'string' && credential.split('.').length === 3) {
    try {
      const payloadJson = JSON.parse(Buffer.from(credential.split('.')[1], 'base64url').toString('utf-8'));
      email = payloadJson.email || email;
      name = payloadJson.name || name;
      avatarUrl = payloadJson.picture || avatarUrl;
      googleSub = payloadJson.sub || googleSub;
    } catch {
      return res.status(400).json({ error: 'Token Google inválido.' });
    }
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'E-mail da conta Google inválido.' });
  }

  const cleanName = String(name || cleanEmail.split('@')[0]).trim();

  let user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (user) {
    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Esta conta foi suspensa pelo administrador.' });
    }
    user.lastLoginAt = Date.now();
    if (avatarUrl && !user.avatarUrl) user.avatarUrl = avatarUrl;
    if (googleSub && !user.googleSub) user.googleSub = googleSub;
  } else {
    user = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      email: cleanEmail,
      passwordHash: null,
      provider: 'google',
      googleSub: googleSub || `g-${Date.now()}`,
      avatarUrl: avatarUrl || null,
      status: 'active',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      iptvLink: null,
    };
    db.users.unshift(user);
  }

  saveDb(db);

  const token = createToken({ role: 'user', userId: user.id, email: user.email });
  return res.json({
    token,
    user: sanitizeUserForClient(user, db.servers),
  });
});

// Valida sessão ativa do cliente e retorna os dados atualizados (incluindo a lista IPTV vinculada)
app.get('/api/auth/me', requireUserAuth, (req, res) => {
  const activeServers = db.servers
    .filter((s) => s.active !== false)
    .map((s) => ({
      id: s.id,
      name: s.name,
      region: s.region || 'Brasil',
      format: s.format || 'm3u8',
      isDefault: Boolean(s.isDefault),
    }));

  return res.json({
    user: sanitizeUserForClient(req.user, db.servers),
    servers: activeServers,
  });
});

// Vincula um Servidor (definido pelo Admin) + Usuário/Senha IPTV à conta do cliente permanentemente
app.post('/api/user/link-iptv', requireUserAuth, (req, res) => {
  const { serverId, username, password, accountInfo } = req.body || {};
  const cleanServerId = String(serverId || '').trim();
  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '').trim();

  if (!cleanServerId || !cleanUser || !cleanPass) {
    return res.status(400).json({ error: 'Selecione o servidor e informe seu usuário e senha IPTV.' });
  }

  const targetServer = db.servers.find((s) => s.id === cleanServerId && s.active !== false);
  if (!targetServer) {
    return res.status(404).json({ error: 'O servidor selecionado não está disponível.' });
  }

  req.user.iptvLink = {
    serverId: targetServer.id,
    serverName: targetServer.name,
    format: targetServer.format || 'm3u8',
    username: cleanUser,
    password: cleanPass,
    linkedAt: Date.now(),
    accountInfo: accountInfo || null,
  };

  saveDb(db);

  return res.json({
    user: sanitizeUserForClient(req.user, db.servers),
  });
});

// Desvincula a lista IPTV da conta do cliente
app.delete('/api/user/link-iptv', requireUserAuth, (req, res) => {
  req.user.iptvLink = null;
  saveDb(db);
  return res.json({
    user: sanitizeUserForClient(req.user, db.servers),
  });
});

// ============================================================================
// 1.2 ROTAS DO MINI PAINEL ADMINISTRATIVO WEB (/api/admin/*)
// ============================================================================

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const rawPass = String(password || '');

  if (
    cleanEmail !== db.admin.email.toLowerCase() ||
    !verifyPassword(rawPass, db.admin.passwordHash)
  ) {
    return res.status(401).json({ error: 'Credenciais de administrador inválidas.' });
  }

  const token = createToken({ role: 'admin', email: db.admin.email, name: db.admin.name });
  return res.json({
    token,
    admin: {
      email: db.admin.email,
      name: db.admin.name,
    },
  });
});

app.get('/api/admin/overview', requireAdminAuth, (_req, res) => {
  const mem = process.memoryUsage();
  const serversWithStats = db.servers.map((srv) => {
    const linkedUsersCount = db.users.filter((u) => u.iptvLink?.serverId === srv.id).length;
    return {
      ...srv,
      linkedUsersCount,
    };
  });

  const usersList = db.users.map((u) => {
    const srv = u.iptvLink?.serverId
      ? db.servers.find((s) => s.id === u.iptvLink.serverId)
      : null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      provider: u.provider || 'email',
      avatarUrl: u.avatarUrl || null,
      status: u.status || 'active',
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      iptvLink: u.iptvLink
        ? {
            ...u.iptvLink,
            serverName: srv ? srv.name : u.iptvLink.serverName || 'Servidor Removido',
            serverDns: srv ? srv.dnsUrl : '',
          }
        : null,
    };
  });

  return res.json({
    stats: {
      totalUsers: db.users.length,
      activeUsers: db.users.filter((u) => u.status !== 'blocked').length,
      blockedUsers: db.users.filter((u) => u.status === 'blocked').length,
      linkedUsers: db.users.filter((u) => Boolean(u.iptvLink?.serverId)).length,
      totalServers: db.servers.length,
      activeServers: db.servers.filter((s) => s.active !== false).length,
      activeStreams,
      totalMBTransferred: +(totalBytesTransferred / (1024 * 1024)).toFixed(2),
      memoryMB: {
        rss: +(mem.rss / (1024 * 1024)).toFixed(1),
        heapUsed: +(mem.heapUsed / (1024 * 1024)).toFixed(1),
      },
      uptimeSec: Math.floor(process.uptime()),
    },
    servers: serversWithStats,
    users: usersList,
    settings: {
      ...db.settings,
      adminEmail: db.admin.email,
      adminName: db.admin.name,
    },
  });
});

// Admin: Adicionar Novo Servidor DNS
app.post('/api/admin/servers', requireAdminAuth, (req, res) => {
  const { name, dnsUrl, region, format, active, isDefault } = req.body || {};
  const cleanName = String(name || '').trim();
  let cleanDns = String(dnsUrl || '').trim().replace(/\/+$/, '');

  if (!cleanName || !cleanDns) {
    return res.status(400).json({ error: 'Nome do servidor e URL/DNS são obrigatórios.' });
  }
  if (!/^https?:\/\//i.test(cleanDns)) {
    cleanDns = `http://${cleanDns}`;
  }

  if (isDefault) {
    db.servers.forEach((s) => {
      s.isDefault = false;
    });
  }

  const newServer = {
    id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    dnsUrl: cleanDns,
    region: String(region || 'Brasil').trim(),
    format: format === 'ts' ? 'ts' : 'm3u8',
    active: active !== false,
    isDefault: Boolean(isDefault) || db.servers.length === 0,
    createdAt: Date.now(),
  };

  db.servers.push(newServer);
  saveDb(db);
  return res.json({ server: newServer });
});

// Admin: Editar Servidor DNS
app.put('/api/admin/servers/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const srv = db.servers.find((s) => s.id === id);
  if (!srv) {
    return res.status(404).json({ error: 'Servidor não encontrado.' });
  }

  const { name, dnsUrl, region, format, active, isDefault } = req.body || {};
  if (name !== undefined) srv.name = String(name).trim() || srv.name;
  if (dnsUrl !== undefined) {
    let cleanDns = String(dnsUrl).trim().replace(/\/+$/, '');
    if (cleanDns && !/^https?:\/\//i.test(cleanDns)) {
      cleanDns = `http://${cleanDns}`;
    }
    if (cleanDns) srv.dnsUrl = cleanDns;
  }
  if (region !== undefined) srv.region = String(region).trim();
  if (format !== undefined) srv.format = format === 'ts' ? 'ts' : 'm3u8';
  if (active !== undefined) srv.active = Boolean(active);
  if (isDefault) {
    db.servers.forEach((s) => {
      s.isDefault = s.id === srv.id;
    });
  }

  saveDb(db);
  return res.json({ server: srv });
});

// Admin: Remover Servidor DNS
app.delete('/api/admin/servers/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const idx = db.servers.findIndex((s) => s.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Servidor não encontrado.' });
  }
  db.servers.splice(idx, 1);
  // Desvincula usuários que estavam apontando para o servidor removido
  db.users.forEach((u) => {
    if (u.iptvLink?.serverId === id) {
      u.iptvLink = null;
    }
  });
  saveDb(db);
  return res.json({ success: true });
});

// Admin: Criar Usuário Manualmente (com ou sem lista IPTV já vinculada)
app.post('/api/admin/users', requireAdminAuth, (req, res) => {
  const { name, email, password, serverId, iptvUsername, iptvPassword } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const rawPass = String(password || '123456');

  if (!cleanName || !cleanEmail) {
    return res.status(400).json({ error: 'Nome e e-mail do usuário são obrigatórios.' });
  }
  if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    return res.status(409).json({ error: 'Já existe um usuário com este e-mail.' });
  }

  let iptvLink = null;
  if (serverId && iptvUsername && iptvPassword) {
    const srv = db.servers.find((s) => s.id === serverId);
    if (srv) {
      iptvLink = {
        serverId: srv.id,
        serverName: srv.name,
        format: srv.format || 'm3u8',
        username: String(iptvUsername).trim(),
        password: String(iptvPassword).trim(),
        linkedAt: Date.now(),
        accountInfo: null,
      };
    }
  }

  const newUser = {
    id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    email: cleanEmail,
    passwordHash: hashPassword(rawPass),
    provider: 'email',
    avatarUrl: null,
    status: 'active',
    createdAt: Date.now(),
    lastLoginAt: null,
    iptvLink,
  };

  db.users.unshift(newUser);
  saveDb(db);
  return res.json({ user: newUser });
});

// Admin: Editar Usuário (Status, Senha, ou Vincular/Alterar/Desvincular Lista IPTV)
app.put('/api/admin/users/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const { name, email, newPassword, status, iptvLink } = req.body || {};
  if (name !== undefined && String(name).trim()) {
    user.name = String(name).trim();
  }
  if (email !== undefined && String(email).trim()) {
    user.email = String(email).trim().toLowerCase();
  }
  if (newPassword && String(newPassword).trim().length >= 4) {
    user.passwordHash = hashPassword(String(newPassword).trim());
  }
  if (status === 'active' || status === 'blocked') {
    user.status = status;
  }

  if (iptvLink !== undefined) {
    if (iptvLink === null || !iptvLink.serverId || !iptvLink.username || !iptvLink.password) {
      user.iptvLink = null;
    } else {
      const srv = db.servers.find((s) => s.id === iptvLink.serverId);
      if (srv) {
        user.iptvLink = {
          serverId: srv.id,
          serverName: srv.name,
          format: srv.format || 'm3u8',
          username: String(iptvLink.username).trim(),
          password: String(iptvLink.password).trim(),
          linkedAt: Date.now(),
          accountInfo: user.iptvLink?.accountInfo || null,
        };
      }
    }
  }

  saveDb(db);
  return res.json({ user });
});

// Admin: Excluir Usuário
app.delete('/api/admin/users/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const idx = db.users.findIndex((u) => u.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }
  db.users.splice(idx, 1);
  saveDb(db);
  return res.json({ success: true });
});

// Admin: Atualizar Configurações Gerais & Credenciais de Admin
app.put('/api/admin/settings', requireAdminAuth, (req, res) => {
  const {
    appName,
    supportWhatsapp,
    googleClientId,
    allowDemoMode,
    adminEmail,
    adminName,
    adminNewPassword,
  } = req.body || {};

  if (appName !== undefined) db.settings.appName = String(appName).trim() || 'NextPlay';
  if (supportWhatsapp !== undefined) db.settings.supportWhatsapp = String(supportWhatsapp).trim();
  if (googleClientId !== undefined) db.settings.googleClientId = String(googleClientId).trim();
  if (allowDemoMode !== undefined) db.settings.allowDemoMode = Boolean(allowDemoMode);

  if (adminEmail && String(adminEmail).includes('@')) {
    db.admin.email = String(adminEmail).trim().toLowerCase();
  }
  if (adminName && String(adminName).trim()) {
    db.admin.name = String(adminName).trim();
  }
  if (adminNewPassword && String(adminNewPassword).length >= 4) {
    db.admin.passwordHash = hashPassword(String(adminNewPassword));
  }

  saveDb(db);
  return res.json({
    settings: {
      ...db.settings,
      adminEmail: db.admin.email,
      adminName: db.admin.name,
    },
  });
});

// 2. Proxy para Xtream Codes API (player_api.php) — aceita serverId (resolvido no banco) ou server URL
app.get('/api/xtream', async (req, res) => {
  const { server, serverId, username, password, action, category_id, vod_id, series_id, stream_id, limit } = req.query;

  let resolvedServerUrl = server ? String(server).trim() : '';
  if (serverId) {
    const srvObj = db.servers.find((s) => s.id === String(serverId).trim());
    if (!srvObj) {
      return res.status(404).json({ error: 'Servidor selecionado não foi encontrado no sistema.' });
    }
    resolvedServerUrl = srvObj.dnsUrl;
  }

  if (!resolvedServerUrl || !username || !password) {
    return res.status(400).json({ error: 'Parâmetros de servidor, username e password são obrigatórios.' });
  }

  try {
    const baseUrl = resolvedServerUrl.replace(/\/+$/, '');
    const apiUrl = new URL(`${baseUrl}/player_api.php`);
    apiUrl.searchParams.set('username', String(username).trim());
    apiUrl.searchParams.set('password', String(password).trim());

    if (action) apiUrl.searchParams.set('action', String(action));
    if (category_id) apiUrl.searchParams.set('category_id', String(category_id));
    if (vod_id) apiUrl.searchParams.set('vod_id', String(vod_id));
    if (series_id) apiUrl.searchParams.set('series_id', String(series_id));
    if (stream_id) apiUrl.searchParams.set('stream_id', String(stream_id));
    if (limit) apiUrl.searchParams.set('limit', String(limit));

    // Aumentado timeout para 60 segundos para suportar catálogos maciços de 50.000+ VODs/Séries
    const { res: upstream } = await fetchUrlRaw(apiUrl.toString(), { timeout: 60000 });

    const chunks = [];
    upstream.on('data', (chunk) => chunks.push(chunk));
    upstream.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        const data = JSON.parse(raw);
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          data._resolvedServerUrl = baseUrl;
        }
        res.json(data);
      } catch (parseErr) {
        res.status(502).json({
          error: 'Resposta inválida do servidor Xtream Codes.',
          details: String(parseErr),
        });
      }
    });
  } catch (err) {
    res.status(502).json({
      error: 'Falha ao conectar no servidor Xtream Codes.',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// 3. Proxy para baixar Listas M3U / M3U8 remotas sem bloqueio de CORS ou User-Agent
app.get('/api/m3u', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Parâmetro url é obrigatório.' });
  }

  try {
    const { res: upstream } = await fetchUrlRaw(String(url), { timeout: 30000 });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    upstream.pipe(res);
  } catch (err) {
    res.status(502).json({
      error: 'Não foi possível carregar a lista M3U informada.',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// 3.5 Motor de Busca e Download Automático de Legendas Online (OpenSubtitles REST + Decompressão GZIP)
app.get('/api/subtitles', async (req, res) => {
  const rawTitle = String(req.query.title || '').trim();
  const season = req.query.season ? Number(req.query.season) : null;
  const episode = req.query.episode ? Number(req.query.episode) : null;
  const lang = String(req.query.lang || 'pob').toLowerCase();

  if (!rawTitle) {
    return res.status(400).json({ found: false, error: 'Título é obrigatório.' });
  }

  const cacheKey = `${rawTitle.toLowerCase()}|${season || ''}|${episode || ''}|${lang}`;
  if (subtitleCache.has(cacheKey)) {
    return res.json(subtitleCache.get(cacheKey));
  }

  try {
    // Extrai possível título original entre parênteses ex: "Legados (Legacies)"
    const parenMatch = rawTitle.match(/\(([a-zA-Z\s:'-]{3,})\)/);
    const englishAlt =
      parenMatch && !/^(leg|legendado|dub|dublado|dual)$/i.test(parenMatch[1].trim())
        ? parenMatch[1].trim()
        : null;

    // Limpa tags de IPTV ([Dual], [Leg], (2026), S01E01, FHD, 4K, etc.)
    const cleanBase = rawTitle
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\(\d{4}\)/g, '')
      .replace(/\((leg|legendado|dub|dublado|dual)\)/gi, '')
      .replace(/[-–:]?\s*S\d{1,2}\s*E\d{1,3}.*$/i, '')
      .replace(/\b(fhd|hd|sd|4k|uhd|h265|webrip|cam|dual|leg|legendado|dublado)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const candidateQueries = Array.from(
      new Set([englishAlt, cleanBase, cleanBase.split(':')[0].trim()].filter(Boolean))
    );

    const searchOpenSubtitles = async (queryText, subLang) => {
      // IMPORTANTE: A API REST do OpenSubtitles exige os parâmetros de rota em ordem alfabética!
      const segments = [];
      if (episode && Number.isFinite(episode)) segments.push(`episode-${episode}`);
      segments.push(`query-${encodeURIComponent(queryText.toLowerCase())}`);
      if (season && Number.isFinite(season)) segments.push(`season-${season}`);
      segments.push(`sublanguageid-${subLang}`);

      const searchUrl = `https://rest.opensubtitles.org/search/${segments.join('/')}`;
      const { res: osRes } = await fetchUrlRaw(searchUrl, {
        userAgent: 'TemporaryUserAgent',
        timeout: 12000,
      });

      const chunks = [];
      for await (const chunk of osRes) {
        chunks.push(chunk);
      }
      const text = Buffer.concat(chunks).toString('utf-8');
      const list = JSON.parse(text);
      return Array.isArray(list) ? list : [];
    };

    let results = [];
    for (const q of candidateQueries) {
      if (!q || q.length < 2) continue;
      results = await searchOpenSubtitles(q, lang).catch(() => []);
      if (results.length > 0) break;
      if (lang === 'pob') {
        results = await searchOpenSubtitles(q, 'por').catch(() => []);
        if (results.length > 0) break;
      }
    }

    if (!results || results.length === 0) {
      return res.json({ found: false });
    }

    // Prioriza legendas completas (.srt) que não sejam apenas FORCED e que batam com o ano do filme
    const yearMatch = rawTitle.match(/\((\d{4})\)/);
    const targetYear = yearMatch ? yearMatch[1] : null;
    const srtResults = results.filter(
      (item) =>
        item &&
        item.SubDownloadLink &&
        String(item.SubFormat || 'srt').toLowerCase() === 'srt' &&
        !/forced/i.test(String(item.SubFileName || ''))
    );
    const chosen =
      (targetYear &&
        srtResults.find(
          (item) =>
            String(item.MovieYear || '') === targetYear ||
            String(item.SubFileName || '').includes(targetYear)
        )) ||
      srtResults[0] ||
      results[0];

    if (!chosen || !chosen.SubDownloadLink) {
      return res.json({ found: false });
    }

    const { res: gzStream } = await fetchUrlRaw(chosen.SubDownloadLink, {
      userAgent: 'TemporaryUserAgent',
      timeout: 15000,
    });

    const gzChunks = [];
    for await (const chunk of gzStream) {
      gzChunks.push(chunk);
    }
    const gzBuffer = Buffer.concat(gzChunks);
    const rawSrtBuffer = zlib.gunzipSync(gzBuffer);

    // Detecta automaticamente UTF-8 vs Latin1 (ISO-8859-1 / Windows-1252 comum em legendas PT-BR)
    let srtText = rawSrtBuffer.toString('utf-8');
    if (srtText.includes('\uFFFD')) {
      srtText = rawSrtBuffer.toString('latin1');
    }

    // Remove propagandas de cabeçalho do OpenSubtitles
    srtText = srtText
      .replace(/.*OpenSubtitles.*/gi, '')
      .replace(/.*osdb\.link.*/gi, '');

    const payload = {
      found: true,
      fileName: chosen.SubFileName || `${cleanBase}.srt`,
      lang: chosen.SubLanguageID || lang,
      srt: srtText,
    };

    subtitleCache.set(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    return res.json({
      found: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// 3.6 Tradutor em Tempo Real de Closed Captions / Falas Ao Vivo (PT-BR <-> EN-US)
app.get('/api/translate', async (req, res) => {
  const text = String(req.query.text || '').trim();
  const from = String(req.query.from || 'pt').trim();
  const to = String(req.query.to || 'en').trim();

  if (!text) {
    return res.json({ translatedText: '' });
  }

  const cacheKey = `${from}|${to}|${text.toLowerCase()}`;
  if (translationCache.has(cacheKey)) {
    return res.json({ translatedText: translationCache.get(cacheKey) });
  }

  try {
    // 1. Motor Neural Ultrarrápido (~45ms) via Google Translate API (dict-chrome-ex)
    const gUrl = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(
      from
    )}&tl=${encodeURIComponent(to)}&q=${encodeURIComponent(text)}`;
    const { res: gRes } = await fetchUrlRaw(gUrl, { timeout: 3500 });
    const gChunks = [];
    for await (const c of gRes) {
      gChunks.push(c);
    }
    const gRaw = Buffer.concat(gChunks).toString('utf-8');
    const gData = JSON.parse(gRaw);
    const gTranslated = Array.isArray(gData)
      ? typeof gData[0] === 'string'
        ? gData[0]
        : Array.isArray(gData[0])
        ? gData[0].map((x) => (Array.isArray(x) ? x[0] : x)).join('')
        : ''
      : '';
    if (gTranslated && gTranslated.trim()) {
      const clean = gTranslated.trim();
      translationCache.set(cacheKey, clean);
      return res.json({ translatedText: clean });
    }
  } catch {
    // Fallback para MyMemory
  }

  try {
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=${encodeURIComponent(`${from}|${to}`)}`;
    const { res: upRes } = await fetchUrlRaw(apiUrl, { timeout: 6000 });
    const chunks = [];
    for await (const c of upRes) {
      chunks.push(c);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    const translated = data?.responseData?.translatedText || text;
    translationCache.set(cacheKey, translated);
    return res.json({ translatedText: translated });
  } catch {
    return res.json({ translatedText: text });
  }
});

// 3.6. Voz Neural em Inglês (TTS MP3 Real-Time para SAP Sintético em Canais Ao Vivo)
const ttsAudioCache = new Map();
app.get('/api/tts', async (req, res) => {
  const text = String(req.query.text || '').trim().slice(0, 200);
  const lang = String(req.query.lang || 'en').trim();

  if (!text) {
    return res.status(400).send('Missing text');
  }

  const cacheKey = `${lang}|${text.toLowerCase()}`;
  if (ttsAudioCache.has(cacheKey)) {
    const buf = ttsAudioCache.get(cacheKey);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.end(buf);
  }

  try {
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
      lang
    )}&q=${encodeURIComponent(text)}`;
    const { res: upRes } = await fetchUrlRaw(ttsUrl, { timeout: 5000 });
    const chunks = [];
    for await (const c of upRes) {
      chunks.push(c);
    }
    const audioBuf = Buffer.concat(chunks);
    if (audioBuf.length > 200) {
      if (ttsAudioCache.size > 200) {
        const firstKey = ttsAudioCache.keys().next().value;
        ttsAudioCache.delete(firstKey);
      }
      ttsAudioCache.set(cacheKey, audioBuf);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuf.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.end(audioBuf);
  } catch (err) {
    return res.status(502).send(String(err));
  }
});

// 4. Proxy Inteligente de Stream (HLS .m3u8, MPEG-TS .ts, MP4, MKV) com Gerenciamento de Buffers e Troca de Áudio Dual
app.get('/api/stream', async (req, res) => {
  const rawTargetUrl = req.query.url ? String(req.query.url) : '';
  const requestedAudioTrack = req.query.audioTrack ? Number(req.query.audioTrack) : 0;
  if (!rawTargetUrl) {
    return res.status(400).send('Missing stream url');
  }

  try {
    const forwardHeaders = {};
    if (req.headers.range) {
      forwardHeaders['Range'] = req.headers.range;
    }

    // Verifica se já temos uma URL de edge/token redirecionada em cache para esta stream HLS
    const cachedRedirect = streamRedirectCache.get(rawTargetUrl);
    const effectiveTargetUrl =
      cachedRedirect && cachedRedirect.expiresAt > Date.now()
        ? cachedRedirect.finalUrl
        : rawTargetUrl;

    let { res: upstream, finalUrl } = await fetchUrlRaw(effectiveTargetUrl, {
      headers: forwardHeaders,
      timeout: 15000,
    });

    // Se a URL em cache expirou no servidor edge (403/404), limpa o cache e busca novo token na URL original
    if (
      effectiveTargetUrl !== rawTargetUrl &&
      upstream.statusCode &&
      upstream.statusCode >= 400
    ) {
      upstream.resume();
      streamRedirectCache.delete(rawTargetUrl);
      const retry = await fetchUrlRaw(rawTargetUrl, {
        headers: forwardHeaders,
        timeout: 15000,
      });
      upstream = retry.res;
      finalUrl = retry.finalUrl;
    }

    if (finalUrl !== rawTargetUrl && (upstream.statusCode === 200 || upstream.statusCode === 206)) {
      streamRedirectCache.set(rawTargetUrl, {
        finalUrl,
        expiresAt: Date.now() + 3 * 60 * 1000, // 3 minutos de sessão ativa
      });
    }

    const contentType = (upstream.headers['content-type'] || '').toLowerCase();
    const isM3u8 =
      finalUrl.toLowerCase().includes('.m3u8') ||
      rawTargetUrl.toLowerCase().includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('x-mpegurl');

    // Se for um manifesto HLS (.m3u8), lê os primeiros chunks para confirmar se é texto #EXTM3U
    if (isM3u8) {
      const chunks = [];
      upstream.on('data', (c) => chunks.push(c));
      upstream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const manifestText = buffer.toString('utf-8');

        // Caso o servidor tenha retornado binário TS mesmo com extensão .m3u8
        if (!manifestText.trimStart().startsWith('#EXTM3U')) {
          res.setHeader('Content-Type', upstream.headers['content-type'] || 'video/mp2t');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.send(buffer);
        }

        const baseObj = new URL(finalUrl);

        const rewritten = manifestText
          .split(/\r?\n/)
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;
            if (trimmed.startsWith('#')) {
              return line.replace(/URI="([^"]+)"/g, (_match, uriVal) => {
                try {
                  const absUri = new URL(uriVal, baseObj).toString();
                  return `URI="/api/stream?url=${encodeURIComponent(absUri)}"`;
                } catch {
                  return _match;
                }
              });
            }
            try {
              const absSegmentUrl = new URL(trimmed, baseObj).toString();
              return `/api/stream?url=${encodeURIComponent(absSegmentUrl)}`;
            } catch {
              return line;
            }
          })
          .join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(rewritten);
      });
      return;
    }

    // Stream binário contínuo (.ts, .mp4, .aac, etc.)
    // Se for uma stream contínua .ts ao vivo (e não um arquivo VOD/Série com Range ou segmento HLS),
    // encerra conexões órfãs de outros canais para respeitar max_connections do servidor IPTV
    const isHlsSegment = /\/hls\/|_\d+\.ts/i.test(finalUrl);
    const isVodOrSeriesFile = /\.(mp4|mkv|avi|mov|webm)(\?|$)/i.test(finalUrl) || /\/(movie|series)\//i.test(rawTargetUrl);
    if (!isHlsSegment && !isVodOrSeriesFile && activeUpstreamStreams.size >= 2) {
      for (const oldStream of activeUpstreamStreams) {
        try {
          oldStream.destroy();
        } catch {
          // ignore
        }
        activeUpstreamStreams.delete(oldStream);
      }
    }

    activeStreams++;
    if (!isVodOrSeriesFile) {
      activeUpstreamStreams.add(upstream);
    }

    if (upstream.statusCode) {
      res.status(upstream.statusCode);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (upstream.headers['content-type']) {
      res.setHeader('Content-Type', upstream.headers['content-type']);
    } else if (/\.mp4(\?|$)/i.test(finalUrl) || /\.mp4(\?|$)/i.test(rawTargetUrl)) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (/\.mkv(\?|$)/i.test(finalUrl) || /\.mkv(\?|$)/i.test(rawTargetUrl)) {
      res.setHeader('Content-Type', 'video/x-matroska');
    }
    if (upstream.headers['content-length'] && Number(upstream.headers['content-length']) > 0) {
      res.setHeader('Content-Length', upstream.headers['content-length']);
    }
    if (upstream.headers['content-range']) {
      res.setHeader('Content-Range', upstream.headers['content-range']);
    }
    if (upstream.headers['accept-ranges']) {
      res.setHeader('Accept-Ranges', upstream.headers['accept-ranges']);
    } else if (isVodOrSeriesFile) {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    upstream.on('data', (chunk) => {
      totalBytesTransferred += chunk.length;
    });

    let cleanedUp = false;
    const cleanup = () => {
      if (!cleanedUp) {
        cleanedUp = true;
        activeStreams = Math.max(0, activeStreams - 1);
        activeUpstreamStreams.delete(upstream);
        upstream.destroy();
      }
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
    upstream.on('end', cleanup);
    upstream.on('error', cleanup);

    // Se o usuário selecionou Áudio Original em Inglês (audioTrack=1) em um filme/série MP4 [Dual],
    // aplica o patch binário em tempo real no átomo moov para desativar a faixa 0 (Dublado) e ativar a faixa 1 (Inglês)!
    const isMp4Stream =
      /\.mp4(\?|$)/i.test(finalUrl) ||
      /\.mp4(\?|$)/i.test(rawTargetUrl) ||
      (upstream.headers['content-type'] || '').toLowerCase().includes('mp4');

    if (requestedAudioTrack > 0 && isMp4Stream) {
      upstream.pause();
      const sounTracks = await getMp4SounTrackOffsets(finalUrl);
      if (sounTracks.length >= 2) {
        const targetTrackIdx = Math.min(requestedAudioTrack, sounTracks.length - 1);
        let streamBytePos = 0;
        const contentRangeHeader = upstream.headers['content-range'];
        if (contentRangeHeader) {
          const rangeMatch = String(contentRangeHeader).match(/bytes\s+(\d+)-/i);
          if (rangeMatch) {
            streamBytePos = parseInt(rangeMatch[1], 10) || 0;
          }
        }

        const writeBytesAtGlobalOffset = (chunkBuf, chunkStart, globalPos, bytesToWrite) => {
          for (let b = 0; b < bytesToWrite.length; b++) {
            const pos = globalPos + b;
            if (pos >= chunkStart && pos < chunkStart + chunkBuf.length) {
              chunkBuf[pos - chunkStart] = bytesToWrite[b];
            }
          }
        };

        upstream.on('data', (chunk) => {
          const buf = Buffer.from(chunk);
          const chunkStart = streamBytePos;
          streamBytePos += buf.length;

          // Só precisa verificar se o chunk está nos primeiros 12MB onde fica o moov
          if (chunkStart < 12 * 1024 * 1024) {
            for (let idx = 0; idx < sounTracks.length; idx++) {
              const tr = sounTracks[idx];
              if (idx === targetTrackIdx) {
                // Ativa a faixa de áudio escolhida (Inglês Original): 'trak' + flags = 0x03
                writeBytesAtGlobalOffset(buf, chunkStart, tr.trakTypeOffset, [0x74, 0x72, 0x61, 0x6b]);
                writeBytesAtGlobalOffset(buf, chunkStart, tr.tkhdFlagsByteOffset, [0x03]);
              } else {
                // Oculta a outra faixa de áudio (Dublado) transformando 'trak' em 'free' e flags = 0x00
                writeBytesAtGlobalOffset(buf, chunkStart, tr.trakTypeOffset, [0x66, 0x72, 0x65, 0x65]);
                writeBytesAtGlobalOffset(buf, chunkStart, tr.tkhdFlagsByteOffset, [0x00]);
              }
            }
          }

          res.write(buf);
        });
        upstream.on('end', () => {
          res.end();
        });
        upstream.resume();
        return;
      }
      upstream.resume();
    }

    upstream.pipe(res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Erro ao transmitir buffer de stream',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }
});

// Serve o frontend e a rota /admin também diretamente na porta 4150 (ou redireciona para 5173 em dev)
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

// Rota direta para baixar o instalador APK no Celular, Tablet ou Android TV pela rede Wi-Fi ou VPS
app.get(['/download/nextplay.apk', '/apk'], (_req, res) => {
  const apkCandidates = [
    path.join(__dirname, '..', 'public', 'download', 'nextplay.apk'),
    path.join(__dirname, '..', 'dist', 'download', 'nextplay.apk'),
    path.join(__dirname, '..', 'NextPlay-Universal-Mobile-TV.apk'),
    path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  ];
  for (const candidate of apkCandidates) {
    if (fs.existsSync(candidate)) {
      return res.download(candidate, 'NextPlay-Universal-Mobile-TV.apk');
    }
  }
  return res.status(404).json({ error: 'Arquivo APK ainda não compilado.' });
});

app.get(['/admin', '/admin/*'], (_req, res) => {
  const distIndex = path.join(distDir, 'index.html');
  if (fs.existsSync(distIndex) && process.env.NODE_ENV === 'production') {
    return res.sendFile(distIndex);
  }
  return res.redirect('http://localhost:5173/admin');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ [NextPlay Engine] Micro-servidor Express ativo em http://0.0.0.0:${PORT}`);
  console.log(`🛡️ [NextPlay Admin] Painel Web disponível em http://localhost:5173/admin (Login: ${db.admin.email} / admin123)`);
});

