export type MediaType = 'live' | 'movie' | 'series';

export type ConnectionType = 'demo' | 'm3u_url' | 'm3u_file' | 'xtream';

export interface EpgProgram {
  id: string;
  title: string;
  description: string;
  start: string; // HH:mm
  end: string;   // HH:mm
  progress: number; // 0 to 100
}

export interface XtreamInlineAuth {
  serverUrl: string;
  serverId?: string;
  username: string;
  password: string;
}

export interface PublicServerOption {
  id: string;
  name: string;
  region: string;
  format: 'm3u8' | 'ts';
  isDefault?: boolean;
}

export interface AdminServerItem extends PublicServerOption {
  dnsUrl: string;
  active: boolean;
  createdAt: number;
  linkedUsersCount?: number;
}

export interface UserIptvLink {
  serverId: string;
  serverName: string;
  serverDns?: string;
  format: 'm3u8' | 'ts';
  username: string;
  password: string;
  linkedAt: number;
  accountInfo?: XtreamAccountInfo | null;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  provider: 'email' | 'google';
  avatarUrl?: string | null;
  status: 'active' | 'blocked';
  createdAt: number;
  lastLoginAt?: number | null;
  iptvLink?: UserIptvLink | null;
}

export interface PublicAppConfig {
  appName: string;
  supportWhatsapp: string;
  googleClientId: string;
  allowDemoMode: boolean;
}

export interface SeriesEpisode {
  id: string;
  episodeNum: number;
  seasonNumber: number;
  title: string;
  url: string;
  containerExtension: string;
  duration?: string;
  plot?: string;
  cover?: string;
  rating?: string;
}

export interface SeriesSeason {
  seasonNumber: number;
  name: string;
  episodes: SeriesEpisode[];
}

export interface SeriesDetails {
  seriesId: number | string;
  name: string;
  cover?: string;
  backdropUrl?: string;
  plot?: string;
  cast?: string;
  genre?: string;
  rating?: string;
  releaseDate?: string;
  seasons: SeriesSeason[];
}

export interface ChannelItem {
  id: string;
  name: string;
  group: string;
  categoryId?: string;
  logo?: string;
  backdropUrl?: string;
  url: string;
  mediaType: MediaType;
  tvgId?: string;
  streamId?: number | string;
  seriesId?: number | string;
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  containerExtension?: string;
  rating?: string;
  year?: string;
  plot?: string;
  cast?: string;
  genre?: string;
  xtreamAuth?: XtreamInlineAuth;
  epgCurrent?: EpgProgram;
  epgNext?: EpgProgram;
}

export interface CategoryItem {
  id: string;
  name: string;
  count: number;
  icon?: string;
}

export interface XtreamAccountInfo {
  username: string;
  status: string;
  expDate: string | null;
  isTrial: boolean;
  activeCons: number;
  maxConnections: number;
  serverProtocol?: string;
  serverUrl: string;
}

export interface PlaylistProfile {
  id: string;
  name: string;
  type: ConnectionType;
  createdAt: number;
  // M3U URL
  m3uUrl?: string;
  // Xtream Codes
  serverUrl?: string;
  username?: string;
  password?: string;
  accountInfo?: XtreamAccountInfo;
}

export interface WatchHistoryItem {
  channel: ChannelItem;
  lastWatchedAt: number;
  progressSeconds?: number;
  durationSeconds?: number;
}

export interface EngineTelemetry {
  status: 'online' | 'standalone';
  engine: string;
  hwAcceleration: string;
  activeStreams: number;
  totalMBTransferred: number;
  memoryMB: {
    rss: number;
    heapUsed: number;
  };
  uptimeSec: number;
}

