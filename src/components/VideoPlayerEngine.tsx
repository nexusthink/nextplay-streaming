import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Settings,
  Layers,
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Check,
  X,
} from 'lucide-react';
import { ChannelItem, SeriesDetails, SeriesEpisode } from '../types/iptv';

interface VideoPlayerEngineProps {
  channel: ChannelItem | null;
  playlistChannels?: ChannelItem[];
  alternateAudioChannel?: ChannelItem | null;
  onSelectChannel?: (channel: ChannelItem) => void;
  isFavorite: boolean;
  onToggleFavorite: (channelId: string) => void;
  onPrevChannel: () => void;
  onNextChannel: () => void;
  useProxyBuffer: boolean;
  onToggleProxyBuffer: () => void;
  showSpectrum?: boolean;
  onToggleSpectrum?: () => void;
  onClose?: () => void;
  initialProgressSeconds?: number;
  onProgressUpdate?: (channelId: string, progressSeconds: number, durationSeconds: number) => void;
  seriesDetails?: SeriesDetails | null;
  onSelectEpisode?: (episode: SeriesEpisode, series: SeriesDetails) => void;
}

interface QualityLevel {
  index: number;
  label: string;
}

const STANDARD_QUALITY_PRESETS: QualityLevel[] = [
  { index: -1, label: 'Automático (Original)' },
  { index: 1080, label: '1080p Full HD' },
  { index: 720, label: '720p HD' },
  { index: 480, label: '480p SD (Mais Leve)' },
];

export const VideoPlayerEngine: React.FC<VideoPlayerEngineProps> = ({
  channel,
  playlistChannels = [],
  onSelectChannel,
  useProxyBuffer,
  onToggleProxyBuffer,
  onClose,
  initialProgressSeconds = 0,
  onProgressUpdate,
  seriesDetails,
  onSelectEpisode,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<any | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const bufferingTimerRef = useRef<number | null>(null);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const lastReportedTimeRef = useRef<number>(0);
  const networkRetryCountRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasVideoFrame, setHasVideoFrame] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Linha do Tempo (Seekbar)
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Seletor de Qualidade
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Painel de Episódios (Exclusivo para Séries dentro do Player)
  const [showEpisodesDrawer, setShowEpisodesDrawer] = useState(false);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number>(1);

  const onToggleProxyRef = useRef(onToggleProxyBuffer);
  useEffect(() => {
    onToggleProxyRef.current = onToggleProxyBuffer;
  }, [onToggleProxyBuffer]);

  useEffect(() => {
    if (channel?.seasonNumber) {
      setSelectedSeasonNumber(channel.seasonNumber);
    } else if (seriesDetails?.seasons?.[0]?.seasonNumber) {
      setSelectedSeasonNumber(seriesDetails.seasons[0].seasonNumber);
    }
  }, [channel?.seasonNumber, seriesDetails]);

  useEffect(() => {
    if (
      channel &&
      (channel.mediaType === 'movie' || channel.mediaType === 'series') &&
      initialProgressSeconds > 10
    ) {
      pendingSeekTimeRef.current = initialProgressSeconds;
    } else {
      pendingSeekTimeRef.current = null;
    }
    setCurrentTime(0);
    setDuration(0);
    lastReportedTimeRef.current = 0;
  }, [channel?.id, initialProgressSeconds]);

  const wakeUpControls = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime || 0);
      if (videoRef.current.duration && Number.isFinite(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
    }
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      setShowQualityMenu(false);
    }, 4000);
  }, []);

  useEffect(() => {
    wakeUpControls();
    return () => {
      if (hideControlsTimerRef.current) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [wakeUpControls, channel?.id]);

  const clearBufferingIndicator = useCallback(() => {
    if (bufferingTimerRef.current) {
      window.clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }
    setIsBuffering(false);
  }, []);

  const triggerBufferingWithDebounce = useCallback(() => {
    if (bufferingTimerRef.current) return;
    bufferingTimerRef.current = window.setTimeout(() => {
      if (videoRef.current && videoRef.current.readyState < 3) {
        setIsBuffering(true);
      }
      bufferingTimerRef.current = null;
    }, 500);
  }, []);

  const resolveStreamUrl = useCallback((rawUrl: string, forceProxy: boolean): string => {
    if (!rawUrl) return '';
    const isCapacitorNative =
      typeof window !== 'undefined' &&
      (Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
        (window.location.hostname === 'localhost' && !window.location.port));

    if (isCapacitorNative) {
      return rawUrl;
    }

    if (forceProxy) {
      const apiBase = isCapacitorNative
        ? (
            localStorage.getItem('nextplay_api_server_url_v1') ||
            'http://nextplay.vps9818.panel.icontainer.run'
          ).replace(/\/+$/, '')
        : '';
      return `${apiBase}/api/stream?url=${encodeURIComponent(rawUrl)}`;
    }
    return rawUrl;
  }, []);

  const destroyPlayers = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      try {
        mpegtsRef.current.unload();
        mpegtsRef.current.detachMediaElement();
        mpegtsRef.current.destroy();
      } catch {
        // ignore
      }
      mpegtsRef.current = null;
    }
  }, []);

  const loadStream = useCallback(
    (targetChannel: ChannelItem, proxyEnabled: boolean) => {
      const video = videoRef.current;
      if (!video) return;

      destroyPlayers();
      setErrorMsg(null);
      setIsBuffering(true);
      setHasVideoFrame(false);
      setQualities([]);
      setCurrentQuality(-1);
      networkRetryCountRef.current = 0;

      if (targetChannel.mediaType === 'series' && targetChannel.id.startsWith('xt-series-')) {
        return;
      }

      const targetUrl = targetChannel.url;
      const finalUrl = resolveStreamUrl(targetUrl, proxyEnabled);
      const lowerUrl = targetUrl.toLowerCase();
      const isVodFile =
        targetChannel.mediaType === 'movie' ||
        targetChannel.mediaType === 'series' ||
        /\.(mp4|mkv|avi|mov|webm)/i.test(lowerUrl) ||
        /\/(movie|series)\//i.test(lowerUrl);
      const isHlsStream =
        !isVodFile && (lowerUrl.includes('.m3u8') || targetChannel.containerExtension === 'm3u8');
      const isTsStream =
        !isVodFile &&
        !isHlsStream &&
        (lowerUrl.endsWith('.ts') ||
          targetChannel.containerExtension === 'ts' ||
          lowerUrl.includes('/live/') ||
          /\/\d+(\?.*)?$/.test(lowerUrl));

      const startMpegTsFallback = () => {
        if (!mpegts.getFeatureList().mseLivePlayback) return false;
        const rawTsUrl = targetChannel.url.replace(/\.m3u8(\?|$)/i, '.ts$1');
        const tsStreamUrl = resolveStreamUrl(rawTsUrl, true);

        const player = mpegts.createPlayer(
          {
            type: 'mse',
            isLive: true,
            url: tsStreamUrl,
            cors: true,
          },
          {
            enableWorker: true,
            enableStashBuffer: true,
            stashInitialSize: 256 * 1024,
            liveBufferLatencyChasing: false,
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: 30,
            autoCleanupMinBackwardDuration: 15,
          }
        );
        mpegtsRef.current = player;
        player.attachMediaElement(video);
        player.load();
        const playPromise = player.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => setIsPlaying(false));
        }
        player.on(mpegts.Events.ERROR, () => {
          if (video && !video.paused && video.readyState >= 2) return;
          clearBufferingIndicator();
          setErrorMsg('Sinal temporariamente indisponível.');
        });
        return true;
      };

      if (isTsStream && startMpegTsFallback()) {
        return;
      }

      if (isHlsStream && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          capLevelToPlayerSize: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          backBufferLength: 15,
          manifestLoadingTimeOut: 15000,
          manifestLoadingMaxRetry: 3,
          levelLoadingTimeOut: 15000,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 4,
        });
        hlsRef.current = hls;
        hls.loadSource(finalUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          const levels: QualityLevel[] = data.levels.map((lvl, idx) => ({
            index: idx,
            label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)} kbps`,
          }));
          setQualities(levels);
          video.play().catch(() => setIsPlaying(false));
        });

        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          networkRetryCountRef.current = 0;
          clearBufferingIndicator();
          setErrorMsg(null);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (!proxyEnabled) {
              onToggleProxyRef.current();
              return;
            }
            if (networkRetryCountRef.current < 2) {
              networkRetryCountRef.current += 1;
              window.setTimeout(() => hlsRef.current?.startLoad(), 1000);
              return;
            }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          hls.destroy();
          hlsRef.current = null;
          if (!startMpegTsFallback()) {
            clearBufferingIndicator();
            setErrorMsg('Não foi possível reproduzir este conteúdo no momento.');
          }
        });
        return;
      }

      // Reprodução Direta HTML5 (Filmes MP4/MKV, Séries ou HLS Nativo)
      video.src = finalUrl;
      video.onerror = () => {
        if (video.src !== targetUrl && targetUrl.startsWith('http')) {
          video.onerror = null;
          video.src = targetUrl;
          video.play().catch(() => setIsPlaying(false));
        } else {
          clearBufferingIndicator();
          setErrorMsg('Não foi possível carregar o vídeo.');
        }
      };
      video.onloadedmetadata = () => {
        if (pendingSeekTimeRef.current && pendingSeekTimeRef.current > 0) {
          video.currentTime = pendingSeekTimeRef.current;
          pendingSeekTimeRef.current = null;
        }
      };
      video.play().catch(() => setIsPlaying(false));
    },
    [destroyPlayers, resolveStreamUrl, clearBufferingIndicator]
  );

  useEffect(() => {
    if (channel) {
      loadStream(channel, useProxyBuffer);
    }
    return () => {
      destroyPlayers();
    };
  }, [channel?.id, channel?.url, useProxyBuffer, loadStream, destroyPlayers]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
    wakeUpControls();
  }, [wakeUpControls]);

  const handleSeekBackward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, (video.currentTime || 0) - 10);
    setCurrentTime(video.currentTime);
    wakeUpControls();
  }, [wakeUpControls]);

  const handleSeekForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const maxDur =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : video.currentTime + 60;
    video.currentTime = Math.min(maxDur, (video.currentTime || 0) + 10);
    setCurrentTime(video.currentTime);
    wakeUpControls();
  }, [wakeUpControls]);

  const handleQualityChange = (levelIndex: number) => {
    setCurrentQuality(levelIndex);
    setShowQualityMenu(false);
    if (hlsRef.current && qualities.length > 0) {
      hlsRef.current.currentLevel = levelIndex;
    }
    wakeUpControls();
  };

  // Busca variantes de qualidade do mesmo canal na lista (ex: FHD, HD, SD, 4K)
  const channelQualityVariants = React.useMemo(() => {
    if (!channel || !playlistChannels.length || channel.mediaType !== 'live') return [];
    const baseName = channel.name
      .replace(/\[.*?\]|\(.*?\)|\b(FHD|4K|UHD|HD|SD|H265|HEVC|1080P|720P)\b/gi, '')
      .trim()
      .toLowerCase();
    if (baseName.length < 3) return [];
    return playlistChannels
      .filter(
        (c) =>
          c.mediaType === 'live' &&
          c.name
            .replace(/\[.*?\]|\(.*?\)|\b(FHD|4K|UHD|HD|SD|H265|HEVC|1080P|720P)\b/gi, '')
            .trim()
            .toLowerCase() === baseName
      )
      .slice(0, 6);
  }, [channel, playlistChannels]);

  // Lógica de Voltar em 2 Etapas no Player:
  // 1º Clique (com controles ocultos): Mostra opções do player, linha do tempo, etc.
  // 2º Clique (com controles já visíveis): Sai do player e volta para a tela anterior.
  const handlePlayerBack = useCallback(() => {
    if (showEpisodesDrawer) {
      setShowEpisodesDrawer(false);
      wakeUpControls();
      return 'drawer_closed';
    }
    if (showQualityMenu) {
      setShowQualityMenu(false);
      wakeUpControls();
      return 'quality_closed';
    }
    if (!controlsVisible) {
      wakeUpControls();
      return 'controls_shown';
    }
    onClose?.();
    return 'player_closed';
  }, [showEpisodesDrawer, showQualityMenu, controlsVisible, wakeUpControls, onClose]);

  useEffect(() => {
    (window as any).__nextplayPlayerBack = handlePlayerBack;
    return () => {
      delete (window as any).__nextplayPlayerBack;
    };
  }, [handlePlayerBack]);

  // Controle Remoto da TV dentro do Player em Tela Cheia
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        handlePlayerBack();
        return;
      }

      if (showEpisodesDrawer || showQualityMenu) return;

      // Acorda a interface ao apertar qualquer botão do controle
      if (!controlsVisible) {
        wakeUpControls();
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleSeekBackward();
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleSeekForward();
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          togglePlay();
          return;
        }
      } else {
        wakeUpControls();
      }

      if (e.key === 'MediaPlayPause') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'MediaRewind') {
        e.preventDefault();
        handleSeekBackward();
      } else if (e.key === 'MediaFastForward') {
        e.preventDefault();
        handleSeekForward();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    controlsVisible,
    showEpisodesDrawer,
    showQualityMenu,
    wakeUpControls,
    handleSeekBackward,
    handleSeekForward,
    togglePlay,
    handlePlayerBack,
  ]);

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec <= 0) return '00:00';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!channel) return null;

  const isSeries = channel.mediaType === 'series' || Boolean(seriesDetails);
  const hasSeekableDuration = duration > 0 && Number.isFinite(duration);
  const progressPercent = hasSeekableDuration
    ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
    : 100;

  const activeQualityList = qualities.length > 0 ? qualities : STANDARD_QUALITY_PRESETS;
  const activeSeason =
    seriesDetails?.seasons.find((s) => s.seasonNumber === selectedSeasonNumber) ||
    seriesDetails?.seasons[0];

  return (
    <div
      ref={containerRef}
      onMouseMove={wakeUpControls}
      onClick={wakeUpControls}
      className="fixed inset-0 z-[100] w-screen h-screen bg-black overflow-hidden select-none flex flex-col justify-between"
    >
      {/* Elemento de Vídeo HTML5 Puro e Leve (Fundo 100% Preto sem Poster Cinza do WebView) */}
      <video
        ref={videoRef}
        poster="data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs="
        className="w-full h-full object-contain bg-black"
        playsInline
        autoPlay
        onLoadedData={() => setHasVideoFrame(true)}
        onPlay={() => {
          setIsPlaying(true);
          clearBufferingIndicator();
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={triggerBufferingWithDebounce}
        onPlaying={() => {
          setHasVideoFrame(true);
          clearBufferingIndicator();
          setErrorMsg(null);
        }}
        onCanPlay={() => {
          setHasVideoFrame(true);
          clearBufferingIndicator();
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          const now = v.currentTime || 0;
          if (controlsVisible && Math.abs(now - currentTime) >= 1) {
            setCurrentTime(now);
            if (v.duration && Number.isFinite(v.duration)) {
              setDuration(v.duration);
            }
          }
          if (
            onProgressUpdate &&
            channel &&
            (channel.mediaType === 'movie' || channel.mediaType === 'series') &&
            Math.abs(now - lastReportedTimeRef.current) >= 10 &&
            v.duration > 30
          ) {
            lastReportedTimeRef.current = now;
            onProgressUpdate(channel.id, now, v.duration);
          }
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (d && Number.isFinite(d)) {
            setDuration(d);
          }
        }}
      />

      {/* Cortina 100% Preta enquanto carrega o 1º frame (elimina qualquer fundo cinza) */}
      {!hasVideoFrame && !errorMsg && (
        <div className="absolute inset-0 bg-black pointer-events-none z-10" />
      )}

      {/* Indicador Leve de Carregamento sobre fundo preto */}
      {(isBuffering || !hasVideoFrame) && !errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-11 h-11 rounded-full border-4 border-white/15 border-t-emerald-400 animate-spin" />
        </div>
      )}

      {/* Aviso de Erro Simples com Botão de Tentar Novamente */}
      {errorMsg && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-30">
          <AlertTriangle className="w-12 h-12 text-amber-400 mb-3" />
          <p className="text-base font-bold text-white mb-1">{errorMsg}</p>
          <p className="text-xs text-slate-400 mb-5">{channel.name}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadStream(channel, !useProxyBuffer)}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
              >
                Voltar ao Catálogo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Camada de Controles Limpa (Apenas Voltar, Linha do Tempo, Retroceder, Pause, Avançar, Qualidade e Episódios) */}
      <div
        className={`absolute inset-0 z-20 flex flex-col justify-between bg-gradient-to-t from-black/90 via-transparent to-black/80 transition-opacity duration-200 ${
          controlsVisible || !isPlaying || showQualityMenu || showEpisodesDrawer
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Topo: Botão Voltar + Nome do Filme / Série / Canal */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4 min-w-0">
            {onClose && (
              <button
                type="button"
                data-tv-back="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 focus:bg-emerald-500 focus:text-slate-950 text-white font-bold text-sm flex items-center gap-2 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                {channel.name}
              </h2>
              {channel.seriesName && (
                <p className="text-xs text-slate-300 truncate">
                  {channel.seriesName}
                  {channel.seasonNumber ? ` • Temporada ${channel.seasonNumber}` : ''}
                  {channel.episodeNumber ? ` • Episódio ${channel.episodeNumber}` : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Base: Linha do Tempo + Botões Essenciais */}
        <div
          className="px-6 pb-6 pt-4 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Linha do Tempo (Seekbar) */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-200 w-14 text-right shrink-0">
              {hasSeekableDuration ? formatTime(currentTime) : 'AO VIVO'}
            </span>

            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min={0}
                max={hasSeekableDuration ? duration : 100}
                step={1}
                value={hasSeekableDuration ? currentTime : 100}
                disabled={!hasSeekableDuration}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  if (videoRef.current && hasSeekableDuration) {
                    videoRef.current.currentTime = val;
                  }
                  wakeUpControls();
                }}
                aria-label="Linha do tempo do vídeo"
                className="w-full h-2 bg-white/25 rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
                style={{
                  background: `linear-gradient(to right, #34d399 ${progressPercent}%, rgba(255,255,255,0.25) ${progressPercent}%)`,
                }}
              />
            </div>

            <span className="text-xs font-mono text-slate-300 w-14 shrink-0">
              {hasSeekableDuration ? formatTime(duration) : 'LIVE'}
            </span>
          </div>

          {/* 2. Barra de Botões: Retroceder, Play/Pause, Avançar | Qualidade e Episódios */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Esquerda / Centro: Retroceder (-10s), Play/Pause, Avançar (+10s) */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSeekBackward}
                title="Retroceder 10 segundos"
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 focus:bg-emerald-500 focus:text-slate-950 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>-10s</span>
              </button>

              <button
                type="button"
                onClick={togglePlay}
                title={isPlaying ? 'Pausar' : 'Reproduzir'}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 focus:bg-white text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shadow-lg"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-slate-950" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>Reproduzir</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSeekForward}
                title="Avançar 10 segundos"
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 focus:bg-emerald-500 focus:text-slate-950 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                <span>+10s</span>
              </button>
            </div>

            {/* Direita: Qualidade do Vídeo e Episódios (em caso de Série) */}
            <div className="flex items-center gap-3 relative">
              {/* Botão Episódios (Exibido somente em Séries) */}
              {isSeries && seriesDetails && seriesDetails.seasons.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowEpisodesDrawer((v) => !v);
                    setShowQualityMenu(false);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 focus:bg-emerald-500 focus:text-slate-950 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  <span>Episódios</span>
                </button>
              )}

              {/* Botão Qualidade do Vídeo */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowQualityMenu((v) => !v);
                    setShowEpisodesDrawer(false);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 focus:bg-emerald-500 focus:text-slate-950 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  <span>
                    Qualidade:{' '}
                    {currentQuality === -1
                      ? 'Auto'
                      : activeQualityList.find((q) => q.index === currentQuality)?.label || 'Auto'}
                  </span>
                </button>

                {/* Menu Popup de Qualidade */}
                {showQualityMenu && (
                  <div className="absolute bottom-14 right-0 w-60 rounded-2xl bg-[#0e151f] border border-slate-700 shadow-2xl p-2 z-40 space-y-1">
                    <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      Qualidade do Vídeo
                    </p>

                    {qualities.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleQualityChange(-1)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                          currentQuality === -1
                            ? 'bg-emerald-500 text-slate-950'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        <span>Automático</span>
                        {currentQuality === -1 && <Check className="w-4 h-4" />}
                      </button>
                    )}

                    {activeQualityList.map((q) => (
                      <button
                        key={q.index}
                        type="button"
                        onClick={() => handleQualityChange(q.index)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                          currentQuality === q.index
                            ? 'bg-emerald-500 text-slate-950'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        <span>{q.label}</span>
                        {currentQuality === q.index && <Check className="w-4 h-4" />}
                      </button>
                    ))}

                    {channelQualityVariants.length > 1 && onSelectChannel && (
                      <>
                        <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-t border-slate-800 mt-1">
                          Sinais deste Canal
                        </p>
                        {channelQualityVariants.map((variant) => (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() => {
                              setShowQualityMenu(false);
                              onSelectChannel(variant);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                              variant.id === channel.id
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            <span className="truncate">{variant.name}</span>
                            {variant.id === channel.id && <Check className="w-4 h-4 shrink-0" />}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gaveta Limpa de Episódios dentro do Player em Tela Cheia */}
      {showEpisodesDrawer && seriesDetails && (
        <div
          className="absolute inset-y-0 right-0 w-full max-w-md bg-[#0b1017]/95 border-l border-slate-800 z-40 flex flex-col p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">{seriesDetails.name}</h3>
              <p className="text-xs text-slate-400">Escolha a temporada e o episódio</p>
            </div>
            <button
              type="button"
              onClick={() => setShowEpisodesDrawer(false)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Seletor de Temporadas */}
          <div className="flex items-center gap-2 overflow-x-auto py-3 border-b border-slate-800 shrink-0">
            {seriesDetails.seasons.map((season) => (
              <button
                key={season.seasonNumber}
                type="button"
                onClick={() => setSelectedSeasonNumber(season.seasonNumber)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                  selectedSeasonNumber === season.seasonNumber
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Temporada {season.seasonNumber}
              </button>
            ))}
          </div>

          {/* Lista de Episódios */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2">
            {activeSeason?.episodes.map((ep) => {
              const isCurrentEp =
                channel.id === `xt-ep-${ep.id}` ||
                channel.id === ep.id ||
                (channel.seasonNumber === ep.seasonNumber &&
                  channel.episodeNumber === ep.episodeNum);
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => {
                    if (onSelectEpisode) {
                      onSelectEpisode(ep, seriesDetails);
                      setShowEpisodesDrawer(false);
                    }
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                    isCurrentEp
                      ? 'bg-emerald-500/15 border-emerald-500 text-white'
                      : 'bg-slate-900/70 border-slate-800 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                      Ep. {ep.episodeNum} - {ep.title}
                    </p>
                    {ep.duration && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{ep.duration}</p>
                    )}
                  </div>
                  <Play className="w-4 h-4 shrink-0 text-emerald-400" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
