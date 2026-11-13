import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Home,
  Tv,
  Film,
  Clapperboard,
  Heart,
  History,
  Search,
  PlusCircle,
  Settings,
  Minus,
  Square,
  X,
  Cpu,
  Wifi,
  CalendarClock,
  FolderKanban,
  Flame,
  Rocket,
  Music,
  Play,
  Menu,
  LogOut,
  User,
  ChevronDown,
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  SlidersHorizontal,
  Shield,
  Link2,
  Users,
} from 'lucide-react';
import {
  ChannelItem,
  CategoryItem,
  PlaylistProfile,
  WatchHistoryItem,
  EngineTelemetry,
  MediaType,
  SeriesDetails,
  SeriesEpisode,
  UserAccount,
  UserSubProfile,
  PublicServerOption,
  PublicAppConfig,
} from './types/iptv';
import { DEMO_CHANNELS } from './services/demoPlaylist';
import { parseM3UContent } from './services/m3uParser';
import {
  connectXtreamCodes,
  extractXtreamFromM3uUrl,
  fetchXtreamSeriesInfo,
} from './services/xtreamService';
import {
  createUserProfile,
  deleteUserProfile,
  ensureClientUserProfiles,
  fetchCurrentSession,
  fetchPublicConfig,
  getUserToken,
  linkIptvToAccount,
  loginAccount,
  loginWithGoogle,
  registerAccount,
  setUserToken,
  syncUserProfileState,
  unlinkIptvFromAccount,
  updateUserProfile,
} from './services/authService';
import {
  findAlternateAudioVariant,
  isLegendadoItem,
} from './services/subtitleEngine';
import { VideoPlayerEngine } from './components/VideoPlayerEngine';
import { VirtualChannelCatalog } from './components/VirtualChannelCatalog';
import { SeriesEpisodeSelector } from './components/SeriesEpisodeSelector';
import { ConnectionModal } from './components/ConnectionModal';
import { AuthPortalScreen, UpscalingMode, ZeroDelayMode } from './components/AuthPortalScreen';
import { AdminPanelScreen } from './components/AdminPanelScreen';
import { NextPlayIntroAnimation } from './components/NextPlayIntroAnimation';
import { HistoryManagerPanel } from './components/HistoryManagerPanel';
import { HistoryClearScope, clearHistoryByScope, updateWatchProgress } from './services/historyManager';
import { NetflixCatalogView } from './components/NetflixCatalogView';
import { LiveTvGuideView } from './components/LiveTvGuideView';
import { OnDemandCatalogView } from './components/OnDemandCatalogView';
import { isAdultContent, getParentalPin, setParentalPin } from './services/contentFilter';
import { ParentalPinModal } from './components/ParentalPinModal';
import { MediaDetailsModal } from './components/MediaDetailsModal';
import { GlobalOmniSearchModal } from './components/GlobalOmniSearchModal';
import { ProfileGateScreen, ProfileAvatarBadge } from './components/ProfileGateScreen';
import { LayoutGrid, List, Lock, MessageCircle, Minimize2, Maximize2 } from 'lucide-react';

declare global {
  interface Window {
    nextplayDesktop?: {
      isElectron: boolean;
      minimize: () => Promise<void>;
      toggleMaximize: () => Promise<boolean>;
      close: () => Promise<void>;
    };
  }
}

const STORAGE_KEYS = {
  PROFILES: 'nextplay_profiles_v1',
  FAVORITES: 'nextplay_favorites_v1',
  HISTORY: 'nextplay_history_v1',
  LOCAL_M3U_CACHE: 'nextplay_local_m3u_cache_v1',
  UPSCALING: 'nextplay_upscaling_v1',
  ZERO_DELAY: 'nextplay_zero_delay_v1',
  SMART_AUDIO: 'nextplay_smart_audio_v1',
};

export const App: React.FC = () => {
  // Detecta se está na rota do Painel Administrativo (/admin)
  const [isAdminView, setIsAdminView] = useState<boolean>(() => {
    return (
      window.location.pathname.startsWith('/admin') ||
      window.location.hash === '#admin' ||
      new URLSearchParams(window.location.search).get('admin') === '1'
    );
  });

  // Controla a exibição da Abertura Cinematográfica estilo Saimo TV / NextPlay
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    return !(
      window.location.pathname.startsWith('/admin') ||
      window.location.hash === '#admin' ||
      new URLSearchParams(window.location.search).get('admin') === '1'
    );
  });

  // Controla se o usuário está no Painel de Login/Entrada ou dentro do Player Principal
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Estado da Conta do Cliente (E-mail ou Google) e Lista de Servidores do Admin
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeUserProfile, setActiveUserProfile] = useState<UserSubProfile | null>(null);
  const [isChoosingProfile, setIsChoosingProfile] = useState<boolean>(true);
  const [publicServers, setPublicServers] = useState<PublicServerOption[]>([]);
  const [appConfig, setAppConfig] = useState<PublicAppConfig>({
    appName: 'NextPlay',
    supportWhatsapp: '',
    googleClientId: '',
    allowDemoMode: true,
  });
  const [isAutoConnecting, setIsAutoConnecting] = useState<boolean>(false);
  const [autoConnectError, setAutoConnectError] = useState<string | null>(null);

  // Ajustes de Imagem e Transmissão (Super Resolução Upscaling, Zero Delay e Áudio Inteligente)
  const [upscaling, setUpscaling] = useState<UpscalingMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.UPSCALING);
    return saved === 'hd' || saved === '4k' ? saved : 'hd';
  });
  const [zeroDelay, setZeroDelay] = useState<ZeroDelayMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ZERO_DELAY);
    return saved === 'off' || saved === 'agressivo' ? saved : 'equilibrado';
  });
  const [smartAudio, setSmartAudio] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.SMART_AUDIO) !== 'false';
  });

  useEffect(() => {
    document.documentElement.dataset.upscaling = upscaling;
    localStorage.setItem(STORAGE_KEYS.UPSCALING, upscaling);
  }, [upscaling]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ZERO_DELAY, zeroDelay);
  }, [zeroDelay]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SMART_AUDIO, String(smartAudio));
  }, [smartAudio]);

  // Lista de canais em memória
  const [channels, setChannels] = useState<ChannelItem[]>(DEMO_CHANNELS);
  const [activeChannel, setActiveChannel] = useState<ChannelItem | null>(null);

  // Estado de Temporadas e Episódios da Série selecionada
  const [activeSeriesDetails, setActiveSeriesDetails] = useState<SeriesDetails | null>(null);
  const [isLoadingSeries, setIsLoadingSeries] = useState<boolean>(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  // Filtros de navegação (Home, Categorias, Mídia, Idioma Dublado/Legendado, Favoritos, Histórico, EPG)
  const [selectedNav, setSelectedNav] = useState<'all' | 'favorites' | 'history' | 'epg'>('all');
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | MediaType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [languageFilter, setLanguageFilter] = useState<'all' | 'dub' | 'leg'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [catalogLayout, setCatalogLayout] = useState<'netflix' | 'list'>('netflix');

  // Perfis de listas / logins salvos
  const [profiles, setProfiles] = useState<PlaylistProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: 'demo-default',
        name: 'NextPlay Official Showcase',
        type: 'demo',
        createdAt: Date.now(),
      },
    ];
  });
  const [activeProfileId, setActiveProfileId] = useState<string>('demo-default');

  // Favoritos e Histórico
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (raw) return new Set(JSON.parse(raw));
    } catch {
      // ignore
    }
    return new Set(['demo-cyber-drive', 'demo-tears-steel']);
  });

  const [history, setHistory] = useState<WatchHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Filtra e remove imediatamente qualquer conteúdo adulto (+18) do histórico salvo
        return Array.isArray(parsed)
          ? parsed.filter((item: WatchHistoryItem) => !isAdultContent(item.channel))
          : [];
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Configurações do Motor de Vídeo e Micro-Servidor Express (Ativo por padrão para cachear tokens 302 e Keep-Alive)
  const [useProxyBuffer, setUseProxyBuffer] = useState<boolean>(true);
  const [showSpectrum, setShowSpectrum] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Controle dos Pais & PIN para Conteúdo Adulto (+18)
  const [parentalPin, setLocalParentalPin] = useState<string>(() => getParentalPin());
  const [isParentalUnlocked, setIsParentalUnlocked] = useState<boolean>(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pendingAdultChannel, setPendingAdultChannel] = useState<ChannelItem | null>(null);
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState<boolean>(false);

  // 1. Modal de Detalhes Cinematográficos (Estilo Netflix / Disney+)
  const [detailItem, setDetailItem] = useState<ChannelItem | null>(null);

  // 2. Busca Global Unificada (OmniSearch)
  const [isOmniSearchOpen, setIsOmniSearchOpen] = useState<boolean>(false);

  // 3. Mini-Player Flutuante (In-App PiP)
  const [isPlayerMinimized, setIsPlayerMinimized] = useState<boolean>(false);

  // 4. Indicador de Zapping Numérico para Controle Remoto (HUD)
  const [zappingDisplay, setZappingDisplay] = useState<string | null>(null);
  const zappingBufferRef = React.useRef<string>('');
  const zappingTimerRef = React.useRef<any>(null);

  // 5. Suporte WhatsApp do Revendedor / Marca Própria
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>(() => {
    return localStorage.getItem('nextplay_support_whatsapp_v1') || '5511999999999';
  });

  const [telemetry, setTelemetry] = useState<EngineTelemetry>({
    status: 'standalone',
    engine: 'NextPlay Express Engine',
    hwAcceleration: 'DirectComposition GPU',
    activeStreams: 1,
    totalMBTransferred: 0,
    memoryMB: { rss: 44.2, heapUsed: 26.8 },
    uptimeSec: 0,
  });

  // Monitora telemetria do Micro-Servidor Express local a cada 5s
  useEffect(() => {
    let mounted = true;
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok && mounted) {
          const data = await res.json();
          setTelemetry({
            status: 'online',
            engine: data.engine,
            hwAcceleration: data.hwAcceleration,
            activeStreams: data.activeStreams,
            totalMBTransferred: data.totalMBTransferred,
            memoryMB: data.memoryMB,
            uptimeSec: data.uptimeSec,
          });
        }
      } catch {
        // Modo standalone (ex: Android APK nativo)
      }
    };
    fetchHealth();
    const timer = setInterval(fetchHealth, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  // Persiste favoritos e histórico individualmente por Perfil Estilo Netflix (Local + Servidor)
  const userSubProfiles = useMemo(
    () => ensureClientUserProfiles(currentUser),
    [currentUser]
  );

  const syncTimerRef = React.useRef<any>(null);

  useEffect(() => {
    const profileKey = activeUserProfile?.id || 'default';
    const favArray = Array.from(favorites);
    try {
      localStorage.setItem(`${STORAGE_KEYS.FAVORITES}_${profileKey}`, JSON.stringify(favArray));
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favArray));
    } catch {
      // ignore
    }

    if (activeUserProfile) {
      setCurrentUser((prev) => {
        if (!prev || !Array.isArray(prev.profiles)) return prev;
        return {
          ...prev,
          profiles: prev.profiles.map((p) =>
            p.id === activeUserProfile.id ? { ...p, favorites: favArray, history } : p
          ),
        };
      });

      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        syncUserProfileState(activeUserProfile.id, {
          favorites: favArray,
          history,
        });
      }, 900);
    }
  }, [favorites, history, activeUserProfile]);

  useEffect(() => {
    const profileKey = activeUserProfile?.id || 'default';
    try {
      localStorage.setItem(`${STORAGE_KEYS.HISTORY}_${profileKey}`, JSON.stringify(history));
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch {
      // ignore
    }
  }, [history, activeUserProfile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    } catch {
      // ignore
    }
  }, [profiles]);

  // Reproduz um episódio específico dentro de uma Série ativa
  const handleSelectEpisode = useCallback((episode: SeriesEpisode, series: SeriesDetails) => {
    const epChannel: ChannelItem = {
      id: `xt-ep-${episode.id}`,
      name: episode.title,
      group: series.name,
      logo: episode.cover || series.cover,
      backdropUrl: series.backdropUrl,
      url: episode.url,
      mediaType: 'series',
      streamId: episode.id,
      seriesId: series.seriesId,
      seriesName: series.name,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNum,
      containerExtension: episode.containerExtension,
      rating: episode.rating || series.rating,
      plot: episode.plot || series.plot,
    };

    setActiveChannel(epChannel);
    setHistory((prev) => {
      const existing = prev.find((item) => item.channel.id === epChannel.id);
      const filtered = prev.filter((item) => item.channel.id !== epChannel.id);
      const updated = [
        {
          channel: epChannel,
          lastWatchedAt: Date.now(),
          progressSeconds: existing?.progressSeconds || 0,
          durationSeconds: existing?.durationSeconds || 0,
        },
        ...filtered,
      ].slice(0, 50);
      try {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  // Seleciona canal/filme/série e salva no histórico "Continuar Assistindo"
  const handleSelectChannel = useCallback(
    async (channel: ChannelItem) => {
      setMobileSidebarOpen(false);
      setSeriesError(null);

      // Caso 1: É uma Série do servidor Xtream Codes (possui seriesId para buscar temporadas e episódios)
      if (channel.mediaType === 'series' && channel.seriesId && channel.xtreamAuth) {
        setIsLoadingSeries(true);
        try {
          const details = await fetchXtreamSeriesInfo(
            channel.xtreamAuth.serverUrl,
            channel.xtreamAuth.username,
            channel.xtreamAuth.password,
            channel.seriesId,
            channel.name
          );
          setActiveSeriesDetails(details);
          setIsLoadingSeries(false);

          const firstSeason = details.seasons[0];
          const firstEp = firstSeason?.episodes[0];
          if (firstEp) {
            handleSelectEpisode(firstEp, details);
            return;
          } else {
            setSeriesError('Esta série ainda não possui episódios cadastrados no servidor.');
          }
        } catch (err) {
          setIsLoadingSeries(false);
          setSeriesError(
            err instanceof Error ? err.message : 'Erro ao carregar episódios desta série.'
          );
        }
      } else if (channel.mediaType === 'series' && !channel.seriesId) {
        // Caso 2: Série de lista M3U estática (agrupa episódios da mesma série automaticamente)
        const targetSeriesName = channel.seriesName || channel.name;
        const relatedEps = channels.filter(
          (c) => c.mediaType === 'series' && (c.seriesName || c.name) === targetSeriesName
        );
        if (relatedEps.length > 0) {
          const seasonsMap = new Map<number, SeriesEpisode[]>();
          relatedEps.forEach((epItem, idx) => {
            const sNum = epItem.seasonNumber || 1;
            const eNum = epItem.episodeNumber || idx + 1;
            const list = seasonsMap.get(sNum) || [];
            list.push({
              id: epItem.id,
              episodeNum: eNum,
              seasonNumber: sNum,
              title: epItem.name,
              url: epItem.url,
              containerExtension: epItem.containerExtension || 'mp4',
              plot: epItem.plot,
              cover: epItem.logo,
              rating: epItem.rating,
            });
            seasonsMap.set(sNum, list);
          });

          setActiveSeriesDetails({
            seriesId: `m3u-series-${targetSeriesName}`,
            name: targetSeriesName,
            cover: channel.logo,
            plot: channel.plot,
            rating: channel.rating,
            seasons: Array.from(seasonsMap.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([seasonNumber, episodes]) => ({
                seasonNumber,
                name: `Temporada ${seasonNumber}`,
                episodes: episodes.sort((a, b) => a.episodeNum - b.episodeNum),
              })),
          });
        } else {
          setActiveSeriesDetails(null);
        }
      } else {
        // Canal ao vivo ou Filme VOD
        setActiveSeriesDetails(null);
      }

      setActiveChannel(channel);

      // Conteúdos adultos (+18) NUNCA são salvos no histórico (Privacidade Absoluta)
      if (!isAdultContent(channel)) {
        setHistory((prev) => {
          const existing = prev.find((item) => item.channel.id === channel.id);
          const filtered = prev.filter((item) => item.channel.id !== channel.id);
          const updated = [
            {
              channel,
              lastWatchedAt: Date.now(),
              progressSeconds: existing?.progressSeconds || 0,
              durationSeconds: existing?.durationSeconds || 0,
            },
            ...filtered,
          ].slice(0, 50);
          try {
            localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });
      }
    },
    [channels, handleSelectEpisode]
  );

  // Salva o progresso exato de filmes e séries no histórico local "Continuar Assistindo"
  const handleProgressUpdate = useCallback(
    (channelId: string, progressSeconds: number, durationSeconds: number) => {
      setHistory((prev) => {
        const item = prev.find((h) => h.channel.id === channelId);
        if (!item) return prev;
        const updated = updateWatchProgress(prev, item.channel, progressSeconds, durationSeconds);
        try {
          localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    },
    []
  );

  // Suporte Avançado a Controle Remoto (D-Pad, Teclas Numéricas 0-9 e Atalhos Globais)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      // Atalho: / ou Ctrl+K abre a Busca Global Unificada (OmniSearch)
      if (e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setIsOmniSearchOpen(true);
        return;
      }

      // Navegação Espacial D-Pad (Setas do Controle Remoto Android TV / TV Box / Fire Stick)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const focusable = Array.from(
          document.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
        });

        if (focusable.length > 0) {
          const current = document.activeElement as HTMLElement | null;
          if (!current || !focusable.includes(current)) {
            e.preventDefault();
            focusable[0].focus();
            return;
          }

          const curRect = current.getBoundingClientRect();
          const curCenter = {
            x: curRect.left + curRect.width / 2,
            y: curRect.top + curRect.height / 2,
          };

          let bestCandidate: HTMLElement | null = null;
          let bestScore = Infinity;

          for (const cand of focusable) {
            if (cand === current) continue;
            const r = cand.getBoundingClientRect();
            const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            const dx = c.x - curCenter.x;
            const dy = c.y - curCenter.y;

            if (e.key === 'ArrowRight' && dx <= 6) continue;
            if (e.key === 'ArrowLeft' && dx >= -6) continue;
            if (e.key === 'ArrowDown' && dy <= 6) continue;
            if (e.key === 'ArrowUp' && dy >= -6) continue;

            const primaryDist = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? Math.abs(dx) : Math.abs(dy);
            const crossDist = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
            const score = primaryDist + crossDist * 2.6;

            if (score < bestScore) {
              bestScore = score;
              bestCandidate = cand;
            }
          }

          if (bestCandidate) {
            e.preventDefault();
            bestCandidate.focus();
            bestCandidate.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
            return;
          }
        }
      }

      // Atalho: Teclas Numéricas 0-9 para Zapping Rápido no Controle Remoto
      if (/^[0-9]$/.test(e.key)) {
        zappingBufferRef.current += e.key;
        setZappingDisplay(`Canal ${zappingBufferRef.current}`);

        if (zappingTimerRef.current) clearTimeout(zappingTimerRef.current);
        zappingTimerRef.current = setTimeout(() => {
          const channelNumber = parseInt(zappingBufferRef.current, 10);
          zappingBufferRef.current = '';
          setZappingDisplay(null);

          const liveList = channels.filter((c) => c.mediaType === 'live');
          if (liveList.length > 0 && channelNumber > 0 && channelNumber <= liveList.length) {
            handleSelectChannel(liveList[channelNumber - 1]);
          }
        }, 1300);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [channels, handleSelectChannel]);

  // Apaga o histórico local por escopo (Canais, Filmes, Séries ou Tudo) — apenas localStorage deste dispositivo
  const handleClearHistory = useCallback((scope: HistoryClearScope) => {
    setHistory((prev) => {
      const updated = clearHistoryByScope(prev, scope);
      try {
        if (updated.length === 0) {
          localStorage.removeItem(STORAGE_KEYS.HISTORY);
        } else {
          localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
        }
      } catch (err) {
        console.error('[NextPlay] Falha ao atualizar histórico local:', err);
      }
      return updated;
    });
  }, []);

  const handleToggleFavorite = useCallback((channelId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }, []);

  const handleToggleProxyBuffer = useCallback(() => {
    setUseProxyBuffer((v) => !v);
  }, []);

  const handleToggleSpectrum = useCallback(() => {
    setShowSpectrum((v) => !v);
  }, []);

  // Solicita inserção do PIN para canal ou conteúdo adulto
  const handleRequestParentalUnlock = useCallback((channel: ChannelItem) => {
    setPendingAdultChannel(channel);
    setIsPinModalOpen(true);
  }, []);

  // Sucesso na validação do PIN
  const handlePinSuccess = useCallback(() => {
    setIsParentalUnlocked(true);
    setIsPinModalOpen(false);
    if (pendingAdultChannel) {
      handleSelectChannel(pendingAdultChannel);
      setPendingAdultChannel(null);
    }
  }, [pendingAdultChannel, handleSelectChannel]);

  // Altera o PIN de Controle dos Pais
  const handleSaveNewPin = useCallback((newPin: string) => {
    if (setParentalPin(newPin)) {
      setLocalParentalPin(newPin);
      setPinChangeSuccess(true);
      setTimeout(() => setPinChangeSuccess(false), 3000);
    }
  }, []);

  // Categorias dinâmicas extraídas dos canais carregados (respeitando Perfil Kids)
  const categories = useMemo<CategoryItem[]>(() => {
    const counts = new Map<string, number>();
    for (const ch of channels) {
      if (activeUserProfile?.isKids && isAdultContent(ch)) continue;
      if (selectedMediaType !== 'all' && ch.mediaType !== selectedMediaType) continue;
      counts.set(ch.group, (counts.get(ch.group) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) => ({
      id: name,
      name,
      count,
    }));
  }, [channels, selectedMediaType, activeUserProfile]);

  // Canais filtrados com alta performance (useMemo)
  const filteredChannels = useMemo<ChannelItem[]>(() => {
    let baseList = activeUserProfile?.isKids
      ? channels.filter((c) => !isAdultContent(c))
      : channels;

    if (selectedNav === 'favorites') {
      baseList = baseList.filter((c) => favorites.has(c.id));
    } else if (selectedNav === 'history') {
      baseList = history
        .map((h) => h.channel)
        .filter((c) => !(activeUserProfile?.isKids && isAdultContent(c)));
    }

    if (selectedMediaType !== 'all') {
      baseList = baseList.filter((c) => c.mediaType === selectedMediaType);
    }

    if (selectedCategory !== 'ALL') {
      baseList = baseList.filter((c) => c.group === selectedCategory);
    }

    if (languageFilter === 'leg') {
      baseList = baseList.filter((c) => isLegendadoItem(c));
    } else if (languageFilter === 'dub') {
      baseList = baseList.filter((c) => !isLegendadoItem(c));
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      baseList = baseList.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.group.toLowerCase().includes(q) ||
          (c.epgCurrent && c.epgCurrent.title.toLowerCase().includes(q))
      );
    }

    return baseList;
  }, [
    channels,
    selectedNav,
    favorites,
    history,
    selectedMediaType,
    selectedCategory,
    languageFilter,
    searchQuery,
    activeUserProfile,
  ]);

  // Detecta automaticamente se o filme/série/canal atual possui versão alternativa Dublada <-> Legendada [Leg] na lista
  const alternateAudioChannel = useMemo(
    () => findAlternateAudioVariant(activeChannel, channels),
    [activeChannel, channels]
  );

  // Navegação Canal Anterior / Próximo (ou Episódio Anterior / Próximo quando assistindo Série)
  const handlePrevChannel = useCallback(() => {
    if (activeSeriesDetails && activeChannel?.mediaType === 'series') {
      const allEpisodes = activeSeriesDetails.seasons.flatMap((s) => s.episodes);
      if (allEpisodes.length > 0) {
        const curIdx = allEpisodes.findIndex(
          (ep) => `xt-ep-${ep.id}` === activeChannel.id || ep.id === activeChannel.id
        );
        const prevIdx = curIdx > 0 ? curIdx - 1 : allEpisodes.length - 1;
        handleSelectEpisode(allEpisodes[prevIdx], activeSeriesDetails);
        return;
      }
    }
    if (!activeChannel || filteredChannels.length === 0) return;
    const idx = filteredChannels.findIndex((c) => c.id === activeChannel.id);
    const prevIdx = idx > 0 ? idx - 1 : filteredChannels.length - 1;
    handleSelectChannel(filteredChannels[prevIdx]);
  }, [activeSeriesDetails, activeChannel, filteredChannels, handleSelectChannel, handleSelectEpisode]);

  const handleNextChannel = useCallback(() => {
    if (activeSeriesDetails && activeChannel?.mediaType === 'series') {
      const allEpisodes = activeSeriesDetails.seasons.flatMap((s) => s.episodes);
      if (allEpisodes.length > 0) {
        const curIdx = allEpisodes.findIndex(
          (ep) => `xt-ep-${ep.id}` === activeChannel.id || ep.id === activeChannel.id
        );
        const nextIdx = curIdx >= 0 && curIdx < allEpisodes.length - 1 ? curIdx + 1 : 0;
        handleSelectEpisode(allEpisodes[nextIdx], activeSeriesDetails);
        return;
      }
    }
    if (!activeChannel || filteredChannels.length === 0) return;
    const idx = filteredChannels.findIndex((c) => c.id === activeChannel.id);
    const nextIdx = idx >= 0 && idx < filteredChannels.length - 1 ? idx + 1 : 0;
    handleSelectChannel(filteredChannels[nextIdx]);
  }, [activeSeriesDetails, activeChannel, filteredChannels, handleSelectChannel, handleSelectEpisode]);

  // Conexão via Login e Senha (Xtream Codes API)
  const handleConnectXtream = async (
    name: string,
    serverUrl: string,
    username: string,
    password: string,
    format: 'm3u8' | 'ts'
  ) => {
    const { accountInfo, channels: xtChannels } = await connectXtreamCodes(
      serverUrl,
      username,
      password,
      format
    );
    if (xtChannels.length === 0) {
      throw new Error('Autenticado, mas nenhum canal/mídia foi retornado por este servidor.');
    }

    const newProfile: PlaylistProfile = {
      id: `xtream-${Date.now()}`,
      name,
      type: 'xtream',
      createdAt: Date.now(),
      serverUrl,
      username,
      password,
      accountInfo,
    };

    setProfiles((prev) => [
      newProfile,
      ...prev.filter((p) => !(p.type === 'xtream' && p.serverUrl === serverUrl && p.username === username)),
    ]);
    setActiveProfileId(newProfile.id);
    setChannels(xtChannels);
    setSelectedCategory('ALL');
    setSelectedNav('all');
    setUseProxyBuffer(true);
    setActiveChannel(null);
    setIsAuthenticated(true);
  };

  // Conexão via URL M3U / M3U8 (Detecta automaticamente shortlinks Xtream /p/user/pass/m3u ou usa Proxy Express)
  const handleConnectM3uUrl = async (name: string, m3uUrl: string) => {
    // 1. Verifica se o link M3U colado é de um servidor Xtream/QPanel (ex: http://e.cinemaxhub.xyz/p/514694/754197/m3u)
    const xtreamCreds = extractXtreamFromM3uUrl(m3uUrl);
    if (xtreamCreds) {
      await handleConnectXtream(
        name,
        xtreamCreds.serverUrl,
        xtreamCreds.username,
        xtreamCreds.password,
        'm3u8'
      );
      return;
    }

    // 2. Caso seja uma lista .M3U estática tradicional, baixa via Micro-Servidor Express
    let rawText = '';
    let proxyErrMsg = '';
    try {
      const proxyRes = await fetch(`/api/m3u?url=${encodeURIComponent(m3uUrl.trim())}`);
      if (proxyRes.ok) {
        rawText = await proxyRes.text();
      } else {
        const errJson = await proxyRes.json().catch(() => null);
        proxyErrMsg = errJson?.details || errJson?.error || `Status HTTP ${proxyRes.status}`;
      }
    } catch {
      // Fallback direto para Mobile Android Nativo
    }

    if (!rawText) {
      try {
        const directRes = await fetch(m3uUrl.trim());
        if (!directRes.ok) {
          throw new Error(`Status HTTP ${directRes.status}`);
        }
        rawText = await directRes.text();
      } catch {
        throw new Error(
          proxyErrMsg ||
            'Não foi possível acessar esta URL M3U. Verifique se o endereço do servidor existe e está online.'
        );
      }
    }

    const parsed = parseM3UContent(rawText);
    if (parsed.length === 0) {
      throw new Error('Nenhum canal válido encontrado na URL M3U informada.');
    }

    const newProfile: PlaylistProfile = {
      id: `m3u-url-${Date.now()}`,
      name,
      type: 'm3u_url',
      createdAt: Date.now(),
      m3uUrl: m3uUrl.trim(),
    };

    setProfiles((prev) => [newProfile, ...prev.filter((p) => p.m3uUrl !== m3uUrl.trim())]);
    setActiveProfileId(newProfile.id);
    setChannels(parsed);
    setSelectedCategory('ALL');
    setSelectedNav('all');
    setUseProxyBuffer(true);
    setActiveChannel(null);
    setIsAuthenticated(true);
  };

  // Conexão via Arquivo .M3U / .M3U8 Local
  const handleConnectM3uFile = async (name: string, rawContent: string) => {
    const parsed = parseM3UContent(rawContent);
    if (parsed.length === 0) {
      throw new Error('O arquivo selecionado não contém canais M3U válidos.');
    }

    const newProfile: PlaylistProfile = {
      id: `m3u-file-${Date.now()}`,
      name,
      type: 'm3u_file',
      createdAt: Date.now(),
    };

    try {
      localStorage.setItem(`${STORAGE_KEYS.LOCAL_M3U_CACHE}_${newProfile.id}`, rawContent);
    } catch {
      // Caso o arquivo seja muito grande para o localStorage, mantém em memória na sessão
    }

    setProfiles((prev) => [newProfile, ...prev]);
    setActiveProfileId(newProfile.id);
    setChannels(parsed);
    setSelectedCategory('ALL');
    setSelectedNav('all');
    setUseProxyBuffer(true);
    setActiveChannel(null);
    setIsAuthenticated(true);
  };

  const handleSelectProfile = async (profileId: string) => {
    const target = profiles.find((p) => p.id === profileId);
    if (!target) return;
    setActiveProfileId(target.id);

    if (target.type === 'demo') {
      setChannels(DEMO_CHANNELS);
      setSelectedCategory('ALL');
      setActiveChannel(null);
      setIsAuthenticated(true);
      return;
    }

    if (target.type === 'xtream' && target.serverUrl && target.username && target.password) {
      const { channels: xtChannels } = await connectXtreamCodes(
        target.serverUrl,
        target.username,
        target.password
      );
      if (xtChannels.length > 0) {
        setChannels(xtChannels);
        setSelectedCategory('ALL');
        setUseProxyBuffer(true);
        setActiveChannel(null);
        setIsAuthenticated(true);
      }
      return;
    }

    if (target.type === 'm3u_url' && target.m3uUrl) {
      await handleConnectM3uUrl(target.name, target.m3uUrl);
      return;
    }

    if (target.type === 'm3u_file') {
      const cached = localStorage.getItem(`${STORAGE_KEYS.LOCAL_M3U_CACHE}_${target.id}`);
      if (cached) {
        const parsed = parseM3UContent(cached);
        if (parsed.length > 0) {
          setChannels(parsed);
          setSelectedCategory('ALL');
          setActiveChannel(null);
          setIsAuthenticated(true);
          return;
        }
      }
      throw new Error('Selecione o arquivo .M3U novamente para recarregar esta lista local.');
    }
  };

  const handleDeleteProfile = (profileId: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    try {
      localStorage.removeItem(`${STORAGE_KEYS.LOCAL_M3U_CACHE}_${profileId}`);
    } catch {
      // ignore
    }
    if (activeProfileId === profileId) {
      setActiveProfileId('demo-default');
      setChannels(DEMO_CHANNELS);
      setActiveChannel(null);
    }
  };

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  // ==========================================================================
  // CONEXÃO AUTOMÁTICA DA LISTA VINCULADA À CONTA DO USUÁRIO
  // ==========================================================================
  const connectUserLinkedIptv = useCallback(async (user: UserAccount) => {
    if (!user.iptvLink) return;
    setIsAutoConnecting(true);
    setAutoConnectError(null);
    try {
      const { channels: xtChannels } = await connectXtreamCodes(
        user.iptvLink.serverId,
        user.iptvLink.username,
        user.iptvLink.password,
        user.iptvLink.format || 'm3u8'
      );
      if (xtChannels.length === 0) {
        throw new Error('Autenticado, mas nenhum canal foi retornado pelo servidor.');
      }
      setChannels(xtChannels);
      setSelectedCategory('ALL');
      setSelectedNav('all');
      setUseProxyBuffer(true);
      setActiveChannel(null);
      setIsChoosingProfile(true);
      setIsAuthenticated(true);
    } catch (err) {
      setAutoConnectError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar sua lista IPTV vinculada. Verifique seus dados ou escolha outro servidor.'
      );
      setIsAuthenticated(false);
    } finally {
      setIsAutoConnecting(false);
    }
  }, []);

  // Carrega configurações públicas (Servidores do Admin) e restaura sessão ativa do usuário
  const loadPublicConfigAndSession = useCallback(async () => {
    try {
      const pub = await fetchPublicConfig();
      setPublicServers(pub.servers || []);
      setAppConfig(pub.settings);
      if (pub.settings.supportWhatsapp) {
        setSupportWhatsapp(pub.settings.supportWhatsapp);
      }
    } catch {
      // ignore offline
    }

    if (getUserToken()) {
      try {
        const session = await fetchCurrentSession();
        setCurrentUser(session.user);
        if (session.servers) setPublicServers(session.servers);
        if (session.user.iptvLink) {
          await connectUserLinkedIptv(session.user);
        }
      } catch {
        setCurrentUser(null);
      }
    }
  }, [connectUserLinkedIptv]);

  useEffect(() => {
    loadPublicConfigAndSession();
  }, [loadPublicConfigAndSession]);

  // Sincroniza botão voltar/avançar do navegador com /admin
  useEffect(() => {
    const onPopState = () => {
      setIsAdminView(
        window.location.pathname.startsWith('/admin') ||
          window.location.hash === '#admin'
      );
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleOpenAdminPanel = useCallback(() => {
    try {
      window.history.pushState({}, '', '/admin');
    } catch {
      // ignore
    }
    setIsAdminView(true);
  }, []);

  const handleCloseAdminPanel = useCallback(() => {
    try {
      window.history.pushState({}, '', '/');
    } catch {
      // ignore
    }
    setIsAdminView(false);
    loadPublicConfigAndSession();
  }, [loadPublicConfigAndSession]);

  // Handlers de Autenticação da Conta do Cliente (E-mail e Google)
  const handleLoginEmail = async (email: string, password: string) => {
    const { user } = await loginAccount(email, password);
    setCurrentUser(user);
    setAutoConnectError(null);
    if (user.iptvLink) {
      await connectUserLinkedIptv(user);
    }
  };

  const handleRegisterEmail = async (name: string, email: string, password: string) => {
    const { user } = await registerAccount(name, email, password);
    setCurrentUser(user);
    setAutoConnectError(null);
    if (user.iptvLink) {
      await connectUserLinkedIptv(user);
    }
  };

  const handleLoginGoogle = async (payload: {
    email?: string;
    name?: string;
    avatarUrl?: string;
    credential?: string;
    accessToken?: string;
  }) => {
    const { user } = await loginWithGoogle(payload);
    setCurrentUser(user);
    setAutoConnectError(null);
    if (user.iptvLink) {
      await connectUserLinkedIptv(user);
    }
  };

  // Handler que valida o Usuário/Senha IPTV no Servidor escolhido e salva o vínculo na conta do cliente
  const handleLinkIptvAndConnect = async (
    serverId: string,
    iptvUsername: string,
    iptvPassword: string
  ) => {
    const srv = publicServers.find((s) => s.id === serverId);
    const format = srv?.format || 'm3u8';

    const { accountInfo, channels: xtChannels } = await connectXtreamCodes(
      serverId,
      iptvUsername,
      iptvPassword,
      format
    );

    if (xtChannels.length === 0) {
      throw new Error('Autenticado, mas nenhum canal/mídia foi retornado por este servidor.');
    }

    const updatedUser = await linkIptvToAccount(
      serverId,
      iptvUsername,
      iptvPassword,
      accountInfo
    );

    setCurrentUser(updatedUser);
    setAutoConnectError(null);
    setChannels(xtChannels);
    setSelectedCategory('ALL');
    setSelectedNav('all');
    setUseProxyBuffer(true);
    setActiveChannel(null);
    setIsChoosingProfile(true);
    setIsAuthenticated(true);
  };

  const handleUnlinkIptv = async () => {
    const updatedUser = await unlinkIptvFromAccount();
    setCurrentUser(updatedUser);
    setIsAuthenticated(false);
    setActiveChannel(null);
  };

  const handleLogoutAccount = () => {
    setUserToken(null);
    setCurrentUser(null);
    setActiveUserProfile(null);
    setIsChoosingProfile(true);
    setAutoConnectError(null);
    setIsAuthenticated(false);
    setActiveChannel(null);
  };

  // ==========================================================================
  // HANDLERS DE PERFIS ESTILO NETFLIX (ATÉ 5 PERFIS COM AVATARES E HISTÓRICO)
  // ==========================================================================
  const handleSelectNetflixProfile = useCallback((profile: UserSubProfile) => {
    setActiveUserProfile(profile);
    setIsChoosingProfile(false);
    setActiveChannel(null);
    setSelectedNav('all');
    setSelectedCategory('ALL');

    // Carrega Favoritos isolados deste Perfil
    try {
      const localFavRaw = localStorage.getItem(`${STORAGE_KEYS.FAVORITES}_${profile.id}`);
      if (localFavRaw) {
        const parsedFav = JSON.parse(localFavRaw);
        if (Array.isArray(parsedFav)) {
          setFavorites(new Set(parsedFav));
        } else {
          setFavorites(new Set(profile.favorites || []));
        }
      } else {
        setFavorites(new Set(profile.favorites || []));
      }
    } catch {
      setFavorites(new Set(profile.favorites || []));
    }

    // Carrega Histórico ("Continuar Assistindo") isolado deste Perfil
    try {
      const localHistRaw = localStorage.getItem(`${STORAGE_KEYS.HISTORY}_${profile.id}`);
      if (localHistRaw) {
        const parsedHist = JSON.parse(localHistRaw);
        if (Array.isArray(parsedHist) && parsedHist.length > 0) {
          setHistory(
            parsedHist.filter((item: WatchHistoryItem) => !isAdultContent(item.channel))
          );
          return;
        }
      }
    } catch {
      // ignore
    }

    setHistory(
      Array.isArray(profile.history)
        ? profile.history.filter((item) => !isAdultContent(item.channel))
        : []
    );
  }, []);

  const handleCreateNetflixProfile = async (payload: {
    name: string;
    avatarId: string;
    isKids: boolean;
    pin: string | null;
  }) => {
    if (!currentUser) {
      // Modo Demonstração (sem conta logada)
      const newPrf: UserSubProfile = {
        id: `prf-demo-${Date.now()}`,
        name: payload.name,
        avatarId: payload.avatarId,
        isKids: payload.isKids,
        pin: payload.pin,
        favorites: [],
        history: [],
        createdAt: Date.now(),
      };
      setActiveUserProfile(newPrf);
      return;
    }
    const { user } = await createUserProfile(payload);
    setCurrentUser(user);
  };

  const handleUpdateNetflixProfile = async (
    profileId: string,
    payload: {
      name: string;
      avatarId: string;
      isKids: boolean;
      pin: string | null;
    }
  ) => {
    const { profile, user } = await updateUserProfile(profileId, payload);
    setCurrentUser(user);
    if (activeUserProfile?.id === profileId) {
      setActiveUserProfile(profile);
    }
  };

  const handleDeleteNetflixProfile = async (profileId: string) => {
    const user = await deleteUserProfile(profileId);
    setCurrentUser(user);
    try {
      localStorage.removeItem(`${STORAGE_KEYS.FAVORITES}_${profileId}`);
      localStorage.removeItem(`${STORAGE_KEYS.HISTORY}_${profileId}`);
    } catch {
      // ignore
    }
    if (activeUserProfile?.id === profileId) {
      const remaining = ensureClientUserProfiles(user);
      setActiveUserProfile(remaining[0] || null);
    }
  };

  const handleClearNetflixProfileHistory = async (profileId: string) => {
    try {
      localStorage.removeItem(`${STORAGE_KEYS.HISTORY}_${profileId}`);
    } catch {
      // ignore
    }
    await syncUserProfileState(profileId, { history: [] });
    if (activeUserProfile?.id === profileId) {
      setHistory([]);
    }
    setCurrentUser((prev) => {
      if (!prev || !Array.isArray(prev.profiles)) return prev;
      return {
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === profileId ? { ...p, history: [] } : p
        ),
      };
    });
  };

  if (isAdminView) {
    return (
      <AdminPanelScreen
        onBackToApp={handleCloseAdminPanel}
        onConfigChanged={loadPublicConfigAndSession}
      />
    );
  }

  return (
    <>
      {/* Filtros SVG de Super Resolução (Upscaling HD → Full HD e Full HD → 4K idênticos ao Saimo TV) */}
      <svg
        width="0"
        height="0"
        style={{ position: 'absolute', pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <defs>
          <filter id="saimo-upscale-hd" colorInterpolationFilters="sRGB">
            <feConvolveMatrix
              order="3"
              kernelMatrix="0 -0.45 0 -0.45 2.8 -0.45 0 -0.45 0"
              preserveAlpha="true"
            />
          </filter>
          <filter id="saimo-upscale-4k" colorInterpolationFilters="sRGB">
            <feConvolveMatrix
              order="3"
              kernelMatrix="-0.15 -0.55 -0.15 -0.55 3.8 -0.55 -0.15 -0.55 -0.15"
              preserveAlpha="true"
            />
          </filter>
        </defs>
      </svg>

      {/* Abertura Cinematográfica Estilo Saimo TV / NextPlay */}
      {showIntro && <NextPlayIntroAnimation onFinish={() => setShowIntro(false)} />}

      {/* Painel de Entrada: Conta do Usuário (E-mail/Google) + Vínculo de Servidor IPTV */}
      {!isAuthenticated ? (
        <AuthPortalScreen
          currentUser={currentUser}
          servers={publicServers}
          appConfig={appConfig}
          autoConnectError={autoConnectError}
          isAutoConnecting={isAutoConnecting}
          upscaling={upscaling}
          onChangeUpscaling={setUpscaling}
          zeroDelay={zeroDelay}
          onChangeZeroDelay={setZeroDelay}
          smartAudio={smartAudio}
          onChangeSmartAudio={setSmartAudio}
          onReplayIntro={() => setShowIntro(true)}
          onLoginEmail={handleLoginEmail}
          onRegisterEmail={handleRegisterEmail}
          onLoginGoogle={handleLoginGoogle}
          onLinkIptvAndConnect={handleLinkIptvAndConnect}
          onRetryAutoConnect={
            currentUser?.iptvLink ? () => connectUserLinkedIptv(currentUser) : undefined
          }
          onLogoutAccount={handleLogoutAccount}
          onOpenAdminPanel={handleOpenAdminPanel}
          onEnterDemoMode={() => {
            setActiveProfileId('demo-default');
            setChannels(DEMO_CHANNELS);
            setSelectedCategory('ALL');
            setActiveChannel(null);
            setIsChoosingProfile(true);
            setIsAuthenticated(true);
          }}
        />
      ) : isChoosingProfile || !activeUserProfile ? (
        <ProfileGateScreen
          user={currentUser}
          profiles={userSubProfiles}
          activeProfileId={activeUserProfile?.id || null}
          onSelectProfile={handleSelectNetflixProfile}
          onCreateProfile={handleCreateNetflixProfile}
          onUpdateProfile={handleUpdateNetflixProfile}
          onDeleteProfile={handleDeleteNetflixProfile}
          onClearProfileHistory={handleClearNetflixProfileHistory}
          onLogoutAccount={handleLogoutAccount}
        />
      ) : (
        <div className="flex flex-col h-screen w-screen bg-[#090d11] text-slate-100 overflow-hidden select-none">
          {/* Header Superior Estilo Netflix / Apple TV / Prime Video */}
          <header
            className="h-16 bg-[#080d14]/95 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 flex items-center justify-between shrink-0 z-30 sticky top-0"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          >
            {/* Esquerda: Logo NextPlay + Links Principais de Navegação */}
            <div
              className="flex items-center gap-6 lg:gap-8"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              {/* Logo Oficial NextPlay */}
              <div
                onClick={() => {
                  setSelectedNav('all');
                  setSelectedMediaType('all');
                  setSelectedCategory('ALL');
                }}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <img
                  src="/brand/logo-full.png"
                  alt="NextPlay"
                  className="h-9 sm:h-10 w-auto object-contain group-hover:scale-105 transition-transform"
                />
              </div>

              {/* Links de Navegação Estilo Netflix / HBO */}
              <nav className="hidden md:flex items-center gap-1 sm:gap-2 text-xs font-semibold">
                <button
                  onClick={() => {
                    setSelectedNav('all');
                    setSelectedMediaType('all');
                    setSelectedCategory('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-full transition ${
                    selectedNav === 'all' && selectedMediaType === 'all'
                      ? 'bg-white text-slate-950 font-bold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Início
                </button>

                <button
                  onClick={() => {
                    setSelectedNav('all');
                    setSelectedMediaType('live');
                    setSelectedCategory('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 ${
                    selectedMediaType === 'live' && selectedNav === 'all'
                      ? 'bg-white text-slate-950 font-bold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  TV ao Vivo
                </button>

                <button
                  onClick={() => {
                    setSelectedNav('all');
                    setSelectedMediaType('movie');
                    setSelectedCategory('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-full transition ${
                    selectedMediaType === 'movie' && selectedNav === 'all'
                      ? 'bg-white text-slate-950 font-bold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Filmes
                </button>

                <button
                  onClick={() => {
                    setSelectedNav('all');
                    setSelectedMediaType('series');
                    setSelectedCategory('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-full transition ${
                    selectedMediaType === 'series' && selectedNav === 'all'
                      ? 'bg-white text-slate-950 font-bold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Séries
                </button>

                <button
                  onClick={() => {
                    setSelectedNav('favorites');
                    setSelectedCategory('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-full transition flex items-center gap-1 ${
                    selectedNav === 'favorites'
                      ? 'bg-white text-slate-950 font-bold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  Minha Lista
                </button>

                <button
                  onClick={() => {
                    setSelectedNav('history');
                    setSelectedCategory('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-full transition ${
                    selectedNav === 'history'
                      ? 'bg-white text-slate-950 font-bold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Histórico
                </button>
              </nav>
            </div>

            {/* Direita: Busca Global OmniSearch + Ajustes + WhatsApp + Avatar de Perfil */}
            <div
              className="flex items-center gap-3 sm:gap-4"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              {/* Busca Rápida com Expansão Suave que Abre a OmniSearch */}
              <div
                onClick={() => setIsOmniSearchOpen(true)}
                className="relative w-36 sm:w-56 md:w-64 cursor-pointer group"
              >
                <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2 transition" />
                <div className="w-full pl-8 pr-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 group-hover:border-cyan-400 text-xs text-slate-400 transition flex items-center justify-between">
                  <span className="truncate">Buscar em tudo...</span>
                  <kbd className="hidden sm:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    /
                  </kbd>
                </div>
              </div>

              {/* Botão de Configurações Técnicas & Telemetria (Gear) */}
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                title="Ajustes de Vídeo, DSP e Telemetria"
                className="p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Dropdown do Perfil Ativo (Estilo Netflix) & Conta */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full hover:bg-white/10 transition border border-transparent hover:border-slate-700 cursor-pointer"
                >
                  <ProfileAvatarBadge
                    avatarId={activeUserProfile?.avatarId}
                    size="sm"
                    className="shadow-md"
                  />
                  <span className="hidden sm:inline text-xs font-bold text-slate-100 max-w-[110px] truncate">
                    {activeUserProfile?.name || currentUser?.name || 'Perfil'}
                  </span>
                  {activeUserProfile?.isKids && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-400 text-slate-950 font-black text-[9px] uppercase">
                      KIDS
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Menu Dropdown Flutuante */}
                {isProfileMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0a1017]/95 backdrop-blur-2xl border border-slate-800 shadow-2xl p-2 z-50 text-xs animate-in fade-in slide-in-from-top-2"
                    onMouseLeave={() => setIsProfileMenuOpen(false)}
                  >
                    {/* Seção de Troca Rápida de Perfis Estilo Netflix */}
                    <div className="px-2 py-2 border-b border-slate-800 mb-1">
                      <div className="flex items-center justify-between px-1 mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Perfis ({userSubProfiles.length}/5)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            setIsChoosingProfile(true);
                          }}
                          className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                        >
                          Gerenciar
                        </button>
                      </div>

                      <div className="space-y-1">
                        {userSubProfiles.map((prf) => {
                          const isCurrent = prf.id === activeUserProfile?.id;
                          return (
                            <button
                              key={prf.id}
                              type="button"
                              onClick={() => {
                                setIsProfileMenuOpen(false);
                                if (prf.pin && prf.id !== activeUserProfile?.id) {
                                  setIsChoosingProfile(true);
                                } else {
                                  handleSelectNetflixProfile(prf);
                                }
                              }}
                              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-xl transition cursor-pointer ${
                                isCurrent
                                  ? 'bg-cyan-500/15 border border-cyan-500/30 text-white'
                                  : 'hover:bg-white/5 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <ProfileAvatarBadge avatarId={prf.avatarId} size="sm" />
                                <span className="font-bold truncate">{prf.name}</span>
                                {prf.isKids && (
                                  <span className="px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-300 font-black text-[9px]">
                                    KIDS
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {prf.pin && <Lock className="w-3 h-3 text-amber-400" />}
                                {isCurrent && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          setIsChoosingProfile(true);
                        }}
                        className="mt-2 w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Quem está assistindo? (Perfis)</span>
                      </button>
                    </div>

                    <div className="px-3 py-2 border-b border-slate-800 mb-1">
                      <p className="text-[10px] uppercase font-bold text-slate-500">
                        {currentUser ? 'Conta Principal' : 'Modo Demonstração'}
                      </p>
                      <p className="font-bold text-white truncate mt-0.5">
                        {currentUser?.name || activeProfile?.name || 'NextPlay User'}
                      </p>
                      {currentUser?.email && (
                        <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                      )}
                      {currentUser?.iptvLink && (
                        <p className="text-[11px] text-emerald-400 font-semibold truncate mt-1">
                          Servidor: {currentUser.iptvLink.serverName}
                        </p>
                      )}
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[9px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        {channels.length.toLocaleString('pt-BR')} itens disponíveis
                      </span>
                    </div>

                    {supportWhatsapp && (
                      <a
                        href={`https://wa.me/${supportWhatsapp.replace(/\D/g, '')}?text=Olá,%20preciso%20de%20suporte%20no%20NextPlay`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-left px-3 py-2 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-2 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Suporte WhatsApp</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5 text-teal-400" />
                      <span>Alterar Servidor / Login IPTV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleOpenAdminPanel();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Painel Admin (/admin)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsSettingsModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                      <span>Configurações & Telemetria</span>
                    </button>

                    <div className="my-1 border-t border-slate-800/80" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleLogoutAccount();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sair da Conta</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Controles de Janela Desktop (Minimizar, Maximizar, Fechar) */}
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

          {/* Área Principal 100% Edge-to-Edge */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            {/* O Player abre no topo (ou flutuante no canto) apenas quando o usuário escolhe um item */}
            {activeChannel && (
              isPlayerMinimized ? (
                /* MODO MINI-PLAYER FLUTUANTE (Picture-in-Picture In-App) */
                <div className="fixed bottom-6 right-6 w-72 sm:w-88 aspect-video rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.95)] border-2 border-cyan-400 z-50 bg-black animate-in slide-in-from-bottom-5">
                  <div className="absolute top-2 right-2 z-40 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2 py-1 rounded-xl border border-white/10">
                    <button
                      onClick={() => setIsPlayerMinimized(false)}
                      title="Restaurar Player para a Tela Principal"
                      className="p-1 text-cyan-400 hover:text-white transition"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setActiveChannel(null)}
                      title="Fechar Transmissão"
                      className="p-1 text-rose-400 hover:text-white transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <VideoPlayerEngine
                    channel={activeChannel}
                    playlistChannels={channels}
                    alternateAudioChannel={alternateAudioChannel}
                    onSelectChannel={handleSelectChannel}
                    isFavorite={favorites.has(activeChannel.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onPrevChannel={handlePrevChannel}
                    onNextChannel={handleNextChannel}
                    useProxyBuffer={useProxyBuffer}
                    onToggleProxyBuffer={handleToggleProxyBuffer}
                    showSpectrum={showSpectrum}
                    onToggleSpectrum={handleToggleSpectrum}
                    onClose={() => setActiveChannel(null)}
                    initialProgressSeconds={history.find((h) => h.channel.id === activeChannel.id)?.progressSeconds}
                    onProgressUpdate={handleProgressUpdate}
                  />
                </div>
              ) : (
                /* MODO NORMAL DO PLAYER NO TOPO */
                <div className="w-full bg-black/95 p-2 sm:p-5 border-b border-slate-800/80 shrink-0">
                  <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between pb-2 px-1">
                      <span className="text-xs font-bold text-cyan-300 flex items-center gap-2 truncate pr-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                        <span className="truncate">Reproduzindo: {activeChannel.name}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsPlayerMinimized(true)}
                          className="px-2.5 sm:px-3 py-1 rounded-xl bg-slate-800 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 text-xs font-semibold border border-slate-700/80 transition flex items-center gap-1.5"
                          title="Minimizar para o Canto (PiP) e Navegar no Catálogo"
                        >
                          <Minimize2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Minimizar (PiP)</span>
                        </button>
                        <button
                          onClick={() => setActiveChannel(null)}
                          className="px-2.5 sm:px-3 py-1 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-semibold border border-slate-700/80 transition flex items-center gap-1.5"
                          title="Fechar Player"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Fechar</span>
                        </button>
                      </div>
                    </div>

                    <div className="w-full aspect-video max-h-[82vh] min-h-[190px] sm:min-h-[320px] rounded-2xl overflow-hidden bg-black shadow-2xl relative">
                      <VideoPlayerEngine
                        channel={activeChannel}
                        playlistChannels={channels}
                        alternateAudioChannel={alternateAudioChannel}
                        onSelectChannel={handleSelectChannel}
                        isFavorite={favorites.has(activeChannel.id)}
                        onToggleFavorite={handleToggleFavorite}
                        onPrevChannel={handlePrevChannel}
                        onNextChannel={handleNextChannel}
                        useProxyBuffer={useProxyBuffer}
                        onToggleProxyBuffer={handleToggleProxyBuffer}
                        showSpectrum={showSpectrum}
                        onToggleSpectrum={handleToggleSpectrum}
                        onClose={() => setActiveChannel(null)}
                        initialProgressSeconds={history.find((h) => h.channel.id === activeChannel.id)?.progressSeconds}
                        onProgressUpdate={handleProgressUpdate}
                      />
                    </div>
                  </div>
                </div>
              )
            )}

            {/* Seletor Interativo de Temporadas e Episódios (exibido automaticamente ao selecionar qualquer Série) */}
              {(isLoadingSeries || seriesError || activeSeriesDetails) && (
                <SeriesEpisodeSelector
                  seriesDetails={activeSeriesDetails}
                  isLoading={isLoadingSeries}
                  error={seriesError}
                  activeEpisodeId={activeChannel?.id}
                  onSelectEpisode={handleSelectEpisode}
                />
              )}

              {selectedNav === 'history' && (
                <HistoryManagerPanel history={history} onClear={handleClearHistory} />
              )}

              {/* Quando estiver na aba TV AO VIVO, exibe a Grade Inteligente Separada por Emissoras */}
              {selectedMediaType === 'live' ? (
                <div className="flex-1 min-h-0">
                  <LiveTvGuideView
                    channels={channels.filter((c) => c.mediaType === 'live')}
                    favorites={favorites}
                    activeChannelId={activeChannel?.id}
                    isParentalUnlocked={isParentalUnlocked}
                    onRequestParentalUnlock={handleRequestParentalUnlock}
                    onSelectChannel={handleSelectChannel}
                    onToggleFavorite={handleToggleFavorite}
                  />
                </div>
              ) : selectedMediaType === 'movie' ? (
                /* Quando estiver na aba FILMES, exibe o Catálogo On Demand Vertical por Fornecedoras & Gêneros */
                <div className="flex-1 min-h-0">
                  <OnDemandCatalogView
                    mediaType="movie"
                    channels={channels.filter((c) => c.mediaType === 'movie')}
                    favorites={favorites}
                    activeChannelId={activeChannel?.id}
                    onSelectChannel={handleSelectChannel}
                    onOpenDetails={(item) => setDetailItem(item)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                </div>
              ) : selectedMediaType === 'series' ? (
                /* Quando estiver na aba SÉRIES, exibe o Catálogo On Demand Vertical de Séries */
                <div className="flex-1 min-h-0">
                  <OnDemandCatalogView
                    mediaType="series"
                    channels={channels.filter((c) => c.mediaType === 'series')}
                    favorites={favorites}
                    activeChannelId={activeChannel?.id}
                    onSelectChannel={handleSelectChannel}
                    onOpenDetails={async (item) => {
                      setDetailItem(item);
                      if (item.seriesId && item.xtreamAuth) {
                        setIsLoadingSeries(true);
                        try {
                          const details = await fetchXtreamSeriesInfo(
                            item.xtreamAuth.serverUrl,
                            item.xtreamAuth.username,
                            item.xtreamAuth.password,
                            item.seriesId,
                            item.name
                          );
                          setActiveSeriesDetails(details);
                        } catch {
                          // ignore
                        } finally {
                          setIsLoadingSeries(false);
                        }
                      }
                    }}
                    onToggleFavorite={handleToggleFavorite}
                  />
                </div>
              ) : (
                <>
                  {/* Visão Início (Home Geral com Destaques e Histórico) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 px-4 sm:px-8 shrink-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        {selectedNav === 'favorites'
                          ? 'Minha Lista de Favoritos'
                          : selectedNav === 'history'
                          ? 'Continuar Assistindo'
                          : 'Destaques do Catálogo'}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        {filteredChannels.length.toLocaleString('pt-BR')} títulos
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                      {/* Seletor de Modo: Estilo Streaming vs Lista */}
                      <div className="flex items-center bg-[#0d141c] p-0.5 rounded-lg border border-slate-800 mr-2 shrink-0">
                        <button
                          onClick={() => setCatalogLayout('netflix')}
                          title="Visualização Estilo Streaming"
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                            catalogLayout === 'netflix'
                              ? 'bg-cyan-500 text-slate-950 shadow-neon-cyan'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                          Streaming
                        </button>
                        <button
                          onClick={() => setCatalogLayout('list')}
                          title="Visualização Clássica em Lista"
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                            catalogLayout === 'list'
                              ? 'bg-cyan-500 text-slate-950 shadow-neon-cyan'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <List className="w-3.5 h-3.5" />
                          Lista
                        </button>
                      </div>

                      <button
                        onClick={() => setSelectedCategory('ALL')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition shrink-0 ${
                          selectedCategory === 'ALL'
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'bg-[#121a23] text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        Todas Categorias
                      </button>
                      {categories.slice(0, 6).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCategory(c.name)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition shrink-0 ${
                            selectedCategory === c.name
                              ? 'bg-cyan-500 text-slate-950 font-bold'
                              : 'bg-[#121a23] text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0">
                    {catalogLayout === 'netflix' ? (
                      <NetflixCatalogView
                        channels={filteredChannels}
                        history={history}
                        favorites={favorites}
                        activeChannelId={activeChannel?.id}
                        onSelectChannel={handleSelectChannel}
                        onToggleFavorite={handleToggleFavorite}
                        selectedMediaType={selectedMediaType}
                      />
                    ) : (
                      <VirtualChannelCatalog
                        channels={filteredChannels}
                        activeChannelId={activeChannel?.id}
                        activeSeriesId={activeSeriesDetails?.seriesId || activeChannel?.seriesId}
                        favorites={favorites}
                        onSelectChannel={handleSelectChannel}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    )}
                  </div>
                </>
              )}
            </main>

          {/* Barra Inferior Mobile Android Nativo */}
          <nav className="lg:hidden h-14 bg-[#0c1219] border-t border-slate-800 grid grid-cols-5 items-center px-2 shrink-0 z-30">
            <button
              onClick={() => {
                setSelectedNav('all');
                setSelectedMediaType('all');
                setSelectedCategory('ALL');
              }}
              className={`flex flex-col items-center justify-center py-1 text-[10px] ${
                selectedNav === 'all' && selectedMediaType === 'all'
                  ? 'text-cyan-400 font-bold'
                  : 'text-slate-400'
              }`}
            >
              <Home className="w-4 h-4 mb-0.5" />
              Início
            </button>

            <button
              onClick={() => {
                setSelectedNav('all');
                setSelectedMediaType('live');
                setSelectedCategory('ALL');
              }}
              className={`flex flex-col items-center justify-center py-1 text-[10px] ${
                selectedMediaType === 'live' ? 'text-cyan-400 font-bold' : 'text-slate-400'
              }`}
            >
              <Tv className="w-4 h-4 mb-0.5" />
              Ao Vivo
            </button>

            <button
              onClick={() => {
                setSelectedNav('all');
                setSelectedMediaType('movie');
                setSelectedCategory('ALL');
              }}
              className={`flex flex-col items-center justify-center py-1 text-[10px] ${
                selectedMediaType === 'movie' ? 'text-purple-400 font-bold' : 'text-slate-400'
              }`}
            >
              <Film className="w-4 h-4 mb-0.5" />
              Filmes
            </button>

            <button
              onClick={() => {
                setSelectedNav('all');
                setSelectedMediaType('series');
                setSelectedCategory('ALL');
              }}
              className={`flex flex-col items-center justify-center py-1 text-[10px] ${
                selectedMediaType === 'series' ? 'text-emerald-400 font-bold' : 'text-slate-400'
              }`}
            >
              <Clapperboard className="w-4 h-4 mb-0.5" />
              Séries
            </button>

            <button
              onClick={() => setSelectedNav('favorites')}
              className={`flex flex-col items-center justify-center py-1 text-[10px] ${
                selectedNav === 'favorites' ? 'text-rose-400 font-bold' : 'text-slate-400'
              }`}
            >
              <Heart className="w-4 h-4 mb-0.5" />
              Favoritos
            </button>
          </nav>

          {/* Modal de Vínculo de Servidor e Login IPTV da Conta */}
          <ConnectionModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            currentUser={currentUser}
            servers={publicServers}
            onLinkIptvAndConnect={handleLinkIptvAndConnect}
            onUnlinkIptv={handleUnlinkIptv}
            onLoadDemo={() => {
              setActiveProfileId('demo-default');
              setChannels(DEMO_CHANNELS);
              setSelectedCategory('ALL');
              setActiveChannel(DEMO_CHANNELS[0]);
            }}
          />

          {/* Modal de Configurações Técnicas, Vídeo & Telemetria */}
          {isSettingsModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
              <div className="w-full max-w-lg bg-[#0b121b] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                      <Settings className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Configurações & Ajustes</h3>
                      <p className="text-xs text-slate-400">Qualidade de vídeo, buffer e telemetria do motor</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="py-5 space-y-5">
                  {/* Super Resolução GPU */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Super Resolução por Hardware (GPU Upscaling)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'off', label: 'Nativo', desc: 'Original' },
                          { id: 'hd', label: 'FHD Sharpen', desc: '1080p Nitidez' },
                          { id: '4k', label: '4K Ultra', desc: 'Upscale 2160p' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setUpscaling(opt.id)}
                          className={`p-3 rounded-2xl text-left border transition ${
                            upscaling === opt.id
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-neon-cyan'
                              : 'bg-[#060a0f] border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <p className="text-xs font-bold">{opt.label}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Buffer & Latência ao Vivo */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Latência do Buffer de Transmissão ao Vivo
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'off', label: 'Padrão', desc: 'Buffer Seguro' },
                          { id: 'equilibrado', label: 'Equilibrado', desc: 'Anti-Engasgo' },
                          { id: 'agressivo', label: 'Ultra Rápido', desc: 'Zero-Delay' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setZeroDelay(opt.id)}
                          className={`p-3 rounded-2xl text-left border transition ${
                            zeroDelay === opt.id
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-neon-cyan'
                              : 'bg-[#060a0f] border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <p className="text-xs font-bold">{opt.label}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Smart Audio DSP */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#060a0f] border border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-white">Smart Audio DSP Normalizer</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Equaliza picos de volume entre canais e realça diálogos
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSmartAudio(!smartAudio)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        smartAudio
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      {smartAudio ? 'ATIVADO' : 'DESLIGADO'}
                    </button>
                  </div>

                  {/* Controle dos Pais & Senha de Conteúdo Adulto (+18) */}
                  <div className="p-3.5 rounded-2xl bg-[#060a0f] border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-rose-400" />
                        <div>
                          <p className="text-xs font-bold text-white">Controle dos Pais (Canais Adultos +18)</p>
                          <p className="text-[11px] text-slate-400">PIN de 4 dígitos para liberação (Padrão: 0000)</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                        PIN: ••••
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="password"
                        maxLength={4}
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="Novo PIN (4 dígitos)"
                        className="w-36 px-3 py-1.5 rounded-xl bg-[#0e1622] border border-slate-800 text-xs text-center font-mono tracking-widest text-white focus:outline-none focus:border-rose-400 transition"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newPinInput.length === 4) {
                            handleSaveNewPin(newPinInput);
                            setNewPinInput('');
                          }
                        }}
                        disabled={newPinInput.length !== 4}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          newPinInput.length === 4
                            ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-md'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Salvar Novo PIN
                      </button>
                      {pinChangeSuccess && (
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> PIN atualizado!
                        </span>
                      )}
                    </div>
                  </div>

                  {/* WhatsApp do Revendedor / Suporte */}
                  <div className="p-3.5 rounded-2xl bg-[#060a0f] border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="text-xs font-bold text-white">Canal de Suporte WhatsApp (Revendedor)</p>
                        <p className="text-[11px] text-slate-400">Número de WhatsApp exibido para suporte e renovação (com DDI)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={supportWhatsapp}
                        onChange={(e) => {
                          setSupportWhatsapp(e.target.value);
                          localStorage.setItem('nextplay_support_whatsapp_v1', e.target.value);
                        }}
                        placeholder="Ex: 5511999999999"
                        className="w-48 px-3 py-1.5 rounded-xl bg-[#0e1622] border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-400 transition"
                      />
                      <span className="text-xs text-slate-500">Salvo automaticamente</span>
                    </div>
                  </div>

                  {/* Telemetria do Motor Local */}
                  <div className="p-3.5 rounded-2xl bg-[#060a0f] border border-slate-800 space-y-1.5 text-xs">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
                      Telemetria do Motor
                    </p>
                    <div className="flex justify-between text-slate-400">
                      <span>Status do Servidor:</span>
                      <span className="text-cyan-300 font-semibold">{telemetry.engine} ({telemetry.status})</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Uso de RAM:</span>
                      <span className="text-emerald-400 font-semibold">{telemetry.memoryMB.heapUsed} MB (Otimizado)</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Aceleração Gráfica:</span>
                      <span className="text-white font-semibold">{telemetry.hwAcceleration}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs transition shadow-neon-cyan"
                  >
                    Salvar e Fechar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Digitação de PIN para Conteúdo Adulto (+18) */}
          <ParentalPinModal
            isOpen={isPinModalOpen}
            onClose={() => {
              setIsPinModalOpen(false);
              setPendingAdultChannel(null);
            }}
            onSuccess={handlePinSuccess}
            currentPin={parentalPin}
          />

          {/* 1. Modal de Detalhes Cinematográficos (Estilo Netflix / Disney+) */}
          <MediaDetailsModal
            item={detailItem}
            isOpen={Boolean(detailItem)}
            onClose={() => setDetailItem(null)}
            onPlay={handleSelectChannel}
            isFavorite={detailItem ? favorites.has(detailItem.id) : false}
            onToggleFavorite={handleToggleFavorite}
            seriesDetails={activeSeriesDetails}
            isLoadingSeries={isLoadingSeries}
            onSelectEpisode={handleSelectEpisode}
            savedProgressSeconds={detailItem ? history.find((h) => h.channel.id === detailItem.id)?.progressSeconds : undefined}
          />

          {/* 2. Modal de Busca Global Unificada (OmniSearch) */}
          <GlobalOmniSearchModal
            isOpen={isOmniSearchOpen}
            onClose={() => setIsOmniSearchOpen(false)}
            channels={channels}
            onSelectChannel={handleSelectChannel}
            isParentalUnlocked={isParentalUnlocked}
            onRequestParentalUnlock={handleRequestParentalUnlock}
          />

          {/* 3. Indicador de Zapping por Números do Controle Remoto (HUD) */}
          {zappingDisplay && (
            <div className="fixed top-20 right-8 z-50 px-5 py-3 rounded-2xl bg-cyan-500 text-slate-950 font-black text-xl shadow-neon-cyan animate-in fade-in zoom-in-90 duration-150 border-2 border-white flex items-center gap-2">
              <Tv className="w-6 h-6 fill-slate-950" />
              <span>{zappingDisplay}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default App;
