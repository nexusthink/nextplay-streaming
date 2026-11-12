import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  Subtitles,
  Settings,
  Heart,
  Activity,
  ShieldCheck,
  RefreshCw,
  PictureInPicture2,
  Radio,
  Languages,
  Check,
  Sparkles,
  Loader2,
  ArrowLeft,
  X,
  List,
  Search,
  Tv,
  Zap,
  Crop,
  History as HistoryIcon,
} from 'lucide-react';
import { ChannelItem } from '../types/iptv';
import { formatProgressTime } from '../services/historyManager';
import {
  SubtitleCue,
  LiveCea608Cue,
  Cea608DecoderState,
  isLegendadoItem,
  fetchAutomaticOnlineSubtitles,
  translateLiveCaption,
  decodeCea608Samples,
  getNeuralTtsAudioUrl,
} from '../services/subtitleEngine';

export type VideoAspectRatio = 'contain' | 'cover' | 'fill' | '4:3';

export const ASPECT_RATIO_LABELS: Record<VideoAspectRatio, string> = {
  contain: 'Padrão (16:9 Original)',
  cover: 'Preencher / Zoom',
  fill: 'Esticar Tela (100%)',
  '4:3': 'Clássico 4:3',
};

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
  showSpectrum: boolean;
  onToggleSpectrum: () => void;
  onClose?: () => void;
  initialProgressSeconds?: number;
  onProgressUpdate?: (channelId: string, progressSeconds: number, durationSeconds: number) => void;
}

interface QualityLevel {
  index: number;
  label: string;
}

interface TrackOption {
  id: number;
  label: string;
  lang?: string;
}

type SubtitleMode = 'off' | 'auto_pt' | 'auto_en' | 'live_cc' | 'hls_native';

export const VideoPlayerEngine: React.FC<VideoPlayerEngineProps> = ({
  channel,
  playlistChannels = [],
  alternateAudioChannel,
  onSelectChannel,
  isFavorite,
  onToggleFavorite,
  onPrevChannel,
  onNextChannel,
  useProxyBuffer,
  onToggleProxyBuffer,
  showSpectrum,
  onToggleSpectrum,
  onClose,
  initialProgressSeconds,
  onProgressUpdate,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);

  // Web Audio API refs para o analisador de espectro neon
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.85);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [streamResolution, setStreamResolution] = useState<string>('AUTO HD');
  const [forceTsProtocol, setForceTsProtocol] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);

  // Estados de Áudio (Dublado / Legendado) & Legendas Automáticas Online
  const [showCaptionMenu, setShowCaptionMenu] = useState<boolean>(false);
  const [preferredMode, setPreferredMode] = useState<'dublado' | 'legendado'>('dublado');
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('off');
  const [audioTracks, setAudioTracks] = useState<TrackOption[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(0);
  const [subtitleTracks, setSubtitleTracks] = useState<TrackOption[]>([]);
  const [currentHlsSubTrack, setCurrentHlsSubTrack] = useState<number>(0);

  const [autoCues, setAutoCues] = useState<SubtitleCue[]>([]);
  const [autoSubSourceName, setAutoSubSourceName] = useState<string>('');
  const [isFetchingAutoSub, setIsFetchingAutoSub] = useState<boolean>(false);
  const [subtitleOffsetSec, setSubtitleOffsetSec] = useState<number>(0);
  const [subtitleFontSize, setSubtitleFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [liveCcText, setLiveCcText] = useState<string>('');
  const [aiEnglishVoiceOver, setAiEnglishVoiceOver] = useState<boolean>(false);
  const lastSpokenPhraseRef = useRef<string>('');
  const liveCeaCuesRef = useRef<LiveCea608Cue[]>([]);
  const ceaDecoderStateRef = useRef<Cea608DecoderState>({
    text: '',
    lastA: -1,
    lastB: -1,
    startPts: -1,
  });
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const bufferingTimerRef = useRef<number | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const liveCcExpireTimerRef = useRef<number | null>(null);
  const networkRetryCountRef = useRef<number>(0);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const speechRecRef = useRef<any>(null);
  const onToggleProxyRef = useRef(onToggleProxyBuffer);
  onToggleProxyRef.current = onToggleProxyBuffer;

  // 1. Zapping Rápido / Mini-Guia no Player
  const [showQuickDrawer, setShowQuickDrawer] = useState<boolean>(false);
  const [drawerSearch, setDrawerSearch] = useState<string>('');
  const [drawerFilter, setDrawerFilter] = useState<'same_group' | 'all'>('same_group');
  const [focusedDrawerIndex, setFocusedDrawerIndex] = useState<number>(0);
  const drawerListRef = useRef<HTMLDivElement | null>(null);

  // Proporção de Tela (Aspect Ratio)
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>(() => {
    try {
      return (localStorage.getItem('nextplay_aspect_ratio') as VideoAspectRatio) || 'contain';
    } catch {
      return 'contain';
    }
  });
  const [aspectToast, setAspectToast] = useState<string | null>(null);

  // "Continuar Assistindo" e Retomada de Ponto de Parada
  const [resumePrompt, setResumePrompt] = useState<{ progressSeconds: number } | null>(null);
  const lastProgressSaveRef = useRef<number>(0);
  const hasInitializedProgressRef = useRef<string | null>(null);

  // 2. Gestos Touch no Mobile (Duplo toque -10s e +10s estilo YouTube/Netflix)
  const [touchFeedback, setTouchFeedback] = useState<{ side: 'left' | 'right'; id: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  // 3. Auto-Reconexão & Fallback Inteligente de Sinal
  const [isAutoReconnecting, setIsAutoReconnecting] = useState<boolean>(false);
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0);
  const [reconnectStatusText, setReconnectStatusText] = useState<string>('');
  const [alternateCandidate, setAlternateCandidate] = useState<ChannelItem | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const isCurrentLegendadoStream = useMemo(() => isLegendadoItem(channel), [channel]);
  const isLegendadoActive = preferredMode === 'legendado' || isCurrentLegendadoStream;

  // Reproduz a voz neural em Inglês (via /api/tts MP3 real-time) com audio ducking automático do som dublado de fundo
  const speakEnglishNeuralTts = useCallback(
    (enText: string) => {
      const cleaned = enText
        .replace(/^>>\s*/, '')
        .replace(/^\[[^\]]+\]\s*/, '')
        .replace(/♪[^♪]*♪?/g, '')
        .trim();
      if (!cleaned || cleaned.length < 2) return;
      if (cleaned === lastSpokenPhraseRef.current) return;
      lastSpokenPhraseRef.current = cleaned;

      if (ttsAudioRef.current) {
        try {
          ttsAudioRef.current.pause();
          ttsAudioRef.current.src = '';
        } catch {
          // ignore
        }
        ttsAudioRef.current = null;
      }

      const ttsUrl = getNeuralTtsAudioUrl(cleaned, 'en');
      if (ttsUrl) {
        const audio = new Audio(ttsUrl);
        audio.playbackRate = 1.12;
        ttsAudioRef.current = audio;

        audio.onplay = () => {
          if (videoRef.current && !isMuted) {
            videoRef.current.volume = Math.min(volume, 0.12);
          }
        };
        audio.onended = () => {
          if (videoRef.current && !isMuted) {
            videoRef.current.volume = volume;
          }
        };
        audio.onerror = () => {
          if (videoRef.current && !isMuted) {
            videoRef.current.volume = volume;
          }
        };

        audio.play().catch(() => {
          // Fallback para Web Speech Synthesis caso o navegador bloqueie HTMLAudioElement
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try {
              window.speechSynthesis.cancel();
              const utter = new SpeechSynthesisUtterance(cleaned);
              utter.lang = 'en-US';
              utter.rate = 1.1;
              window.speechSynthesis.speak(utter);
            } catch {
              // ignore
            }
          }
        });
      }
    },
    [isMuted, volume]
  );

  // Atualiza a frase de Closed Caption ao vivo, traduz quando necessário e executa Voice-Over IA em Inglês se ativo
  const pushTransientLiveCaption = useCallback(
    (rawText: string) => {
      const cleaned = rawText.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
      if (!cleaned) return;

      // Caso 1: Canal em Inglês (ex: US: HBO, US: AMC) -> traduz o CC em Inglês para Legenda em Português-BR!
      if (isCurrentLegendadoStream && channel?.mediaType === 'live') {
        translateLiveCaption(cleaned, 'en', 'pt-BR').then((ptText) => {
          setLiveCcText(ptText || cleaned);
        });
      } else {
        // Caso 2: Canal Dublado em Português -> já exibe a Legenda em Português-BR imediatamente!
        setLiveCcText(cleaned);

        // E se o usuário ativou o modo Legendado / SAP Sintético IA em canais só dublados, fala em Inglês!
        const shouldSpeakEn =
          aiEnglishVoiceOver ||
          (preferredMode === 'legendado' && !isCurrentLegendadoStream && channel?.mediaType === 'live');
        if (shouldSpeakEn) {
          const cleanForTr = cleaned.replace(/^>>\s*/, '').replace(/^\[[^\]]+\]\s*/, '').trim();
          if (cleanForTr.length >= 2) {
            translateLiveCaption(cleanForTr, 'pt', 'en').then((enText) => {
              if (enText) {
                speakEnglishNeuralTts(enText);
              }
            });
          }
        }
      }

      if (liveCcExpireTimerRef.current) {
        window.clearTimeout(liveCcExpireTimerRef.current);
      }
      liveCcExpireTimerRef.current = window.setTimeout(() => {
        setLiveCcText('');
        liveCcExpireTimerRef.current = null;
      }, 3800);
    },
    [
      isCurrentLegendadoStream,
      channel?.mediaType,
      aiEnglishVoiceOver,
      preferredMode,
      speakEnglishNeuralTts,
    ]
  );

  // Loop de sincronização de 120ms para legendas binárias CEA-608 extraídas diretamente do stream H.264 (Globo, Telecine, HBO, etc.)
  useEffect(() => {
    if (subtitleMode === 'off' && !aiEnglishVoiceOver && preferredMode !== 'legendado') {
      return;
    }

    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      const cues = liveCeaCuesRef.current;
      if (cues.length === 0) return;

      const now = video.currentTime;
      const activeCue = cues.find((c) => now >= c.startTime - 0.35 && now <= c.endTime);

      if (activeCue) {
        const displayTxt = isCurrentLegendadoStream
          ? activeCue.ptText || activeCue.rawText
          : activeCue.rawText;
        setLiveCcText(displayTxt);

        const shouldSpeakEn =
          aiEnglishVoiceOver ||
          (preferredMode === 'legendado' && !isCurrentLegendadoStream && channel?.mediaType === 'live');

        if (shouldSpeakEn && !activeCue.spoken) {
          activeCue.spoken = true;
          if (activeCue.enText) {
            speakEnglishNeuralTts(activeCue.enText);
          } else {
            const cleanSpeech = activeCue.rawText
              .replace(/^>>\s*/, '')
              .replace(/^\[[^\]]+\]\s*/, '')
              .replace(/♪[^♪]*♪?/g, '')
              .trim();
            if (cleanSpeech.length >= 2) {
              translateLiveCaption(cleanSpeech, 'pt', 'en').then((en) => {
                activeCue.enText = en;
                speakEnglishNeuralTts(en);
              });
            }
          }
        }

        if (liveCcExpireTimerRef.current) {
          window.clearTimeout(liveCcExpireTimerRef.current);
        }
        liveCcExpireTimerRef.current = window.setTimeout(() => {
          setLiveCcText('');
          liveCcExpireTimerRef.current = null;
        }, 3800);
      }
    }, 120);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    subtitleMode,
    aiEnglishVoiceOver,
    preferredMode,
    isCurrentLegendadoStream,
    channel?.mediaType,
    speakEnglishNeuralTts,
  ]);

  const wakeUpControls = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
        setShowQualityMenu(false);
        setShowCaptionMenu(false);
        setShowSettingsMenu(false);
      }
    }, 2800);
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      wakeUpControls();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (hideControlsTimerRef.current) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [wakeUpControls]);

  useEffect(() => {
    wakeUpControls();
  }, [channel?.id, isPlaying, wakeUpControls]);

  // Busca automática de legenda online quando o modo 'auto_pt' ou 'auto_en' está ativo (ou quando o usuário coloca em Legendado)
  useEffect(() => {
    let active = true;

    if (!channel || (subtitleMode !== 'auto_pt' && subtitleMode !== 'auto_en')) {
      if (subtitleMode === 'off') {
        setAutoCues([]);
        setAutoSubSourceName('');
        setIsFetchingAutoSub(false);
      }
      return;
    }

    // Se for canal de TV ao vivo e o usuário pediu legenda automática, usa o motor Live CC em tempo real
    if (channel.mediaType === 'live') {
      setIsFetchingAutoSub(false);
      return;
    }

    const targetTitle = channel.seriesName || channel.name;
    const langCode = subtitleMode === 'auto_en' ? 'eng' : 'pob';

    setIsFetchingAutoSub(true);
    fetchAutomaticOnlineSubtitles(
      targetTitle,
      channel.seasonNumber,
      channel.episodeNumber,
      langCode
    ).then((res) => {
      if (!active) return;
      setIsFetchingAutoSub(false);
      if (res.found && res.cues.length > 0) {
        setAutoCues(res.cues);
        setAutoSubSourceName(res.fileName || 'OpenSubtitles Sync');
      } else {
        setAutoCues([]);
        setAutoSubSourceName('');
      }
    });

    return () => {
      active = false;
    };
  }, [
    channel?.id,
    channel?.name,
    channel?.seriesName,
    channel?.seasonNumber,
    channel?.episodeNumber,
    channel?.mediaType,
    subtitleMode,
  ]);

  // Quando o usuário seleciona um item que já é da categoria Legendados/Legendadas/US:, sincroniza o estado
  useEffect(() => {
    if (isCurrentLegendadoStream) {
      setPreferredMode('legendado');
      setSubtitleMode('auto_pt');
    } else {
      setPreferredMode('dublado');
      setSubtitleMode('off');
    }
  }, [isCurrentLegendadoStream, channel?.id]);

  // Motor de Closed Caption Ao Vivo (Captura CEA-608/708 do stream + Web Speech com auto-limpeza em 3.8s)
  useEffect(() => {
    const video = videoRef.current;

    // Se a legenda estiver Desativada (ou em modo Dublado sem legenda), desativa todas as TextTracks imediatamente
    if (subtitleMode === 'off') {
      if (speechRecRef.current) {
        try {
          speechRecRef.current.onend = null;
          speechRecRef.current.stop();
        } catch {
          // ignore
        }
        speechRecRef.current = null;
      }
      if (liveCcExpireTimerRef.current) {
        window.clearTimeout(liveCcExpireTimerRef.current);
        liveCcExpireTimerRef.current = null;
      }
      setLiveCcText('');
      if (hlsRef.current) {
        hlsRef.current.subtitleDisplay = false;
        hlsRef.current.subtitleTrack = -1;
      }
      if (video && video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].oncuechange = null;
          video.textTracks[i].mode = 'disabled';
        }
      }
      return;
    }

    // Quando a legenda está ATIVA: lê as legendas CEA-608/708 embutidas no stream (ex: HBO+, Telecine, Globo)
    // em modo 'hidden' (sem usar o renderizador nativo travado do navegador) e auto-limpa após 3.8s!
    const bindTextTracks = () => {
      if (!video || !video.textTracks) return;
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        track.mode = 'hidden';
        track.oncuechange = () => {
          const activeCues = track.activeCues;
          if (activeCues && activeCues.length > 0) {
            const lastCue = activeCues[activeCues.length - 1] as VTTCue;
            if (lastCue?.text) {
              pushTransientLiveCaption(lastCue.text.replace(/<[^>]+>/g, ''));
            }
          } else {
            setLiveCcText('');
          }
        };
      }
    };

    bindTextTracks();
    if (video && video.textTracks) {
      video.textTracks.addEventListener('addtrack', bindTextTracks);
    }
    if (hlsRef.current && hlsRef.current.subtitleTracks.length > 0) {
      hlsRef.current.subtitleDisplay = false;
      hlsRef.current.subtitleTrack = currentHlsSubTrack >= 0 ? currentHlsSubTrack : 0;
    }

    return () => {
      if (video && video.textTracks) {
        video.textTracks.removeEventListener('addtrack', bindTextTracks);
      }
    };
  }, [
    subtitleMode,
    currentHlsSubTrack,
    channel?.id,
    channel?.mediaType,
    isFetchingAutoSub,
    autoCues.length,
    pushTransientLiveCaption,
  ]);

  // Calcula qual legenda sincronizada deve ser exibida no segundo exato do vídeo
  const activeCaptionText = useMemo(() => {
    if (subtitleMode === 'off') return null;

    if (isFetchingAutoSub) {
      return 'Sincronizando legenda automática em Português (PT-BR)...';
    }

    // 1. Se baixou as legendas sincronizadas (.SRT automático online) para o filme/série
    if ((subtitleMode === 'auto_pt' || subtitleMode === 'auto_en') && autoCues.length > 0) {
      const adjustedTime = currentTime - subtitleOffsetSec;
      const cue = autoCues.find((c) => adjustedTime >= c.start && adjustedTime <= c.end);
      return cue ? cue.text : null;
    }

    // 2. Frase transitória do Closed Caption ao vivo (desaparece automaticamente após 3.8s de silêncio!)
    if (liveCcText) {
      return liveCcText;
    }

    return null;
  }, [
    subtitleMode,
    isFetchingAutoSub,
    autoCues,
    currentTime,
    subtitleOffsetSec,
    liveCcText,
  ]);

  // Ação 1-Clique: Ativar modo DUBLADO (Volta para Áudio em Português e desativa legenda - funciona nos 2 sentidos!)
  const handleActivateDublado = () => {
    setPreferredMode('dublado');
    setSubtitleMode('off');
    setAiEnglishVoiceOver(false);
    setLiveCcText('');
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.src = '';
      } catch {
        // ignore
      }
      ttsAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (videoRef.current && !isMuted) {
      videoRef.current.volume = volume;
    }

    // 1. Se estava na versão em Inglês/Legendada (ex: Canal US: HBO ou Filme [Leg]) e existe a versão Dublada BR, volta para ela!
    if (isCurrentLegendadoStream && alternateAudioChannel && onSelectChannel) {
      onSelectChannel(alternateAudioChannel);
      return;
    }

    // 2. Se estava reproduzindo a Faixa 1 (Inglês Original) de um Filme/Série MP4 [Dual], volta para a Faixa 0 (Português Dublado) no mesmo segundo!
    if (currentAudioTrack !== 0 && channel) {
      if (videoRef.current && videoRef.current.currentTime > 1) {
        pendingSeekTimeRef.current = videoRef.current.currentTime;
      }
      setCurrentAudioTrack(0);
      loadStream(channel, true, forceTsProtocol, 0);
      return;
    }

    if (hlsRef.current && hlsRef.current.audioTracks.length > 1) {
      hlsRef.current.audioTrack = 0;
      setCurrentAudioTrack(0);
    }
    const videoEl = videoRef.current as any;
    if (videoEl?.audioTracks && videoEl.audioTracks.length > 1) {
      for (let i = 0; i < videoEl.audioTracks.length; i++) {
        videoEl.audioTracks[i].enabled = i === 0;
      }
      setCurrentAudioTrack(0);
    }
  };

  // Ação 1-Clique: Ativar modo LEGENDADO (Coloca Áudio em Inglês + Legenda PT-BR Automática!)
  const handleActivateLegendado = () => {
    setPreferredMode('legendado');
    setSubtitleMode('auto_pt');

    // 1. Se o catálogo possui o canal em Inglês (ex: HBO -> US: HBO) ou versão [Leg] e estamos no Dublado, troca automaticamente!
    if (!isCurrentLegendadoStream && alternateAudioChannel && onSelectChannel) {
      onSelectChannel(alternateAudioChannel);
      return;
    }

    // 2. Se for um Filme ou Série MP4 [Dual], troca a faixa binária do MP4 para Faixa 1 (Inglês Original) mantendo o minuto/segundo atual!
    if (
      channel &&
      (channel.mediaType === 'movie' || channel.mediaType === 'series') &&
      currentAudioTrack !== 1
    ) {
      if (videoRef.current && videoRef.current.currentTime > 1) {
        pendingSeekTimeRef.current = videoRef.current.currentTime;
      }
      setCurrentAudioTrack(1);
      loadStream(channel, true, forceTsProtocol, 1);
      return;
    }

    // 3. Se for um canal Ao Vivo que só tem áudio Dublado na lista (sem versão US:), ativa o SAP Sintético IA em Inglês + Legenda BR!
    if (channel?.mediaType === 'live' && !alternateAudioChannel && audioTracks.length <= 1) {
      setAiEnglishVoiceOver(true);
      const now = videoRef.current?.currentTime ?? 0;
      const cues = liveCeaCuesRef.current;
      const currentOrLatestCue =
        cues.find((c) => now >= c.startTime - 0.5 && now <= c.endTime + 1.0) ||
        (cues.length > 0 ? cues[cues.length - 1] : null);
      if (currentOrLatestCue) {
        setLiveCcText(currentOrLatestCue.rawText);
        if (currentOrLatestCue.enText) {
          speakEnglishNeuralTts(currentOrLatestCue.enText);
        } else {
          const cleanSpeech = currentOrLatestCue.rawText
            .replace(/^>>\s*/, '')
            .replace(/^\[[^\]]+\]\s*/, '')
            .replace(/♪[^♪]*♪?/g, '')
            .trim();
          if (cleanSpeech.length >= 2) {
            translateLiveCaption(cleanSpeech, 'pt', 'en').then((en) => {
              currentOrLatestCue.enText = en;
              speakEnglishNeuralTts(en);
            });
          }
        }
      }
    }

    // 4. Se o stream HLS possui múltiplas faixas de áudio, muda para o áudio em Inglês
    if (hlsRef.current && hlsRef.current.audioTracks.length > 1) {
      const origIdx = hlsRef.current.audioTracks.findIndex((t) =>
        /en|eng|orig|ing/i.test(`${t.name} ${t.lang}`)
      );
      const targetIdx = origIdx >= 0 ? origIdx : 1;
      hlsRef.current.audioTrack = targetIdx;
      setCurrentAudioTrack(targetIdx);
    }
    const videoEl = videoRef.current as any;
    if (videoEl?.audioTracks && videoEl.audioTracks.length > 1) {
      for (let i = 0; i < videoEl.audioTracks.length; i++) {
        videoEl.audioTracks[i].enabled = i === 1;
      }
      setCurrentAudioTrack(1);
    }
  };

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
    }, 450);
  }, []);

  const resolveStreamUrl = useCallback(
    (rawUrl: string, forceProxy: boolean, audioTrackIdx = 0): string => {
      if (!rawUrl) return '';
      if (forceProxy || audioTrackIdx > 0) {
        return `/api/stream?url=${encodeURIComponent(rawUrl)}&audioTrack=${audioTrackIdx}`;
      }
      return rawUrl;
    },
    []
  );

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
        // ignore cleanup errors
      }
      mpegtsRef.current = null;
    }
  }, []);

  const loadStream = useCallback(
    (
      targetChannel: ChannelItem,
      proxyEnabled: boolean,
      preferTs = false,
      audioTrackOverride = 0
    ) => {
      const video = videoRef.current;
      if (!video) return;

      destroyPlayers();
      setErrorMsg(null);
      setIsBuffering(true);
      setQualities([]);
      setCurrentQuality(-1);
      setAudioTracks([]);
      setCurrentAudioTrack(audioTrackOverride);
      setSubtitleTracks([]);
      networkRetryCountRef.current = 0;
      liveCeaCuesRef.current = [];
      ceaDecoderStateRef.current = { text: '', lastA: -1, lastB: -1, startPts: -1 };

      // Se for o card-pai de uma série Xtream (antes do 1º episódio ser resolvido por get_series_info),
      // aguarda a resolução do episódio em vez de tentar tocar o series_id bruto
      if (targetChannel.mediaType === 'series' && targetChannel.id.startsWith('xt-series-')) {
        return;
      }

      let targetUrl = targetChannel.url;
      if (preferTs && targetUrl.endsWith('.m3u8') && targetChannel.mediaType === 'live') {
        targetUrl = targetUrl.replace(/\.m3u8$/i, '.ts');
      }

      const finalUrl = resolveStreamUrl(targetUrl, proxyEnabled, audioTrackOverride);
      const lowerUrl = targetUrl.toLowerCase();
      const isVodFile =
        targetChannel.mediaType === 'movie' ||
        targetChannel.mediaType === 'series' ||
        /\.(mp4|mkv|avi|mov|webm)/i.test(lowerUrl) ||
        /\/(movie|series)\//i.test(lowerUrl);
      const isHlsStream =
        !isVodFile &&
        !preferTs &&
        (lowerUrl.includes('.m3u8') || targetChannel.containerExtension === 'm3u8');
      const isTsStream =
        !isVodFile &&
        (preferTs ||
          (!isHlsStream &&
            (lowerUrl.endsWith('.ts') ||
              targetChannel.containerExtension === 'ts' ||
              lowerUrl.includes('/live/') ||
              /\/\d+(\?.*)?$/.test(lowerUrl))));

      const startMpegTsFallback = () => {
        if (!mpegts.getFeatureList().mseLivePlayback) return false;
        // IMPORTANTE: Garante que a URL enviada para o mpegts.js seja .ts binário e NUNCA uma playlist texto .m3u8!
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
            stashInitialSize: 384 * 1024,
            liveBufferLatencyChasing: false,
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: 40,
            autoCleanupMinBackwardDuration: 20,
          }
        );
        mpegtsRef.current = player;
        player.attachMediaElement(video);
        player.load();
        const playPromise = player.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => setIsPlaying(false));
        }
        player.on(mpegts.Events.ERROR, (_errType: any, _errDetail: any) => {
          // Se o stream já tem dados no buffer reproduzindo, ignora micro-oscilações de rede
          if (video && !video.paused && video.readyState >= 2) {
            return;
          }
          clearBufferingIndicator();
          setErrorMsg('Canal temporariamente indisponível no servidor IPTV.');
        });
        setStreamResolution('MPEG-TS PIPE');
        return true;
      };

      if (isTsStream && startMpegTsFallback()) {
        return;
      }

      if (isHlsStream && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          enableWebVTT: true,
          enableIMSC1: true,
          enableCEA708Captions: true,
          lowLatencyMode: false,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          backBufferLength: 30,
          maxBufferHole: 0.5,
          highBufferWatchdogPeriod: 2,
          nudgeOffset: 0.25,
          nudgeMaxRetry: 12,
          maxFragLookUpTolerance: 0.25,
          manifestLoadingTimeOut: 15000,
          manifestLoadingMaxRetry: 4,
          levelLoadingTimeOut: 15000,
          fragLoadingTimeOut: 25000,
          fragLoadingMaxRetry: 6,
        });
        hls.subtitleDisplay = false;
        hlsRef.current = hls;

        hls.loadSource(finalUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          const levels: QualityLevel[] = data.levels.map((lvl, idx) => ({
            index: idx,
            label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)} kbps`,
          }));
          setQualities(levels);
          if (data.levels.length > 0 && data.levels[0].height) {
            const maxH = Math.max(...data.levels.map((l) => l.height || 720));
            setStreamResolution(maxH >= 2160 ? '4K UHD' : maxH >= 1080 ? '1080p FHD' : `${maxH}p HD`);
          } else {
            setStreamResolution('HLS LIVE');
          }
          video.play().catch(() => setIsPlaying(false));
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
          if (Array.isArray(data.audioTracks) && data.audioTracks.length > 0) {
            setAudioTracks(
              data.audioTracks.map((t, idx) => ({
                id: idx,
                label: t.name || t.lang || `Faixa de Áudio ${idx + 1}`,
                lang: t.lang,
              }))
            );
            setCurrentAudioTrack(hls.audioTrack >= 0 ? hls.audioTrack : 0);
          }
        });

        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event, data) => {
          setCurrentAudioTrack(data.id);
        });

        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
          if (Array.isArray(data.subtitleTracks) && data.subtitleTracks.length > 0) {
            setSubtitleTracks(
              data.subtitleTracks.map((t, idx) => ({
                id: idx,
                label: t.name || t.lang || `Legenda Embutida ${idx + 1}`,
                lang: t.lang,
              }))
            );
          }
        });

        // Decodifica em tempo real os pacotes binários CEA-608 (ATSC GA94) embutidos nos frames H.264 (Globo, Telecine, HBO, etc.)
        // e já pré-traduz para Inglês / Português-BR antes mesmo do vídeo atingir o segundo da fala!
        hls.on(Hls.Events.FRAG_PARSING_USERDATA, (_event, data) => {
          if (!data?.samples || data.samples.length === 0) return;
          const fragStart = typeof data.frag?.start === 'number' ? data.frag.start : undefined;
          const extracted = decodeCea608Samples(
            data.samples,
            ceaDecoderStateRef.current,
            fragStart
          );
          if (extracted.length > 0) {
            for (const cue of extracted) {
              const cleanSpeech = cue.rawText
                .replace(/^>>\s*/, '')
                .replace(/^\[[^\]]+\]\s*/, '')
                .replace(/♪[^♪]*♪?/g, '')
                .trim();
              if (cleanSpeech.length >= 2) {
                translateLiveCaption(cleanSpeech, 'pt', 'en').then((en) => {
                  cue.enText = en;
                });
                translateLiveCaption(cleanSpeech, 'en', 'pt-BR').then((pt) => {
                  cue.ptText = pt;
                });
              }
              liveCeaCuesRef.current.push(cue);
            }
            if (liveCeaCuesRef.current.length > 80) {
              liveCeaCuesRef.current = liveCeaCuesRef.current.slice(-80);
            }
          }
        });

        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          networkRetryCountRef.current = 0;
          setIsAutoReconnecting(false);
          setReconnectAttempt(0);
          clearBufferingIndicator();
          setErrorMsg(null);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) {
            if (
              data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
              data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL
            ) {
              if (video && video.buffered.length > 0) {
                clearBufferingIndicator();
              }
            }
            return;
          }

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (!proxyEnabled) {
              onToggleProxyRef.current();
              return;
            }
            if (networkRetryCountRef.current < 3) {
              networkRetryCountRef.current += 1;
              setIsAutoReconnecting(true);
              setReconnectAttempt(networkRetryCountRef.current);
              setReconnectStatusText(`Sinal instável. Reconectando automaticamente (${networkRetryCountRef.current}/3)...`);
              window.setTimeout(() => {
                if (hlsRef.current) {
                  hlsRef.current.startLoad();
                }
              }, 1200 * networkRetryCountRef.current);
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
            setIsAutoReconnecting(false);
            setErrorMsg('Sinal temporariamente indisponível no servidor.');
          }
        });
        return;
      }

      // 3. Reprodução nativa HTML5 (MP4, MKV ou Safari HLS nativo)
      video.src = finalUrl;
      video.onerror = () => {
        // Se falhou via proxy em arquivo VOD/Série MP4, tenta URL direta da CDN (ou vice-versa) automaticamente
        if (video.src !== targetUrl && targetUrl.startsWith('http')) {
          video.onerror = null;
          video.src = targetUrl;
          video.play().catch(() => setIsPlaying(false));
        }
      };
      video.onloadedmetadata = () => {
        if (pendingSeekTimeRef.current && pendingSeekTimeRef.current > 0) {
          video.currentTime = pendingSeekTimeRef.current;
          pendingSeekTimeRef.current = null;
        }
        const videoEl = video as any;
        if (videoEl.audioTracks && videoEl.audioTracks.length > 1) {
          const tracks: TrackOption[] = [];
          for (let i = 0; i < videoEl.audioTracks.length; i++) {
            const tr = videoEl.audioTracks[i];
            tracks.push({
              id: i,
              label:
                tr.label ||
                tr.language ||
                (i === 0 ? 'Áudio 1 (Dublado PT-BR)' : `Áudio ${i + 1} (Original)`),
              lang: tr.language,
            });
          }
          setAudioTracks(tracks);
        }
      };
      setStreamResolution(
        targetChannel.mediaType === 'movie'
          ? 'VOD DIRECT'
          : targetChannel.mediaType === 'series'
          ? 'SERIES HD'
          : 'NATIVE STREAM'
      );
      video.play().catch(() => setIsPlaying(false));
    },
    [destroyPlayers, resolveStreamUrl, clearBufferingIndicator]
  );

  const channelId = channel?.id;
  const channelUrl = channel?.url;
  useEffect(() => {
    if (channel) {
      loadStream(channel, useProxyBuffer, forceTsProtocol);
    }
    return () => {
      destroyPlayers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, channelUrl, useProxyBuffer, forceTsProtocol]);

  // Inicializa e renderiza o Visualizador de Espectro de Áudio Cyberpunk
  useEffect(() => {
    if (!showSpectrum || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const barCount = 26;
    const smoothBars = new Array(barCount).fill(6);

    const renderFrame = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let freqData: Uint8Array<ArrayBuffer> | null = null;
      if (analyserRef.current && isPlaying && !isMuted) {
        freqData = new Uint8Array(new ArrayBuffer(analyserRef.current.frequencyBinCount));
        analyserRef.current.getByteFrequencyData(freqData);
      }

      const barGap = 4;
      const totalGapSpace = barGap * (barCount - 1);
      const barWidth = Math.max(3, (width - totalGapSpace - 16) / barCount);
      const time = performance.now() * 0.0045;

      for (let i = 0; i < barCount; i++) {
        let targetHeight = 6;

        if (freqData && freqData.length > 0) {
          const binIdx = Math.min(
            freqData.length - 1,
            Math.floor((i / barCount) * (freqData.length * 0.65))
          );
          const val = freqData[binIdx];
          if (val > 4) {
            targetHeight = Math.max(6, (val / 255) * (height - 16));
          }
        }

        if (isPlaying && !isMuted && targetHeight <= 8) {
          const wave1 = Math.sin(time * 2.1 + i * 0.45) * 0.5 + 0.5;
          const wave2 = Math.cos(time * 3.4 - i * 0.3) * 0.5 + 0.5;
          const envelope = Math.sin((i / (barCount - 1)) * Math.PI);
          targetHeight = Math.max(
            6,
            (wave1 * 0.6 + wave2 * 0.4) * envelope * (height - 14) * Math.max(0.25, volume)
          );
        }

        smoothBars[i] += (targetHeight - smoothBars[i]) * 0.22;
        const barH = Math.min(height - 8, Math.max(5, smoothBars[i]));
        const x = 8 + i * (barWidth + barGap);
        const y = height - barH - 4;

        const grad = ctx.createLinearGradient(x, y, x, height - 4);
        grad.addColorStop(0, '#5efce8');
        grad.addColorStop(0.5, '#00f2fe');
        grad.addColorStop(1, '#0891b2');

        ctx.shadowColor = 'rgba(0, 242, 254, 0.75)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 3);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(renderFrame);
    };

    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [showSpectrum, isPlaying, isMuted, volume]);

  const connectWebAudioIfPossible = () => {
    try {
      if (!videoRef.current || audioCtxRef.current) return;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      const source = ctx.createMediaElementSource(videoRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceNodeRef.current = source;
    } catch {
      // Fallback silencioso
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    connectWebAudioIfPossible();
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    setIsMuted(val === 0);
  };

  const handleQualityChange = (levelIndex: number) => {
    setCurrentQuality(levelIndex);
    setShowQualityMenu(false);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
    }
  };

  const handleSelectAudioTrack = (trackId: number) => {
    setCurrentAudioTrack(trackId);
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackId;
    }
    const videoEl = videoRef.current as any;
    if (videoEl?.audioTracks) {
      for (let i = 0; i < videoEl.audioTracks.length; i++) {
        videoEl.audioTracks[i].enabled = i === trackId;
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {
      // PiP não suportado
    }
  };

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

  const progressPercent =
    duration > 0 && Number.isFinite(duration)
      ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
      : channel?.epgCurrent?.progress ?? 42;

  const uiVisible =
    controlsVisible || !isPlaying || showQualityMenu || showCaptionMenu || showSettingsMenu;
  const captionsActive = subtitleMode !== 'off';

  // Atalhos de teclado no Player: Espaço (play/pause), F (tela cheia), M (mute), L (alternar dublado/legendado)
  // Busca sinal alternativo do mesmo canal ou emissora na playlist
  useEffect(() => {
    if (!channel || !playlistChannels || playlistChannels.length === 0) {
      setAlternateCandidate(null);
      return;
    }
    const cleanCurrent = channel.name
      .replace(/\[.*?\]|\(.*?\)|(FHD|4K|HD|SD|H265|HEVC|1080P|720P)/gi, '')
      .trim()
      .toLowerCase();

    // 1. Procura mesmo canal em qualidade alternativa (ex: HD ou Alternativo)
    const matchSameName = playlistChannels.find(
      (c) =>
        c.id !== channel.id &&
        c.mediaType === channel.mediaType &&
        c.name.toLowerCase().includes(cleanCurrent)
    );
    if (matchSameName) {
      setAlternateCandidate(matchSameName);
      return;
    }

    // 2. Ou canal do mesmo grupo
    const sameGroup = playlistChannels.filter(
      (c) => c.group === channel.group && c.id !== channel.id && c.mediaType === channel.mediaType
    );
    setAlternateCandidate(sameGroup[0] || null);
  }, [channel, playlistChannels]);

  // Lista para o Guia Rápido de Zapping dentro do Player
  const quickDrawerChannels = useMemo(() => {
    if (!playlistChannels || playlistChannels.length === 0) return [];
    let list = playlistChannels;
    if (drawerFilter === 'same_group' && channel?.group) {
      list = list.filter((c) => c.group === channel.group);
    }
    const q = drawerSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
    }
    return list;
  }, [playlistChannels, drawerFilter, channel, drawerSearch]);

  const handleSeekBackward10 = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
      wakeUpControls();
    }
  }, [wakeUpControls]);

  const handleSeekForward10 = useCallback(() => {
    if (videoRef.current) {
      const maxDur = Number.isFinite(videoRef.current.duration) ? videoRef.current.duration : Infinity;
      videoRef.current.currentTime = Math.min(maxDur, videoRef.current.currentTime + 10);
      wakeUpControls();
    }
  }, [wakeUpControls]);

  // Gestos Touch Mobile: Toque único (controles) e Duplo Toque (-10s / +10s)
  const handleTouchTap = useCallback(
    (clientX: number) => {
      const now = Date.now();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const relX = clientX - rect.left;
      const ratioX = relX / rect.width;

      const timeDiff = now - lastTapRef.current.time;
      const distDiff = Math.abs(clientX - lastTapRef.current.x);

      if (timeDiff < 320 && distDiff < 90) {
        // DUPLO TOQUE DETECTADO!
        if (ratioX < 0.38) {
          handleSeekBackward10();
          setTouchFeedback({ side: 'left', id: Date.now() });
          window.setTimeout(() => setTouchFeedback(null), 650);
        } else if (ratioX > 0.62) {
          handleSeekForward10();
          setTouchFeedback({ side: 'right', id: Date.now() });
          window.setTimeout(() => setTouchFeedback(null), 650);
        } else {
          togglePlay();
        }
        lastTapRef.current = { time: 0, x: 0 };
      } else {
        lastTapRef.current = { time: now, x: clientX };
        wakeUpControls();
      }
    },
    [handleSeekBackward10, handleSeekForward10, togglePlay, wakeUpControls]
  );

  // Proporção de Tela (Aspect Ratio): Ciclar entre Padrão, Preencher, Esticar e 4:3
  const handleCycleAspectRatio = useCallback(() => {
    setAspectRatio((prev) => {
      const modes: VideoAspectRatio[] = ['contain', 'cover', 'fill', '4:3'];
      const next = modes[(modes.indexOf(prev) + 1) % modes.length];
      try {
        localStorage.setItem('nextplay_aspect_ratio', next);
      } catch {
        // ignore
      }
      setAspectToast(`Proporção: ${ASPECT_RATIO_LABELS[next]}`);
      window.setTimeout(() => setAspectToast(null), 2500);
      return next;
    });
    wakeUpControls();
  }, [wakeUpControls]);

  // "Continuar Assistindo": Inicialização e Retomada de Ponto de Parada
  useEffect(() => {
    if (!channel) {
      setResumePrompt(null);
      hasInitializedProgressRef.current = null;
      return;
    }
    // Apenas para Filmes ou Séries se tiver mais de 15 segundos salvos no histórico
    if (
      (channel.mediaType === 'movie' || channel.mediaType === 'series') &&
      initialProgressSeconds &&
      initialProgressSeconds > 15 &&
      hasInitializedProgressRef.current !== channel.id
    ) {
      hasInitializedProgressRef.current = channel.id;
      setResumePrompt({ progressSeconds: initialProgressSeconds });
      // Mantém o banner visível por 12 segundos e depois oculta suavemente
      const timer = window.setTimeout(() => {
        setResumePrompt(null);
      }, 12000);
      return () => clearTimeout(timer);
    } else {
      setResumePrompt(null);
    }
  }, [channel, initialProgressSeconds]);

  const handleResumeFromSavedTime = useCallback(() => {
    if (videoRef.current && resumePrompt) {
      videoRef.current.currentTime = resumePrompt.progressSeconds;
      setCurrentTime(resumePrompt.progressSeconds);
      setResumePrompt(null);
      wakeUpControls();
    }
  }, [resumePrompt, wakeUpControls]);

  const handleRestartFromBeginning = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      setResumePrompt(null);
      wakeUpControls();
    }
  }, [wakeUpControls]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em input ou textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // 1. Navegação D-Pad quando a Gaveta Rápida (Zapping) está aberta
      if (showQuickDrawer) {
        if (e.code === 'ArrowUp') {
          e.preventDefault();
          setFocusedDrawerIndex((idx) => {
            const next = Math.max(0, idx - 1);
            const el = drawerListRef.current?.children[next] as HTMLElement;
            el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return next;
          });
          return;
        }
        if (e.code === 'ArrowDown') {
          e.preventDefault();
          setFocusedDrawerIndex((idx) => {
            const next = Math.min(quickDrawerChannels.length - 1, idx + 1);
            const el = drawerListRef.current?.children[next] as HTMLElement;
            el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return next;
          });
          return;
        }
        if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.key === 'Select') {
          e.preventDefault();
          const selected = quickDrawerChannels[focusedDrawerIndex];
          if (selected && onSelectChannel) {
            onSelectChannel(selected);
            setShowQuickDrawer(false);
          }
          return;
        }
        if (e.code === 'Escape' || e.key === 'Back' || e.key === 'BrowserBack' || e.code === 'ArrowLeft') {
          e.preventDefault();
          setShowQuickDrawer(false);
          return;
        }
      }

      // 2. Atalhos Globais e Controle Remoto de TV
      if (e.code === 'Space' || e.key === 'MediaPlayPause') {
        e.preventDefault();
        togglePlay();
        wakeUpControls();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyA') {
        // Tecla A: Ciclar Proporção de Tela (Aspect Ratio)
        e.preventDefault();
        handleCycleAspectRatio();
      } else if (e.code === 'KeyZ' || e.code === 'KeyG') {
        // Tecla Z ou G: Abrir / Fechar Guia Rápido de Zapping
        e.preventDefault();
        setShowQuickDrawer((v) => !v);
        wakeUpControls();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
        wakeUpControls();
      } else if (e.code === 'KeyL' || e.code === 'KeyD') {
        e.preventDefault();
        if (isLegendadoActive) {
          handleActivateDublado();
        } else {
          handleActivateLegendado();
        }
        wakeUpControls();
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        setShowCaptionMenu((v) => !v);
        wakeUpControls();
      } else if (e.code === 'ArrowRight' || e.key === 'MediaFastForward') {
        if (videoRef.current && Number.isFinite(videoRef.current.duration)) {
          e.preventDefault();
          videoRef.current.currentTime = Math.min(
            videoRef.current.duration,
            videoRef.current.currentTime + 10
          );
          wakeUpControls();
        }
      } else if (e.code === 'ArrowLeft' || e.key === 'MediaRewind') {
        if (videoRef.current && Number.isFinite(videoRef.current.duration)) {
          e.preventDefault();
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          wakeUpControls();
        }
      } else if (
        e.code === 'ChannelUp' ||
        e.key === 'ChannelUp' ||
        e.code === 'PageUp' ||
        e.key === 'MediaTrackPrevious' ||
        (channel?.mediaType === 'live' && e.code === 'ArrowUp')
      ) {
        // TV D-Pad Cima em Canais Ao Vivo: Canal Anterior
        e.preventDefault();
        onPrevChannel();
        wakeUpControls();
      } else if (
        e.code === 'ChannelDown' ||
        e.key === 'ChannelDown' ||
        e.code === 'PageDown' ||
        e.key === 'MediaTrackNext' ||
        (channel?.mediaType === 'live' && e.code === 'ArrowDown')
      ) {
        // TV D-Pad Baixo em Canais Ao Vivo: Próximo Canal
        e.preventDefault();
        onNextChannel();
        wakeUpControls();
      } else if (e.code === 'ArrowUp') {
        // Filmes/Séries: Aumenta o volume
        e.preventDefault();
        setVolume((v) => {
          const nv = Math.min(1, +(v + 0.05).toFixed(2));
          if (videoRef.current) {
            videoRef.current.volume = nv;
            videoRef.current.muted = false;
          }
          setIsMuted(false);
          return nv;
        });
        wakeUpControls();
      } else if (e.code === 'ArrowDown') {
        // Filmes/Séries: Diminui o volume
        e.preventDefault();
        setVolume((v) => {
          const nv = Math.max(0, +(v - 0.05).toFixed(2));
          if (videoRef.current) {
            videoRef.current.volume = nv;
            videoRef.current.muted = nv === 0;
          }
          setIsMuted(nv === 0);
          return nv;
        });
        wakeUpControls();
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.key === 'Select') {
        // Tecla OK do Controle Remoto
        e.preventDefault();
        if (resumePrompt) {
          handleResumeFromSavedTime();
        } else if (!controlsVisible) {
          wakeUpControls();
        } else {
          togglePlay();
        }
      } else if (e.code === 'Escape' || e.key === 'Back' || e.key === 'BrowserBack') {
        if (showCaptionMenu || showQualityMenu || showSettingsMenu) {
          e.preventDefault();
          setShowCaptionMenu(false);
          setShowQualityMenu(false);
          setShowSettingsMenu(false);
        } else if (resumePrompt) {
          e.preventDefault();
          setResumePrompt(null);
        } else if (!document.fullscreenElement && onClose) {
          e.preventDefault();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showQuickDrawer,
    quickDrawerChannels,
    focusedDrawerIndex,
    onSelectChannel,
    channel,
    onPrevChannel,
    onNextChannel,
    resumePrompt,
    handleResumeFromSavedTime,
    controlsVisible,
    togglePlay,
    toggleFullscreen,
    handleCycleAspectRatio,
    toggleMute,
    isLegendadoActive,
    handleActivateDublado,
    handleActivateLegendado,
    wakeUpControls,
    showCaptionMenu,
    showQualityMenu,
    showSettingsMenu,
    onClose,
  ]);

  const aspectRatioClass = useMemo(() => {
    switch (aspectRatio) {
      case 'cover':
        return 'object-cover';
      case 'fill':
        return 'object-fill';
      case '4:3':
        return 'object-contain max-w-[calc(100vh*4/3)] mx-auto';
      case 'contain':
      default:
        return 'object-contain';
    }
  }, [aspectRatio]);

  return (
    <div
      ref={containerRef}
      onMouseMove={wakeUpControls}
      onTouchStart={wakeUpControls}
      onClick={wakeUpControls}
      onMouseLeave={() => {
        if (isPlaying && !showQualityMenu && !showCaptionMenu) {
          setControlsVisible(false);
        }
      }}
      className={`relative w-full h-full aspect-video bg-black overflow-hidden select-none transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen max-h-none rounded-none border-0'
          : 'rounded-2xl border border-cyan-500/20 shadow-[0_12px_40px_rgba(0,0,0,0.75)]'
      } ${!uiVisible ? 'cursor-none' : ''}`}
    >
      {/* Elemento de Vídeo com Aceleração de Hardware */}
      <video
        ref={videoRef}
        className={`w-full h-full ${aspectRatioClass} bg-black transition-all duration-300 ${!uiVisible ? 'cursor-none' : 'cursor-pointer'}`}
        playsInline
        crossOrigin="anonymous"
        onClick={(e) => {
          handleTouchTap(e.clientX);
        }}
        onTouchEnd={(e) => {
          if (e.changedTouches && e.changedTouches[0]) {
            handleTouchTap(e.changedTouches[0].clientX);
          }
        }}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          setIsPlaying(false);
          setControlsVisible(true);
          if (channel && (channel.mediaType === 'movie' || channel.mediaType === 'series') && onProgressUpdate && videoRef.current) {
            onProgressUpdate(channel.id, videoRef.current.currentTime, videoRef.current.duration || 0);
          }
        }}
        onWaiting={triggerBufferingWithDebounce}
        onCanPlay={clearBufferingIndicator}
        onCanPlayThrough={clearBufferingIndicator}
        onPlaying={() => {
          clearBufferingIndicator();
          setErrorMsg(null);
          setIsAutoReconnecting(false);
          setReconnectAttempt(0);
        }}
        onTimeUpdate={() => {
          if (videoRef.current) {
            if (!videoRef.current.paused && videoRef.current.readyState >= 2) {
              clearBufferingIndicator();
            }
            const curTime = videoRef.current.currentTime;
            const dur = videoRef.current.duration || 0;
            setCurrentTime(curTime);
            setDuration(dur);

            // Salva progresso de filmes e séries periodicamente a cada 4 segundos
            if (channel && (channel.mediaType === 'movie' || channel.mediaType === 'series') && onProgressUpdate) {
              const now = Date.now();
              if (now - lastProgressSaveRef.current > 4000) {
                lastProgressSaveRef.current = now;
                onProgressUpdate(channel.id, curTime, dur);
              }
            }
          }
        }}
      />

      {/* OVERLAY DE LEGENDA AUTOMÁTICA ONLINE & CLOSED CAPTION (CC)
          Permanece visível mesmo quando os controles somem em Tela Cheia! */}
      {activeCaptionText && (
        <div
          className={`absolute inset-x-6 z-10 flex justify-center pointer-events-none transition-all duration-300 ${
            uiVisible ? 'bottom-20' : 'bottom-8'
          }`}
        >
          <div
            className={`max-w-3xl px-4 py-1.5 rounded-xl bg-black/85 backdrop-blur-md border border-cyan-400/35 text-center shadow-[0_4px_24px_rgba(0,0,0,0.9)] ${
              subtitleFontSize === 'sm'
                ? 'text-xs sm:text-sm'
                : subtitleFontSize === 'lg'
                ? 'text-base sm:text-xl md:text-2xl'
                : 'text-sm sm:text-base md:text-lg'
            } font-bold text-white whitespace-pre-line leading-snug`}
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.95)' }}
          >
            {activeCaptionText}
          </div>
        </div>
      )}

      {/* Top Overlay: Informações do Canal, Seletor Rápido Dublado/Legendado, Resolução e Hardware */}
      <div
        className={`absolute top-0 inset-x-0 p-2 sm:p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between transition-all duration-500 z-20 ${
          uiVisible
            ? 'opacity-100 translate-y-0 pointer-events-none'
            : 'opacity-0 -translate-y-3 pointer-events-none'
        }`}
      >
        <div className={`flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2 ${uiVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-black/60 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 text-xs font-bold transition border border-cyan-500/40 shrink-0 group shadow-lg pointer-events-auto backdrop-blur-md"
              title="Voltar ao Catálogo (Esc)"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
          )}

          {channel?.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-contain border border-cyan-400/30 bg-slate-900/90 shrink-0 p-0.5"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wider uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                {channel?.mediaType === 'movie'
                  ? 'VOD'
                  : channel?.mediaType === 'series'
                  ? 'SÉRIE'
                  : 'AO VIVO'}
              </span>
              <span className="px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0">
                {streamResolution}
              </span>
              <span
                className={`hidden md:inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                  isLegendadoActive
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                    : 'bg-teal-500/20 text-teal-300 border-teal-400/40'
                }`}
              >
                {isLegendadoActive ? '💬 LEGENDADO' : '🇧🇷 DUBLADO'}
              </span>
            </div>
            <h2 className="text-xs sm:text-base font-bold text-white drop-shadow mt-0.5 truncate">
              {channel?.name || 'Selecione um canal'}
            </h2>
          </div>
        </div>

        {/* Botões Rápidos no Topo Direito (Visual Limpo e Intuitivo) */}
        <div className={`flex items-center gap-1.5 sm:gap-2 shrink-0 ${uiVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          {/* Chave Rápida 1-Clique no Topo: Dublado <-> Legendado (visível a partir de sm para economizar espaço em mobile) */}
          <div className="hidden sm:flex items-center bg-slate-900/85 p-0.5 rounded-lg border border-slate-700/80 shadow-md">
            <button
              onClick={handleActivateDublado}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                !isLegendadoActive
                  ? 'bg-teal-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🇧🇷 Dublado
            </button>
            <button
              onClick={handleActivateLegendado}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${
                isLegendadoActive
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              💬 Legendado
            </button>
          </div>

          {channel && (
            <button
              onClick={() => onToggleFavorite(channel.id)}
              title={isFavorite ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
              className={`p-1.5 sm:p-2 rounded-lg border transition-all ${
                isFavorite
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                  : 'bg-slate-900/75 border-slate-700/70 text-slate-400 hover:text-rose-300'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFavorite ? 'fill-rose-500' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Feedback Visual de Duplo Toque no Mobile (Estilo YouTube/Netflix) */}
      {touchFeedback?.side === 'left' && (
        <div className="absolute left-6 sm:left-12 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center w-20 h-20 rounded-full bg-cyan-500/25 border border-cyan-400/60 backdrop-blur-md shadow-neon-cyan animate-pulse pointer-events-none">
          <RotateCcw className="w-7 h-7 text-white" />
          <span className="text-[11px] font-mono font-bold text-cyan-200 mt-1">-10s</span>
        </div>
      )}
      {touchFeedback?.side === 'right' && (
        <div className="absolute right-6 sm:right-12 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center w-20 h-20 rounded-full bg-cyan-500/25 border border-cyan-400/60 backdrop-blur-md shadow-neon-cyan animate-pulse pointer-events-none">
          <RotateCw className="w-7 h-7 text-white" />
          <span className="text-[11px] font-mono font-bold text-cyan-200 mt-1">+10s</span>
        </div>
      )}

      {/* Toast Flutuante de Proporção de Tela (Aspect Ratio) */}
      {aspectToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-black/85 backdrop-blur-md border border-cyan-400/60 text-white text-xs font-bold shadow-neon-cyan flex items-center gap-2 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <Crop className="w-4 h-4 text-cyan-400" />
          <span>{aspectToast}</span>
        </div>
      )}

      {/* Prompt Interativo de Retomar Reprodução ("Continuar Assistindo") */}
      {resumePrompt && (
        <div className="absolute bottom-24 left-4 sm:left-6 z-40 max-w-sm bg-[#0c141e]/95 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-3 sm:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.85)] animate-in slide-in-from-bottom duration-200">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <HistoryIcon className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">
                Continuar assistindo de onde você parou?
              </p>
              <p className="text-[11px] font-mono text-cyan-300 mt-0.5">
                Ponto salvo: <span className="font-bold">{formatProgressTime(resumePrompt.progressSeconds)}</span>
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={handleResumeFromSavedTime}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs shadow-neon-cyan transition flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  Continuar
                </button>
                <button
                  type="button"
                  onClick={handleRestartFromBeginning}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition"
                >
                  Do Início
                </button>
                <button
                  type="button"
                  onClick={() => setResumePrompt(null)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition"
                  title="Fechar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spinner de Buffering */}
      {isBuffering && !errorMsg && !isAutoReconnecting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] pointer-events-none z-20">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin shadow-neon-cyan" />
          <span className="mt-3 text-xs font-medium text-cyan-200 tracking-wider uppercase">
            Sincronizando Buffer...
          </span>
        </div>
      )}

      {/* Indicador de Auto-Reconexão Inteligente de Sinal */}
      {isAutoReconnecting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[2px] z-30 pointer-events-none">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <Zap className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <span className="mt-3 text-xs font-bold text-cyan-300 uppercase tracking-wider">
            {reconnectStatusText || 'Reconectando Transmissão...'}
          </span>
          <span className="mt-1 text-[11px] text-slate-400 font-mono">
            Ajustando rota do buffer automaticamente
          </span>
        </div>
      )}

      {/* Tela de Erro com Fallback Inteligente */}
      {errorMsg && !isAutoReconnecting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center z-30">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <p className="text-sm font-bold text-white max-w-md">{errorMsg}</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md">
            O sinal deste canal oscilou no servidor. Você pode tentar novamente ou alternar de sinal.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
            <button
              onClick={() => {
                setErrorMsg(null);
                setReconnectAttempt(0);
                if (channel) loadStream(channel, useProxyBuffer);
              }}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-neon-cyan flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar Reconectar</span>
            </button>

            {/* Botão de Troca Rápida para Sinal Alternativo (se houver) */}
            {alternateCandidate && onSelectChannel && (
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setReconnectAttempt(0);
                  onSelectChannel(alternateCandidate);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-emerald-300 font-bold text-xs transition flex items-center gap-1.5 shadow-lg"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Trocar para: {alternateCandidate.name}</span>
              </button>
            )}

            <button
              onClick={() => channel && loadStream(channel, !useProxyBuffer)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
            >
              Alternar {useProxyBuffer ? 'Stream Direto' : 'Buffer Proxy'}
            </button>
          </div>
        </div>
      )}

      {/* Visualizador de Espectro de Áudio DSP Flutuante (Oculto em telas pequenas para não poluir a tela) */}
      {showSpectrum && (
        <div
          className={`hidden sm:block absolute bottom-20 right-4 z-20 bg-[#0d151c]/90 backdrop-blur-md border border-cyan-400/30 rounded-xl p-2 shadow-[0_8px_30px_rgba(0,242,254,0.18)] pointer-events-none transition-all duration-500 ${
            uiVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="flex items-center justify-between px-1.5 mb-1">
            <span className="text-[9px] font-bold tracking-widest uppercase text-cyan-300/80">
              Audio Spectrum DSP
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <canvas ref={canvasRef} width={210} height={64} className="block" />
        </div>
      )}

      {/* Barra Flutuante Glassmórfica Inferior */}
      <div
        className={`absolute bottom-2 inset-x-2 sm:bottom-3 sm:inset-x-4 z-20 bg-[#131b24]/90 backdrop-blur-xl border border-white/10 rounded-xl px-2.5 sm:px-4 py-2 sm:py-2.5 shadow-2xl transition-all duration-500 ${
          uiVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Linha de Progresso com Brilho Neon Ciano */}
        <div
          className="relative w-full h-1 sm:h-1.5 bg-slate-700/70 rounded-full cursor-pointer mb-2 sm:mb-2.5 group/bar"
          onClick={(e) => {
            if (!videoRef.current || !duration || !Number.isFinite(duration)) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            videoRef.current.currentTime = ratio * duration;
          }}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-teal-300 relative transition-all duration-150"
            style={{ width: `${progressPercent}%` }}
          >
            <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 sm:w-3.5 h-3 sm:h-3.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#00f2fe] border-2 border-white" />
          </div>
        </div>

        {/* Controles Principais */}
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          {/* Esquerda: Tempo + Botão de Áudio (Dublado/Legendado) & Closed Caption (CC) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 relative">
            <span className="text-[10px] sm:text-[11px] font-mono text-slate-300 truncate max-w-[85px] sm:max-w-none">
              {duration > 0 && Number.isFinite(duration)
                ? `${formatTime(currentTime)} / ${formatTime(duration)}`
                : channel?.epgCurrent
                ? `${channel.epgCurrent.start} - ${channel.epgCurrent.end}`
                : 'AO VIVO'}
            </span>

            {/* Botão Principal: Legendas / Closed Caption (CC) & Dublado/Legendado */}
            <button
              onClick={() => {
                setShowCaptionMenu((v) => !v);
                setShowQualityMenu(false);
                setShowSettingsMenu(false);
                setShowQuickDrawer(false);
              }}
              title="Alternar entre Dublado e Legendado (Legenda Automática Online)"
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition flex items-center gap-1 sm:gap-1.5 ${
                captionsActive || isLegendadoActive || showCaptionMenu
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-neon-cyan'
                  : 'bg-white/5 hover:bg-white/10 border-slate-700 text-slate-300 hover:text-cyan-300'
              }`}
            >
              <Subtitles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">{captionsActive ? 'Legenda: ON' : 'CC / Áudio'}</span>
              <span className="sm:hidden">CC</span>
            </button>

            {/* Botão de Zapping / Guia Rápido de Canais no Player */}
            {playlistChannels && playlistChannels.length > 0 && (
              <button
                onClick={() => {
                  setShowQuickDrawer((v) => !v);
                  setShowCaptionMenu(false);
                  setShowSettingsMenu(false);
                }}
                title="Guia Rápido de Canais (Zapping sem fechar o vídeo)"
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition flex items-center gap-1 sm:gap-1.5 ${
                  showQuickDrawer
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-neon-cyan'
                    : 'bg-white/5 hover:bg-white/10 border-slate-700 text-slate-300 hover:text-cyan-300'
                }`}
              >
                <List className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Zapping</span>
                <span className="sm:hidden">Guia</span>
              </button>
            )}

            {/* PAINEL POPUP: ÁUDIO (DUBLADO / LEGENDADO) & LEGENDA AUTOMÁTICA ONLINE */}
            {showCaptionMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-11 left-0 sm:left-0 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-[#0b131c]/95 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl p-3 sm:p-3.5 shadow-[0_16px_45px_rgba(0,0,0,0.85)] z-40 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Languages className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                      Áudio & Closed Caption (CC)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400">
                    {isLegendadoActive ? 'MODO LEGENDADO' : 'MODO DUBLADO'}
                  </span>
                </div>

                {/* Seção 1: Clique Direto para escolher Dublado ou Legendado (sem precisar carregar arquivo!) */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    1. Idioma da Mídia (Dublado / Legendado)
                  </p>
                  <div className="space-y-1.5">
                    <button
                      onClick={handleActivateDublado}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition ${
                        !isLegendadoActive
                          ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200 shadow-neon-cyan'
                          : 'bg-[#101a26] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <span>🇧🇷 Assistir Dublado (Português)</span>
                      {!isLegendadoActive && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </button>

                    <button
                      onClick={handleActivateLegendado}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition ${
                        isLegendadoActive
                          ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 shadow-lg'
                          : 'bg-[#101a26] border-slate-800 text-slate-300 hover:border-amber-400/40 hover:text-amber-200'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span>💬 Assistir Legendado (Automático)</span>
                        {alternateAudioChannel && !isCurrentLegendadoStream && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-[9px] text-amber-300">
                            Stream [LEG]
                          </span>
                        )}
                      </span>
                      {isLegendadoActive ? (
                        <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
                      )}
                    </button>

                    {/* Faixas de Áudio Embutidas no Stream (quando houver mais de 1 faixa) */}
                    {audioTracks.length > 1 && (
                      <div className="pt-1 space-y-1">
                        <p className="text-[10px] text-slate-400">Faixas de Áudio do Stream:</p>
                        {audioTracks.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => handleSelectAudioTrack(t.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                              currentAudioTrack === t.id
                                ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                                : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <span>{t.label}</span>
                            {currentAudioTrack === t.id && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Seção 2: Legendas Automáticas Online & Closed Caption (Sem upload manual) */}
                <div className="border-t border-slate-800 pt-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      2. Legendas / Closed Caption Automático
                    </p>
                    {isFetchingAutoSub && (
                      <span className="flex items-center gap-1 text-[10px] text-cyan-300">
                        <Loader2 className="w-3 h-3 animate-spin" /> Buscando online...
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <button
                      onClick={() => setSubtitleMode('off')}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition ${
                        subtitleMode === 'off'
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <span>Desativado</span>
                      {subtitleMode === 'off' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => setSubtitleMode('auto_pt')}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition ${
                        subtitleMode === 'auto_pt'
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="text-left min-w-0">
                        <span className="block">Português (Brasil) — Automático Online</span>
                        {subtitleMode === 'auto_pt' && autoSubSourceName && (
                          <span className="block text-[9px] text-emerald-400 font-normal truncate">
                            ✓ Sincronizado: {autoSubSourceName}
                          </span>
                        )}
                      </div>
                      {subtitleMode === 'auto_pt' && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>

                    <button
                      onClick={() => setSubtitleMode('auto_en')}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition ${
                        subtitleMode === 'auto_en'
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <span>Inglês (CC) — Automático Online</span>
                      {subtitleMode === 'auto_en' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => setSubtitleMode('live_cc')}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition ${
                        subtitleMode === 'live_cc'
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <span>Closed Caption em Tempo Real (TV Ao Vivo)</span>
                      {subtitleMode === 'live_cc' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    {/* Opção Extra para canais "Só Dublados": SAP Sintético IA (Fala em Inglês + Legenda BR) */}
                    {channel?.mediaType === 'live' && (
                      <button
                        onClick={() => {
                          const nextVal = !aiEnglishVoiceOver;
                          setAiEnglishVoiceOver(nextVal);
                          if (nextVal && subtitleMode === 'off') {
                            setSubtitleMode('live_cc');
                          }
                          if (!nextVal && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                            window.speechSynthesis.cancel();
                            if (videoRef.current && !isMuted) videoRef.current.volume = volume;
                          }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition ${
                          aiEnglishVoiceOver
                            ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-400/40'
                            : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span>🎙️ SAP Sintético IA (Voz Inglês + Legenda BR)</span>
                        {aiEnglishVoiceOver && <Check className="w-3.5 h-3.5 text-amber-300" />}
                      </button>
                    )}

                    {/* Trilhas de Legenda Embutidas do Stream HLS (quando existirem) */}
                    {subtitleTracks.map((st) => (
                      <button
                        key={st.id}
                        onClick={() => {
                          setSubtitleMode('hls_native');
                          setCurrentHlsSubTrack(st.id);
                          if (hlsRef.current) {
                            hlsRef.current.subtitleDisplay = true;
                            hlsRef.current.subtitleTrack = st.id;
                          }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition ${
                          subtitleMode === 'hls_native' && currentHlsSubTrack === st.id
                            ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                            : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span>{st.label} (Embutida no Stream)</span>
                        {subtitleMode === 'hls_native' && currentHlsSubTrack === st.id && (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Controles de Tamanho da Legenda e Ajuste Fino de Sincronia */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <span>Tamanho:</span>
                      {(['sm', 'md', 'lg'] as const).map((sz) => (
                        <button
                          key={sz}
                          onClick={() => setSubtitleFontSize(sz)}
                          className={`px-2 py-0.5 rounded font-bold uppercase ${
                            subtitleFontSize === sz
                              ? 'bg-cyan-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {sz === 'sm' ? 'P' : sz === 'md' ? 'M' : 'G'}
                        </button>
                      ))}
                    </div>

                    {autoCues.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span>Sincronia:</span>
                        <button
                          onClick={() => setSubtitleOffsetSec((s) => +(s - 0.5).toFixed(1))}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white"
                        >
                          -0.5s
                        </button>
                        <span className="font-mono text-cyan-300">{subtitleOffsetSec}s</span>
                        <button
                          onClick={() => setSubtitleOffsetSec((s) => +(s + 0.5).toFixed(1))}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white"
                        >
                          +0.5s
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Centro: Anterior, Play/Pause Circular, Próximo */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={onPrevChannel}
              title="Canal / Episódio Anterior"
              className="text-slate-300 hover:text-cyan-300 transition p-1 sm:p-1.5 rounded-lg hover:bg-white/5"
            >
              <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              onClick={togglePlay}
              title={isPlaying ? 'Pausar' : 'Reproduzir'}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 flex items-center justify-center hover:bg-cyan-400 hover:text-slate-950 transition shadow-neon-cyan shrink-0"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5" />}
            </button>

            <button
              onClick={onNextChannel}
              title="Próximo Canal / Episódio"
              className="text-slate-300 hover:text-cyan-300 transition p-1 sm:p-1.5 rounded-lg hover:bg-white/5"
            >
              <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Direita: Volume com Barra Ciano, Seletor de Qualidade, PiP e Tela Cheia */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="text-slate-300 hover:text-cyan-300 transition"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 lg:w-20 h-1.5 accent-cyan-400 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            <button
              onClick={toggleMute}
              className="md:hidden text-slate-300 hover:text-cyan-300 transition p-1"
              title={isMuted ? 'Desmutar' : 'Mutar'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>

            {/* MENU DE CONFIGURAÇÕES AVANÇADAS (Engrenagem ⚙️): Protocolo TS/HLS, Buffer Express, Espectro DSP e Qualidade */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSettingsMenu((v) => !v);
                  setShowCaptionMenu(false);
                  setShowQualityMenu(false);
                }}
                title="Configurações do Player e Transmissão"
                className={`p-1 sm:p-1.5 rounded-lg border transition ${
                  showSettingsMenu
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-neon-cyan'
                    : 'text-slate-300 hover:text-cyan-300 hover:bg-white/5 border-transparent'
                }`}
              >
                <Settings className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 ${showSettingsMenu ? 'rotate-90 text-cyan-400' : ''}`} />
              </button>

              {showSettingsMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-11 right-0 w-[calc(100vw-2rem)] sm:w-80 max-w-xs bg-[#0b131c]/95 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl p-3 shadow-[0_16px_45px_rgba(0,0,0,0.85)] z-40 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                        Configurações
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400">{streamResolution}</span>
                  </div>

                  {/* Resolução / Qualidade de Vídeo */}
                  {qualities.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Qualidade do Vídeo
                      </p>
                      <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto pr-1">
                        <button
                          onClick={() => handleQualityChange(-1)}
                          className={`px-2 py-1.5 text-left text-xs rounded-lg transition ${
                            currentQuality === -1
                              ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-400/40'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          Auto (HD)
                        </button>
                        {qualities.map((q) => (
                          <button
                            key={q.index}
                            onClick={() => handleQualityChange(q.index)}
                            className={`px-2 py-1.5 text-left text-xs rounded-lg transition ${
                              currentQuality === q.index
                                ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-400/40'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Protocolo do Stream (Ao Vivo): HLS vs MPEG-TS */}
                  {channel?.mediaType === 'live' && (
                    <div className="border-t border-slate-800 pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Protocolo do Stream
                      </p>
                      <button
                        onClick={() => setForceTsProtocol((v) => !v)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                          forceTsProtocol
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                            : 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                        }`}
                      >
                        <span>{forceTsProtocol ? 'Modo: MPEG-TS Direct (.ts)' : 'Modo: HLS Adaptativo (.m3u8)'}</span>
                        <span className="text-[10px] opacity-75 underline">Alternar</span>
                      </button>
                    </div>
                  )}

                  {/* Buffer Express Local */}
                  <div className="border-t border-slate-800 pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Aceleração & Cache Local
                    </p>
                    <button
                      onClick={onToggleProxyBuffer}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                        useProxyBuffer
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 shadow-neon-cyan'
                          : 'bg-white/5 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Buffer Express (Proxy Local)
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${useProxyBuffer ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                        {useProxyBuffer ? 'LIGADO' : 'DESLIGADO'}
                      </span>
                    </button>
                  </div>

                  {/* Analisador de Áudio Spectrum DSP */}
                  <div className="border-t border-slate-800 pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Visualizador de Áudio
                    </p>
                    <button
                      onClick={onToggleSpectrum}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                        showSpectrum
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 shadow-neon-cyan'
                          : 'bg-white/5 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" />
                        Analisador Spectrum DSP
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${showSpectrum ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                        {showSpectrum ? 'VISÍVEL' : 'OCULTO'}
                      </span>
                    </button>
                  </div>

                  {/* Proporção de Tela (Aspect Ratio) */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Proporção de Tela
                      </p>
                      <span className="text-[10px] font-mono text-cyan-400">Atalho: A</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {(['contain', 'cover', 'fill', '4:3'] as VideoAspectRatio[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => {
                            setAspectRatio(mode);
                            try {
                              localStorage.setItem('nextplay_aspect_ratio', mode);
                            } catch {
                              // ignore
                            }
                            setAspectToast(`Proporção: ${ASPECT_RATIO_LABELS[mode]}`);
                            window.setTimeout(() => setAspectToast(null), 2500);
                          }}
                          className={`px-2 py-1.5 text-left text-xs rounded-lg transition font-medium ${
                            aspectRatio === mode
                              ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-400/40 shadow-neon-cyan'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {ASPECT_RATIO_LABELS[mode]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Botão de Ciclo Rápido de Proporção de Tela (Atalho: A) */}
            <button
              onClick={handleCycleAspectRatio}
              title={`Proporção da Imagem: ${ASPECT_RATIO_LABELS[aspectRatio]} (Atalho: A)`}
              className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-slate-300 hover:text-cyan-300 hover:bg-white/5 transition text-xs font-semibold border border-transparent hover:border-cyan-500/30"
            >
              <Crop className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline text-[10px] uppercase font-bold text-cyan-300/90">{aspectRatio}</span>
            </button>

            <button
              onClick={togglePiP}
              title="Picture-in-Picture (Janela Flutuante)"
              className="hidden xs:block text-slate-300 hover:text-cyan-300 transition p-1"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFullscreen}
              title="Tela Cheia (Atalho: F)"
              className="text-slate-300 hover:text-cyan-300 transition p-1"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mini-Guia / Gaveta Rápida de Zapping dentro do Player */}
      {showQuickDrawer && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-0 bottom-0 right-0 z-40 w-72 sm:w-80 bg-[#070d14]/95 backdrop-blur-2xl border-l border-cyan-500/40 p-3 sm:p-4 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Zapping Rápido
              </span>
            </div>
            <button
              onClick={() => setShowQuickDrawer(false)}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Fechar Guia"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Seletor de Categoria ou Todos */}
          <div className="flex items-center gap-1 my-2 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setDrawerFilter('same_group')}
              className={`flex-1 py-1 rounded transition truncate px-1 ${
                drawerFilter === 'same_group'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {channel?.group || 'Mesmo Grupo'}
            </button>
            <button
              type="button"
              onClick={() => setDrawerFilter('all')}
              className={`flex-1 py-1 rounded transition px-1 ${
                drawerFilter === 'all'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({playlistChannels?.length || 0})
            </button>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={drawerSearch}
              onChange={(e) => setDrawerSearch(e.target.value)}
              placeholder="Filtrar canais..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#0e1622] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition"
            />
          </div>

          {/* Lista de Canais para Troca Instantânea */}
          <div ref={drawerListRef} className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
            {quickDrawerChannels.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">Nenhum canal encontrado</p>
            ) : (
              quickDrawerChannels.map((c, idx) => {
                const isCurrent = c.id === channel?.id;
                const isFocused = idx === focusedDrawerIndex;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (onSelectChannel) {
                        onSelectChannel(c);
                        setShowQuickDrawer(false);
                      }
                    }}
                    className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition border ${
                      isCurrent
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-neon-cyan ring-1 ring-cyan-400/50'
                        : isFocused
                        ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-neon-cyan ring-1 ring-cyan-400'
                        : 'bg-[#0d141d] border-slate-800/80 hover:bg-slate-800/60 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center p-0.5 shrink-0">
                      {c.logo ? (
                        <img src={c.logo} alt={c.name} className="max-w-full max-h-full object-contain" />
                      ) : (
                        <Tv className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{c.group}</p>
                    </div>
                    {isCurrent && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
