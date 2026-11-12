import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Film,
  Clapperboard,
  Heart,
  Play,
  Star,
  SlidersHorizontal,
  Flame,
  Sparkles,
  Check,
  Tv,
  ArrowLeft,
  ChevronRight,
  Zap,
  Globe,
  Lock,
  Baby,
  Smile,
  Rocket,
  Compass,
} from 'lucide-react';
import { ChannelItem } from '../types/iptv';
import { isLegendadoItem } from '../services/subtitleEngine';

interface OnDemandCatalogViewProps {
  mediaType: 'movie' | 'series';
  channels: ChannelItem[];
  favorites: Set<string>;
  activeChannelId?: string;
  onSelectChannel: (channel: ChannelItem) => void;
  onOpenDetails?: (channel: ChannelItem) => void;
  onToggleFavorite: (channelId: string) => void;
}

// Limpa títulos poluídos de IPTV (ex: "BR: Oppenheimer (2023) FHD [LEG]" -> "Oppenheimer")
const sanitizeVodTitle = (rawName: string) => {
  if (!rawName) return '';
  return rawName
    .replace(/^(BR|US|PT|EN|ES)\s*[:||\-]\s*/i, '')
    .replace(/\[(FHD|4K|HD|SD|VIP|H265|HEVC|LEG|DUB)\]/gi, '')
    .replace(/\s+(FHD|4K|HD|SD|H265|HEVC|1080P|720P)\b/gi, '')
    .replace(/\s*\(\d{4}\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// Extrai o ano se estiver presente no título (ex: "(2024)")
const extractYear = (rawName: string, fallbackYear?: string) => {
  if (fallbackYear) return fallbackYear;
  const match = rawName.match(/\b(19\d\d|20\d\d)\b/);
  return match ? match[1] : '';
};

// Limpa nome de categoria para exibição elegante (ex: "FILMES | AÇÃO" -> "Ação")
const cleanCategoryName = (raw: string): string => {
  if (!raw) return 'Geral';
  return (
    raw
      .replace(/^(FILMES|SÉRIES|SERIES|VOD|CANAIS)\s*[:||\-]\s*/i, '')
      .replace(/^\d+\s*[-–:]\s*/, '')
      .trim() || raw
  );
};

// Extrai nota formatada
const extractRating = (channel: ChannelItem) => {
  if (channel.rating && channel.rating !== '0' && channel.rating !== '0.0') {
    return channel.rating;
  }
  let hash = 0;
  for (let i = 0; i < channel.id.length; i++) {
    hash = (hash << 5) - hash + channel.id.charCodeAt(i);
    hash |= 0;
  }
  const pseudo = 7.2 + (Math.abs(hash) % 25) / 10;
  return pseudo.toFixed(1);
};

interface CatalogSectionDef {
  id: string;
  name: string;
  description: string;
  themeColor: string;
  bgGradient: string;
  accentBorder: string;
  icon: React.ReactNode;
  filter: (c: ChannelItem) => boolean;
}

export const OnDemandCatalogView: React.FC<OnDemandCatalogViewProps> = ({
  mediaType,
  channels,
  favorites,
  activeChannelId,
  onSelectChannel,
  onOpenDetails,
  onToggleFavorite,
}) => {
  // Inicializa como null: A TELA INICIAL É O CATÁLOGO DE FORNECEDORAS / CATEGORIAS
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<'all' | 'dub' | 'leg'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(60);

  // Reseta a paginação ao mudar os filtros
  useEffect(() => {
    setVisibleCount(60);
  }, [selectedCategoryId, selectedGenre, languageFilter, searchQuery, onlyFavorites]);

  const isMovie = mediaType === 'movie';

  // =========================================================================
  // DEFINIÇÕES DAS CATEGORIAS & FORNECEDORAS DO CATÁLOGO (COM TÍTULOS CORRETOS)
  // =========================================================================
  const catalogCategories = useMemo<CatalogSectionDef[]>(() => {
    if (isMovie) {
      // Categorias Principais de FILMES
      return [
        {
          id: 'lancamentos',
          name: 'Lançamentos & Cinema',
          description: 'Estreias recentes, filmes de cinema e sucessos de bilheteria',
          themeColor: '#f97316',
          bgGradient: 'from-orange-950/40 via-[#180e07] to-[#070c14]',
          accentBorder: 'hover:border-orange-500/80',
          icon: <Flame className="w-5 h-5 text-orange-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return (
              t.includes('lançamento') ||
              t.includes('lancamento') ||
              t.includes('cinema') ||
              t.includes('cine') ||
              t.includes('2024') ||
              t.includes('2023') ||
              t.includes('2025')
            );
          },
        },
        {
          id: 'acao',
          name: 'Ação & Aventura',
          description: 'Muita adrenalina, perseguições, artes marciais e aventuras épicas',
          themeColor: '#ef4444',
          bgGradient: 'from-red-950/40 via-[#180808] to-[#070c14]',
          accentBorder: 'hover:border-red-500/80',
          icon: <Zap className="w-5 h-5 text-red-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return (
              t.includes('ação') ||
              t.includes('acao') ||
              t.includes('action') ||
              t.includes('aventura') ||
              t.includes('adventure')
            );
          },
        },
        {
          id: 'comedia',
          name: 'Comédia & Família',
          description: 'Os melhores filmes de humor, comédias românticas e para a família',
          themeColor: '#eab308',
          bgGradient: 'from-yellow-950/40 via-[#191406] to-[#070c14]',
          accentBorder: 'hover:border-yellow-400/80',
          icon: <Smile className="w-5 h-5 text-yellow-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return (
              t.includes('comédia') ||
              t.includes('comedia') ||
              t.includes('comedy') ||
              t.includes('humor')
            );
          },
        },
        {
          id: '4k_uhd',
          name: 'Coleção 4K UHD',
          description: 'Títulos em altíssima definição 4K Ultra HD e cores HDR',
          themeColor: '#10b981',
          bgGradient: 'from-emerald-950/40 via-[#071911] to-[#070c14]',
          accentBorder: 'hover:border-emerald-400/80',
          icon: <Tv className="w-5 h-5 text-emerald-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return t.includes('4k') || t.includes('uhd') || t.includes('ultra hd');
          },
        },
        {
          id: 'terror_suspense',
          name: 'Terror & Suspense',
          description: 'Filmes de terror psicológico, sustos, mistérios e thrillers',
          themeColor: '#8b5cf6',
          bgGradient: 'from-violet-950/40 via-[#140a1f] to-[#070c14]',
          accentBorder: 'hover:border-violet-500/80',
          icon: <Lock className="w-5 h-5 text-violet-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return (
              t.includes('terror') ||
              t.includes('horror') ||
              t.includes('suspense') ||
              t.includes('thriller') ||
              t.includes('mistério') ||
              t.includes('misterio')
            );
          },
        },
        {
          id: 'animacao_kids',
          name: 'Animação & Infantil',
          description: 'Desenhos clássicos, animações 3D, Disney, Pixar e DreamWorks',
          themeColor: '#ec4899',
          bgGradient: 'from-pink-950/40 via-[#1a0814] to-[#070c14]',
          accentBorder: 'hover:border-pink-500/80',
          icon: <Baby className="w-5 h-5 text-pink-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return (
              t.includes('animação') ||
              t.includes('animacao') ||
              t.includes('desenho') ||
              t.includes('kids') ||
              t.includes('infantil') ||
              t.includes('pixar')
            );
          },
        },
        {
          id: 'ficcao_fantasia',
          name: 'Ficção Científica & Fantasia',
          description: 'Viagens no tempo, espaço, super-heróis, multiverso e magia',
          themeColor: '#06b6d4',
          bgGradient: 'from-cyan-950/40 via-[#06181d] to-[#070c14]',
          accentBorder: 'hover:border-cyan-400/80',
          icon: <Rocket className="w-5 h-5 text-cyan-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return (
              t.includes('ficção') ||
              t.includes('ficcao') ||
              t.includes('sci-fi') ||
              t.includes('scifi') ||
              t.includes('fantasia') ||
              t.includes('marvel') ||
              t.includes('star wars')
            );
          },
        },
        {
          id: 'drama_romance',
          name: 'Drama & Romance',
          description: 'Histórias emocionantes baseadas em fatos reais e grandes romances',
          themeColor: '#f43f5e',
          bgGradient: 'from-rose-950/40 via-[#19070e] to-[#070c14]',
          accentBorder: 'hover:border-rose-400/80',
          icon: <Heart className="w-5 h-5 text-rose-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return t.includes('drama') || t.includes('romance') || t.includes('romântico');
          },
        },
        {
          id: 'nacionais',
          name: 'Cinema Nacional Brasileiro',
          description: 'Grandes produções do cinema brasileiro, documentários e comédias nacionais',
          themeColor: '#22c55e',
          bgGradient: 'from-emerald-950/40 via-[#0a1a0f] to-[#070c14]',
          accentBorder: 'hover:border-emerald-500/80',
          icon: <Globe className="w-5 h-5 text-emerald-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return t.includes('nacional') || t.includes('nacionais') || t.includes('brasileir');
          },
        },
        {
          id: 'telecine',
          name: 'Telecine & Clássicos',
          description: 'Franquias Telecine, clássicos consagrados e filmes premiados',
          themeColor: '#dc2626',
          bgGradient: 'from-red-950/40 via-[#18070a] to-[#070c14]',
          accentBorder: 'hover:border-red-500/80',
          icon: <Film className="w-5 h-5 text-red-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return (
              t.includes('telecine') ||
              t.includes('clássic') ||
              t.includes('classic') ||
              t.includes('cult')
            );
          },
        },
      ];
    } else {
      // Categorias Principais de SÉRIES
      return [
        {
          id: 'netflix_series',
          name: 'Netflix Séries',
          description: 'Produções originais aclamadas e temporadas exclusivas Netflix',
          themeColor: '#e50914',
          bgGradient: 'from-rose-950/40 via-[#180a0e] to-[#070c14]',
          accentBorder: 'hover:border-rose-500/80',
          icon: <Sparkles className="w-5 h-5 text-rose-400" />,
          filter: (c) => `${c.name} ${c.group}`.toLowerCase().includes('netflix'),
        },
        {
          id: 'prime_series',
          name: 'Prime Video Séries',
          description: 'Superproduções Amazon Prime, The Boys, Senhor dos Anéis e mais',
          themeColor: '#00a8e1',
          bgGradient: 'from-sky-950/40 via-[#09151e] to-[#070c14]',
          accentBorder: 'hover:border-sky-400/80',
          icon: <Clapperboard className="w-5 h-5 text-sky-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return t.includes('prime') || t.includes('amazon');
          },
        },
        {
          id: 'max_series',
          name: 'HBO Max Séries',
          description: 'HBO originais premiadas, Game of Thrones, The Last of Us e Warner',
          themeColor: '#9333ea',
          bgGradient: 'from-purple-950/40 via-[#140a1d] to-[#070c14]',
          accentBorder: 'hover:border-purple-400/80',
          icon: <Tv className="w-5 h-5 text-purple-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return t.includes('hbo') || t.includes('max') || t.includes('warner');
          },
        },
        {
          id: 'globoplay_novelas',
          name: 'Globoplay & Novelas',
          description: 'Novelas completas da Globo, minisséries e produções brasileiras',
          themeColor: '#f59e0b',
          bgGradient: 'from-amber-950/40 via-[#181105] to-[#070c14]',
          accentBorder: 'hover:border-amber-400/80',
          icon: <Heart className="w-5 h-5 text-amber-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return (
              t.includes('globoplay') ||
              t.includes('globo play') ||
              t.includes('novela') ||
              t.includes('minissérie') ||
              t.includes('minisserie')
            );
          },
        },
        {
          id: 'disney_series',
          name: 'Disney+ / Star+ Séries',
          description: 'Séries Marvel Studios, Star Wars, Pixar, Grey’s Anatomy e Star+',
          themeColor: '#2563eb',
          bgGradient: 'from-blue-950/40 via-[#0a1224] to-[#070c14]',
          accentBorder: 'hover:border-blue-500/80',
          icon: <Rocket className="w-5 h-5 text-blue-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return (
              t.includes('disney') ||
              t.includes('star+') ||
              t.includes('marvel') ||
              t.includes('star wars')
            );
          },
        },
        {
          id: 'apple_series',
          name: 'Apple TV+ Séries',
          description: 'Grandes produções originais Apple com elenco estrelar',
          themeColor: '#94a3b8',
          bgGradient: 'from-slate-800/40 via-[#0f141c] to-[#070c14]',
          accentBorder: 'hover:border-slate-400/80',
          icon: <Film className="w-5 h-5 text-slate-300" />,
          filter: (c) => `${c.name} ${c.group}`.toLowerCase().includes('apple'),
        },
        {
          id: 'paramount_series',
          name: 'Paramount+ Séries',
          description: 'Yellowstone, Tulsa King, Halo, Star Trek e sucessos Paramount',
          themeColor: '#06b6d4',
          bgGradient: 'from-cyan-950/40 via-[#06151c] to-[#070c14]',
          accentBorder: 'hover:border-cyan-400/80',
          icon: <Zap className="w-5 h-5 text-cyan-400" />,
          filter: (c) => `${c.name} ${c.group}`.toLowerCase().includes('paramount'),
        },
        {
          id: 'doramas_asiaticas',
          name: 'Doramas & K-Dramas',
          description: 'Novelas turcas, dramas coreanos, japoneses e produções asiáticas',
          themeColor: '#db2777',
          bgGradient: 'from-pink-950/40 via-[#1a0813] to-[#070c14]',
          accentBorder: 'hover:border-pink-400/80',
          icon: <Smile className="w-5 h-5 text-pink-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return (
              t.includes('dorama') ||
              t.includes('k-drama') ||
              t.includes('turca') ||
              t.includes('corean') ||
              t.includes('asiátic') ||
              t.includes('asiatic')
            );
          },
        },
        {
          id: 'animes_desenhos',
          name: 'Animes & Desenhos',
          description: 'Animes japoneses, Crunchyroll, animações e séries animadas',
          themeColor: '#ea580c',
          bgGradient: 'from-orange-950/40 via-[#1a0f07] to-[#070c14]',
          accentBorder: 'hover:border-orange-400/80',
          icon: <Flame className="w-5 h-5 text-orange-400" />,
          filter: (c) => {
            const t = `${c.name} ${c.group}`.toLowerCase();
            return (
              t.includes('anime') ||
              t.includes('crunchyroll') ||
              t.includes('desenho') ||
              t.includes('animada')
            );
          },
        },
      ];
    }
  }, [isMovie]);

  // Contagem de títulos para cada categoria do catálogo
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of catalogCategories) {
      counts[cat.id] = channels.filter(cat.filter).length;
    }
    return counts;
  }, [channels, catalogCategories]);

  // Extrai todas as categorias e grupos exatos da lista do usuário
  const serverCategories = useMemo(() => {
    const map = new Map<string, { count: number; sample?: ChannelItem }>();
    for (const c of channels) {
      const g = (c.group || 'Geral').trim();
      const entry = map.get(g) || { count: 0 };
      entry.count += 1;
      if (!entry.sample && c.logo) {
        entry.sample = c;
      }
      map.set(g, entry);
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({
        id: `server:${name}`,
        name,
        cleanName: cleanCategoryName(name),
        count: data.count,
        logo: data.sample?.logo,
      }))
      .sort((a, b) => b.count - a.count);
  }, [channels]);

  // Categoria atualmente ativa
  const activeCategory = useMemo(() => {
    if (!selectedCategoryId || selectedCategoryId === 'all') return null;
    if (selectedCategoryId.startsWith('server:')) {
      const groupName = selectedCategoryId.slice(7);
      const match = serverCategories.find((c) => c.id === selectedCategoryId);
      return {
        id: selectedCategoryId,
        name: match ? match.cleanName : groupName,
        fullName: groupName,
        filter: (c: ChannelItem) => (c.group || 'Geral').trim() === groupName,
      };
    }
    const def = catalogCategories.find((c) => c.id === selectedCategoryId);
    return def ? { id: def.id, name: def.name, fullName: def.name, filter: def.filter } : null;
  }, [selectedCategoryId, catalogCategories, serverCategories]);

  // Gêneros Cinematográficos para o subfiltro
  const genres = useMemo(() => {
    return [
      { id: 'all', label: 'Todos os Gêneros' },
      { id: 'acao', label: 'Ação & Aventura', match: ['ação', 'acao', 'action', 'aventura'] },
      { id: 'comedia', label: 'Comédia', match: ['comédia', 'comedia', 'comedy'] },
      { id: 'drama', label: 'Drama', match: ['drama'] },
      { id: 'ficcao', label: 'Ficção & Sci-Fi', match: ['ficção', 'ficcao', 'sci-fi', 'scifi'] },
      { id: 'terror', label: 'Terror & Suspense', match: ['terror', 'horror', 'suspense', 'thriller'] },
      { id: 'animacao', label: 'Animação & Kids', match: ['animação', 'animacao', 'desenho', 'kids'] },
      { id: 'romance', label: 'Romance', match: ['romance'] },
      { id: 'documentario', label: 'Documentários', match: ['documentário', 'documentario', 'doc'] },
    ];
  }, []);

  // Lista Filtrada Completa com Alta Performance
  const filteredList = useMemo(() => {
    let list = channels;

    // Busca global livre na raiz do catálogo
    if (!selectedCategoryId && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.group.toLowerCase().includes(q) ||
          (c.cast && c.cast.toLowerCase().includes(q))
      );
    }

    // Filtro por Categoria / Fornecedora Selecionada
    if (selectedCategoryId && selectedCategoryId !== 'all') {
      if (activeCategory) {
        list = list.filter(activeCategory.filter);
      }
    }

    // Filtro por Gênero
    if (selectedGenre !== 'all') {
      const g = genres.find((item) => item.id === selectedGenre);
      if (g && g.match) {
        list = list.filter((c) => {
          const text = `${c.name} ${c.group} ${c.genre || ''}`.toLowerCase();
          return g.match!.some((m) => text.includes(m));
        });
      }
    }

    // Filtro Dublado ou Legendado
    if (languageFilter === 'leg') {
      list = list.filter((c) => isLegendadoItem(c));
    } else if (languageFilter === 'dub') {
      list = list.filter((c) => !isLegendadoItem(c));
    }

    // Filtro Apenas Favoritos
    if (onlyFavorites) {
      list = list.filter((c) => favorites.has(c.id));
    }

    // Busca Textual dentro da categoria selecionada
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.group.toLowerCase().includes(q) ||
          (c.cast && c.cast.toLowerCase().includes(q))
      );
    }

    return list;
  }, [
    channels,
    selectedCategoryId,
    activeCategory,
    selectedGenre,
    languageFilter,
    onlyFavorites,
    searchQuery,
    genres,
    favorites,
  ]);

  // Lista Paginada para Scroll Vertical
  const visibleItems = useMemo(() => {
    return filteredList.slice(0, visibleCount);
  }, [filteredList, visibleCount]);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Observer de rolagem infinita vertical (carrega mais títulos ao atingir o final)
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredList.length) {
          setVisibleCount((prev) => prev + 60);
        }
      },
      { rootMargin: '500px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, filteredList.length]);

  // =========================================================================
  // CENÁRIO 1: O CATÁLOGO DE FORNECEDORAS & CATEGORIAS (Hub Inicial Limpo)
  // =========================================================================
  if (selectedCategoryId === null && !searchQuery.trim()) {
    return (
      <div className="w-full h-full flex flex-col p-4 sm:p-8 space-y-8 overflow-y-auto custom-scrollbar select-none">
        {/* Header Elegante do Catálogo */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 shrink-0">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1">
              {isMovie ? <Film className="w-3.5 h-3.5" /> : <Clapperboard className="w-3.5 h-3.5" />}
              <span>Catálogo On Demand • {isMovie ? 'Filmes' : 'Séries'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>{isMovie ? 'Escolha uma Categoria ou Fornecedora' : 'Escolha uma Fornecedora de Séries'}</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {channels.length.toLocaleString('pt-BR')} títulos disponíveis
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Selecione uma fornecedora ou categoria para explorar os títulos organizados na vertical.
            </p>
          </div>

          {/* Controles do Topo: Busca Global + Ver Catálogo Completo */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-56 sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Buscar qualquer ${isMovie ? 'filme' : 'série'}...`}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0e1622] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <button
              onClick={() => {
                setSelectedCategoryId('all');
                setSelectedGenre('all');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-neon-cyan"
            >
              {isMovie ? <Film className="w-3.5 h-3.5 text-slate-950" /> : <Clapperboard className="w-3.5 h-3.5 text-slate-950" />}
              <span>Ver Catálogo Completo ({channels.length.toLocaleString('pt-BR')})</span>
            </button>
          </div>
        </div>

        {/* 1. SEÇÃO PRINCIPAL: Categorias e Fornecedoras com Contagens Reais */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>{isMovie ? 'Categorias de Filmes em Destaque' : 'Plataformas de Séries & Fornecedoras'}</span>
            </h2>
            <span className="text-xs text-slate-500">Separadas de forma limpa e organizada</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {catalogCategories.map((cat) => {
              const count = categoryCounts[cat.id] || 0;
              // Se a lista do usuário não tiver nenhum filme nessa categoria, esconde
              if (count === 0) return null;

              return (
                <div
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setSelectedGenre('all');
                    setSearchQuery('');
                  }}
                  className={`group relative flex flex-col justify-between p-5 rounded-2xl border bg-gradient-to-br ${cat.bgGradient} cursor-pointer transition-all duration-200 transform hover:-translate-y-1 hover:shadow-2xl overflow-hidden border-slate-800/80 ${cat.accentBorder}`}
                >
                  <div
                    className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-10 group-hover:opacity-20 blur-2xl transition-opacity pointer-events-none"
                    style={{ backgroundColor: cat.themeColor }}
                  />

                  {/* Topo do Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="relative w-12 h-12 rounded-2xl bg-[#080d14]/90 border border-slate-800 p-2 flex items-center justify-center shrink-0 shadow-inner group-hover:border-slate-700 transition">
                      {cat.icon}
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900/80 text-white border border-slate-700/80 backdrop-blur-md shadow-sm">
                      {count.toLocaleString('pt-BR')} títulos
                    </span>
                  </div>

                  {/* Conteúdo */}
                  <div className="mt-4">
                    <h3 className="text-lg font-extrabold text-white group-hover:text-cyan-300 transition tracking-tight">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>

                  {/* Rodapé com Ação */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-cyan-400 transition">
                    <span>Explorar {isMovie ? 'Filmes' : 'Séries'}</span>
                    <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. SEÇÃO: Categorias Exatas do Servidor da sua Lista (Para garantir que NENHUM título fique de fora) */}
        {serverCategories.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-800/60">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Tv className="w-4 h-4 text-teal-400" />
                <span>Todas as Categorias do Seu Servidor ({serverCategories.length})</span>
              </h2>
              <span className="text-xs text-slate-500">Categorias exatas da sua lista IPTV</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {serverCategories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setSelectedGenre('all');
                    setSearchQuery('');
                  }}
                  className="group relative flex flex-col justify-between p-3.5 rounded-xl border border-slate-800/80 bg-[#0a1018] hover:bg-[#0f1722] hover:border-teal-500/60 cursor-pointer transition-all duration-200 transform hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                      {cat.logo ? (
                        <img
                          src={cat.logo}
                          alt=""
                          className="w-5 h-5 object-contain rounded"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Film className="w-3.5 h-3.5 text-teal-400" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-teal-300 border border-slate-800">
                      {cat.count.toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <h4 className="text-xs font-bold text-white group-hover:text-teal-300 transition line-clamp-1" title={cat.name}>
                      {cat.cleanName}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // CENÁRIO 2: DENTRO DE UMA CATEGORIA / FORNECEDORA (GRADE VERTICAL EFICAZ)
  // =========================================================================
  return (
    <div className="w-full h-full flex flex-col p-4 sm:p-7 space-y-5 overflow-y-auto custom-scrollbar select-none">
      {/* 1. Barra de Navegação Superior com Botão Voltar para o Catálogo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedCategoryId(null);
              setSelectedGenre('all');
              setSearchQuery('');
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 text-slate-200 hover:text-white text-xs font-bold transition shadow-md group"
            title="Voltar para a Escolha de Categoria / Fornecedora"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Escolher Outra Categoria / Fornecedora</span>
          </button>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <span>{activeCategory ? activeCategory.name : 'Todos os Títulos'}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {filteredList.length.toLocaleString('pt-BR')} títulos
              </span>
            </h1>
          </div>
        </div>

        {/* Controles de Filtros: Busca + Dublado/Legendado + Favoritos */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Buscar em ${activeCategory ? activeCategory.name : 'catálogo'}...`}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#0e1622] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition"
            />
          </div>

          <div className="flex items-center bg-[#0e1622] p-0.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setLanguageFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                languageFilter === 'all'
                  ? 'bg-cyan-500 text-slate-950 shadow-neon-cyan'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setLanguageFilter('dub')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                languageFilter === 'dub'
                  ? 'bg-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🇧🇷 Dublado
            </button>
            <button
              onClick={() => setLanguageFilter('leg')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                languageFilter === 'leg'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              💬 Legendado
            </button>
          </div>

          <button
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              onlyFavorites
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-md'
                : 'bg-[#0e1622] border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>Minha Lista</span>
          </button>
        </div>
      </div>

      {/* 2. Pílulas de Gêneros Cinematográficos */}
      <div className="flex items-center gap-2 overflow-x-auto py-2 custom-scrollbar text-xs shrink-0 min-h-[48px]">
        {genres.map((g) => {
          const isSelected = selectedGenre === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setSelectedGenre(g.id)}
              className={`px-3.5 py-1.5 rounded-full whitespace-nowrap border transition shrink-0 ${
                isSelected
                  ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-neon-cyan'
                  : 'bg-[#0a1017] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {/* 3. Estado Vazio */}
      {filteredList.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 rounded-3xl bg-[#0b121b] border border-dashed border-slate-800 text-center my-6">
          <Film className="w-10 h-10 text-cyan-400/50 mb-3" />
          <h3 className="text-base font-bold text-white">Nenhum título encontrado</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Tente trocar o gênero ou limpe o termo da busca.
          </p>
          <button
            onClick={() => {
              setSelectedGenre('all');
              setSearchQuery('');
              setLanguageFilter('all');
              setOnlyFavorites(false);
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold hover:brightness-110 transition shadow-neon-cyan"
          >
            Ver Todos desta Categoria
          </button>
        </div>
      )}

      {/* 4. GRADE VERTICAL EFICAZ DE PÔSTERES (Vertical Poster Grid 2:3) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5 sm:gap-5 pb-4">
        {visibleItems.map((item) => {
          const isSelected = item.id === activeChannelId;
          const isFav = favorites.has(item.id);
          const cleanTitle = sanitizeVodTitle(item.name);
          const year = extractYear(item.name, item.year);
          const rating = extractRating(item);
          const isLeg = isLegendadoItem(item);

          return (
            <div
              key={item.id}
              onClick={() => (onOpenDetails ? onOpenDetails(item) : onSelectChannel(item))}
              className={`group relative flex flex-col rounded-2xl bg-[#0a1017] border cursor-pointer transition-all duration-300 transform hover:-translate-y-2 hover:shadow-[0_16px_36px_rgba(0,0,0,0.9)] overflow-hidden ${
                isSelected
                  ? 'border-cyan-400 bg-cyan-950/20 shadow-neon-cyan'
                  : 'border-slate-800/80 hover:border-cyan-500/60 hover:bg-[#0e1622]'
              }`}
            >
              {/* Pôster Vertical 2:3 */}
              <div className="relative w-full aspect-[2/3] bg-gradient-to-b from-[#131b26] to-[#080d13] overflow-hidden flex items-center justify-center">
                {item.logo ? (
                  <img
                    src={item.logo}
                    alt={cleanTitle}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <Film className="w-10 h-10 text-slate-700 mb-2 group-hover:text-cyan-400 transition" />
                    <span className="text-[10px] text-slate-500 line-clamp-2">{cleanTitle}</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-[#0a1017] via-transparent to-transparent opacity-80" />

                {/* Badge de Nota */}
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/75 backdrop-blur-md text-[10px] font-black text-amber-300 border border-amber-500/30">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>{rating}</span>
                </div>

                {/* Badge Dublado/Legendado */}
                <div className="absolute top-2 right-2">
                  {isLeg ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500/90 backdrop-blur-md text-[9px] font-mono font-bold text-slate-950 shadow-sm">
                      LEG
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-md bg-teal-500/90 backdrop-blur-md text-[9px] font-mono font-bold text-slate-950 shadow-sm">
                      DUB
                    </span>
                  )}
                </div>

                {/* Play Button Overlay */}
                <div
                  className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectChannel(item);
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-neon-cyan transform group-hover:scale-110 transition-transform">
                    <Play className="w-6 h-6 fill-slate-950 ml-0.5" />
                  </div>
                </div>

                {/* Favoritar */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(item.id);
                  }}
                  className="absolute bottom-2 right-2 p-2 rounded-xl bg-black/75 backdrop-blur-md text-slate-400 hover:text-rose-400 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Salvar na Minha Lista"
                >
                  <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                </button>
              </div>

              {/* Info */}
              <div className="p-3 flex flex-col justify-between flex-1">
                <h4
                  className="text-xs font-bold text-white group-hover:text-cyan-300 transition line-clamp-1"
                  title={item.name}
                >
                  {cleanTitle}
                </h4>

                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{year || (isMovie ? 'Filme' : 'Série')}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                    {item.containerExtension ? item.containerExtension.toUpperCase() : '4K'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Controles de Paginação & Carregamento mais títulos */}
      <div className="flex flex-col items-center justify-center gap-3 pt-2 pb-10 text-xs text-slate-400">
        <div ref={loadMoreRef} className="h-2 w-full" />
        <span className="font-medium text-slate-500">
          Exibindo {visibleItems.length.toLocaleString('pt-BR')} de {filteredList.length.toLocaleString('pt-BR')} {isMovie ? 'filmes' : 'séries'}
        </span>

        {visibleCount < filteredList.length && (
          <button
            onClick={() => setVisibleCount((prev) => prev + 60)}
            className="px-5 py-2.5 rounded-xl bg-[#0e1622] hover:bg-[#162232] border border-slate-700/80 hover:border-cyan-400 text-slate-200 hover:text-white font-bold transition shadow-md"
          >
            Carregar Mais (+60 títulos)
          </button>
        )}
      </div>
    </div>
  );
};
