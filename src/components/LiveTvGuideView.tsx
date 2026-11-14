import React, { useState, useMemo } from 'react';
import {
  Search,
  Tv,
  Heart,
  Play,
  LayoutGrid,
  List,
  Sparkles,
  Radio,
  Flame,
  Film,
  Trophy,
  Newspaper,
  Baby,
  Globe,
  Music,
  Lock,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { ChannelItem } from '../types/iptv';
import { isAdultContent } from '../services/contentFilter';

interface LiveTvGuideViewProps {
  channels: ChannelItem[];
  favorites: Set<string>;
  activeChannelId?: string;
  isParentalUnlocked: boolean;
  onRequestParentalUnlock: (channel: ChannelItem) => void;
  onSelectChannel: (channel: ChannelItem) => void;
  onToggleFavorite: (channelId: string) => void;
}

// Limpa títulos poluídos de listas IPTV (ex: "BR: GLOBO SP FHD H265" -> "Globo SP")
const sanitizeChannelTitle = (rawName: string) => {
  if (!rawName) return '';
  return rawName
    .replace(/^(BR|US|PT|EN|ES)\s*[:||\-]\s*/i, '')
    .replace(/\[(FHD|4K|HD|SD|VIP|H265|HEVC|LEG|DUB)\]/gi, '')
    .replace(/\s+(FHD|4K|HD|SD|H265|HEVC|1080P|720P)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// Extrai badge de qualidade
const extractQualityBadge = (rawName: string): string => {
  const upper = rawName.toUpperCase();
  if (upper.includes('4K') || upper.includes('UHD')) return '4K';
  if (upper.includes('FHD') || upper.includes('1080')) return 'FHD';
  if (upper.includes('HD') || upper.includes('720')) return 'HD';
  return 'LIVE';
};

interface SubFilterDef {
  id: string;
  name: string;
  filter: (c: ChannelItem) => boolean;
}

interface NetworkDef {
  id: string;
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  accentBorder: string;
  bgGradient: string;
  icon: React.ReactNode;
  filter: (c: ChannelItem) => boolean;
  subFilters?: SubFilterDef[];
}

export const LiveTvGuideView: React.FC<LiveTvGuideViewProps> = ({
  channels,
  favorites,
  activeChannelId,
  isParentalUnlocked,
  onRequestParentalUnlock,
  onSelectChannel,
  onToggleFavorite,
}) => {
  // Inicializa como null: A TELA INICIAL É A ESCOLHA DE EMISSORA
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [selectedSubFilter, setSelectedSubFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'guide'>('grid');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);

  // Intercepta canais adultos para exigir PIN se a sessão estiver bloqueada
  const handleChannelClick = (channel: ChannelItem) => {
    if (isAdultContent(channel) && !isParentalUnlocked) {
      onRequestParentalUnlock(channel);
    } else {
      onSelectChannel(channel);
    }
  };

  // Definição das Emissoras com Identidade Visual & Sub-filtros
  const networkDefinitions = useMemo<NetworkDef[]>(() => {
    return [
      {
        id: 'globo',
        name: 'Rede Globo',
        shortName: 'Globo',
        description: 'São Paulo, Rio, Minas, Regionais e Afiliadas do Brasil',
        themeColor: '#0062ff',
        accentBorder: 'hover:border-blue-500/80',
        bgGradient: 'from-blue-950/40 via-[#0a1324] to-[#070c14]',
        icon: <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.9)]" />,
        filter: (c) => {
          const t = `${c.name} ${c.group}`.toLowerCase();
          return t.includes('globo') && !t.includes('globonews') && !t.includes('gloob');
        },
        subFilters: [
          { id: 'all', name: 'Todas as Regiões', filter: () => true },
          {
            id: 'sp',
            name: 'São Paulo (SP)',
            filter: (c) => {
              const n = c.name.toUpperCase();
              return n.includes(' SP') || n.includes('SÃO PAULO') || n.includes('SAO PAULO');
            },
          },
          {
            id: 'rj',
            name: 'Rio de Janeiro (RJ)',
            filter: (c) => {
              const n = c.name.toUpperCase();
              return n.includes(' RJ') || n.includes('RIO');
            },
          },
          {
            id: 'mg',
            name: 'Minas Gerais (MG)',
            filter: (c) => {
              const n = c.name.toUpperCase();
              return n.includes(' MG') || n.includes('MINAS') || n.includes('BH') || n.includes('HORIZONTE');
            },
          },
          {
            id: 'sul',
            name: 'Região Sul (RS/SC/PR)',
            filter: (c) => {
              const n = c.name.toUpperCase();
              return (
                n.includes(' RS') ||
                n.includes(' SC') ||
                n.includes(' PR') ||
                n.includes('SUL') ||
                n.includes('CURITIBA') ||
                n.includes('PORTO ALEGRE') ||
                n.includes('RBS')
              );
            },
          },
          {
            id: 'nordeste',
            name: 'Nordeste (BA/PE/CE/outros)',
            filter: (c) => {
              const n = c.name.toUpperCase();
              return (
                n.includes(' BA') ||
                n.includes(' PE') ||
                n.includes(' CE') ||
                n.includes(' MA') ||
                n.includes(' RN') ||
                n.includes(' PB') ||
                n.includes('NORDESTE') ||
                n.includes('SALVADOR') ||
                n.includes('RECIFE') ||
                n.includes('FORTALEZA')
              );
            },
          },
          {
            id: 'co_norte',
            name: 'Centro-Oeste & Norte',
            filter: (c) => {
              const n = c.name.toUpperCase();
              return (
                n.includes(' DF') ||
                n.includes(' GO') ||
                n.includes(' MT') ||
                n.includes(' MS') ||
                n.includes('BRASILIA') ||
                n.includes('BRASÍLIA') ||
                n.includes(' AM') ||
                n.includes(' PA') ||
                n.includes('ANHANGUERA')
              );
            },
          },
          {
            id: 'alt',
            name: 'Sinais Alternativos',
            filter: (c) => {
              const n = c.name.toUpperCase();
              return n.includes('ALTERNATIVO') || n.includes('ALT');
            },
          },
        ],
      },
      {
        id: 'sbt',
        name: 'SBT',
        shortName: 'SBT',
        description: 'Programação aberta nacional, novelas, auditório e humor',
        themeColor: '#eab308',
        accentBorder: 'hover:border-yellow-400/80',
        bgGradient: 'from-amber-950/40 via-[#181206] to-[#070c14]',
        icon: <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.9)]" />,
        filter: (c) => `${c.name} ${c.group}`.toLowerCase().includes('sbt'),
      },
      {
        id: 'record',
        name: 'Record TV',
        shortName: 'Record',
        description: 'Jornalismo 24 horas, novelas bíblicas e variedades',
        themeColor: '#f43f5e',
        accentBorder: 'hover:border-rose-500/80',
        bgGradient: 'from-rose-950/40 via-[#170a0f] to-[#070c14]',
        icon: <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)]" />,
        filter: (c) => `${c.name} ${c.group}`.toLowerCase().includes('record'),
      },
      {
        id: 'band',
        name: 'Rede Bandeirantes',
        shortName: 'Band',
        description: 'Band SP, BandNews, BandSports, jornalismo e esporte',
        themeColor: '#10b981',
        accentBorder: 'hover:border-emerald-400/80',
        bgGradient: 'from-emerald-950/40 via-[#071711] to-[#070c14]',
        icon: <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />,
        filter: (c) => {
          const t = `${c.name} ${c.group}`.toLowerCase();
          return t.includes('band') || t.includes('bandeirantes');
        },
      },
      {
        id: 'sports',
        name: 'Esportes & Premiere',
        shortName: 'Esportes',
        description: 'Premiere, SporTV, ESPN, Combate, Fox Sports e CazéTV',
        themeColor: '#f59e0b',
        accentBorder: 'hover:border-amber-400/80',
        bgGradient: 'from-amber-950/40 via-[#191104] to-[#070c14]',
        icon: <Trophy className="w-4 h-4 text-amber-400" />,
        filter: (c) => {
          const t = `${c.name} ${c.group}`.toLowerCase();
          return (
            t.includes('sportv') ||
            t.includes('premiere') ||
            t.includes('espn') ||
            t.includes('esporte') ||
            t.includes('fox sport') ||
            t.includes('combate') ||
            t.includes('tnt sports') ||
            t.includes('bandsports') ||
            t.includes('caze') ||
            t.includes('cazé')
          );
        },
        subFilters: [
          { id: 'all', name: 'Todos os Esportes', filter: () => true },
          {
            id: 'premiere',
            name: 'Premiere Futebol',
            filter: (c) => c.name.toLowerCase().includes('premiere'),
          },
          {
            id: 'sportv',
            name: 'SporTV (1, 2, 3)',
            filter: (c) => c.name.toLowerCase().includes('sportv'),
          },
          {
            id: 'espn',
            name: 'ESPN',
            filter: (c) => c.name.toLowerCase().includes('espn'),
          },
          {
            id: 'combate',
            name: 'Combate & Lutas',
            filter: (c) => {
              const t = c.name.toLowerCase();
              return t.includes('combate') || t.includes('ufc') || t.includes('fight');
            },
          },
          {
            id: 'caze',
            name: 'CazéTV',
            filter: (c) => {
              const t = c.name.toLowerCase();
              return t.includes('caze') || t.includes('cazé');
            },
          },
        ],
      },
      {
        id: 'news',
        name: 'Notícias & Jornalismo',
        shortName: 'Notícias',
        description: 'GloboNews, CNN Brasil, Jovem Pan News e BandNews',
        themeColor: '#06b6d4',
        accentBorder: 'hover:border-cyan-400/80',
        bgGradient: 'from-cyan-950/40 via-[#06151c] to-[#070c14]',
        icon: <Newspaper className="w-4 h-4 text-cyan-300" />,
        filter: (c) => {
          const t = `${c.name} ${c.group}`.toLowerCase();
          return (
            t.includes('news') ||
            t.includes('noticia') ||
            t.includes('notícia') ||
            t.includes('cnn') ||
            t.includes('globonews') ||
            t.includes('jovem pan') ||
            t.includes('bandnews') ||
            t.includes('record news')
          );
        },
        subFilters: [
          { id: 'all', name: 'Todas as Notícias', filter: () => true },
          {
            id: 'globonews',
            name: 'GloboNews',
            filter: (c) => c.name.toLowerCase().includes('globonews'),
          },
          {
            id: 'cnn',
            name: 'CNN Brasil',
            filter: (c) => c.name.toLowerCase().includes('cnn'),
          },
          {
            id: 'jovempan',
            name: 'Jovem Pan News',
            filter: (c) => c.name.toLowerCase().includes('jovem pan'),
          },
          {
            id: 'bandnews',
            name: 'BandNews',
            filter: (c) => c.name.toLowerCase().includes('bandnews'),
          },
        ],
      },
      {
        id: 'movies_tv',
        name: 'Filmes & Séries na TV',
        shortName: 'Filmes TV',
        description: 'Telecine, HBO, Megapix, TNT, Space, Universal e Warner',
        themeColor: '#a855f7',
        accentBorder: 'hover:border-purple-400/80',
        bgGradient: 'from-purple-950/40 via-[#150a1f] to-[#070c14]',
        icon: <Film className="w-4 h-4 text-purple-400" />,
        filter: (c) => {
          const t = `${c.name} ${c.group}`.toLowerCase();
          return (
            t.includes('telecine') ||
            t.includes('hbo') ||
            t.includes('megapix') ||
            t.includes('space') ||
            t.includes('tnt') ||
            t.includes('warner') ||
            t.includes('universal') ||
            t.includes('paramount') ||
            t.includes('cinemax') ||
            t.includes('sony') ||
            t.includes('axn')
          );
        },
        subFilters: [
          { id: 'all', name: 'Todos os Canais de Filmes', filter: () => true },
          {
            id: 'telecine',
            name: 'Telecine',
            filter: (c) => c.name.toLowerCase().includes('telecine'),
          },
          {
            id: 'hbo',
            name: 'HBO',
            filter: (c) => c.name.toLowerCase().includes('hbo'),
          },
          {
            id: 'megapix_space',
            name: 'Megapix / Space',
            filter: (c) => {
              const t = c.name.toLowerCase();
              return t.includes('megapix') || t.includes('space');
            },
          },
          {
            id: 'warner_tnt',
            name: 'Warner / TNT',
            filter: (c) => {
              const t = c.name.toLowerCase();
              return t.includes('warner') || t.includes('tnt');
            },
          },
        ],
      },
      {
        id: 'kids',
        name: 'Infantil & Desenhos',
        shortName: 'Infantil',
        description: 'Cartoon Network, Gloob, Disney Channel, Nickelodeon',
        themeColor: '#ec4899',
        accentBorder: 'hover:border-pink-400/80',
        bgGradient: 'from-pink-950/40 via-[#1c0a15] to-[#070c14]',
        icon: <Baby className="w-4 h-4 text-pink-400" />,
        filter: (c) => {
          const t = `${c.name} ${c.group}`.toLowerCase();
          return (
            t.includes('kids') ||
            t.includes('cartoon') ||
            t.includes('disney') ||
            t.includes('nickelodeon') ||
            t.includes('gloob') ||
            t.includes('desenho') ||
            t.includes('nick jr') ||
            t.includes('toongami')
          );
        },
      },
      {
        id: 'docs',
        name: 'Documentários & Variedades',
        shortName: 'Documentários',
        description: 'Discovery, History, Nat Geo, Animal Planet, Multishow e Viva',
        themeColor: '#14b8a6',
        accentBorder: 'hover:border-teal-400/80',
        bgGradient: 'from-teal-950/40 via-[#071816] to-[#070c14]',
        icon: <Globe className="w-4 h-4 text-teal-400" />,
        filter: (c) => {
          const t = `${c.name} ${c.group}`.toLowerCase();
          return (
            t.includes('discovery') ||
            t.includes('history') ||
            t.includes('national geographic') ||
            t.includes('nat geo') ||
            t.includes('animal planet') ||
            t.includes('curta') ||
            t.includes('viva') ||
            t.includes('multishow') ||
            t.includes('gnt') ||
            t.includes('bis')
          );
        },
      },
      {
        id: 'adults',
        name: 'Adultos (+18)',
        shortName: 'Adultos',
        description: 'Conteúdo restrito com bloqueio parental por senha PIN',
        themeColor: '#f43f5e',
        accentBorder: 'hover:border-rose-500/80',
        bgGradient: 'from-rose-950/50 via-[#1c060d] to-[#070c14]',
        icon: <Lock className="w-4 h-4 text-rose-400" />,
        filter: (c) => isAdultContent(c),
      },
    ];
  }, []);

  // Extrai logotipo representativo para cada emissora da própria lista de canais
  const networkLogos = useMemo(() => {
    const logos: Record<string, string | undefined> = {};
    for (const def of networkDefinitions) {
      const match = channels.find((c) => def.filter(c) && c.logo && c.logo.trim() !== '');
      logos[def.id] = match?.logo;
    }
    return logos;
  }, [channels, networkDefinitions]);

  // Contagem de canais por emissora
  const networkCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const def of networkDefinitions) {
      counts[def.id] = channels.filter(def.filter).length;
    }
    return counts;
  }, [channels, networkDefinitions]);

  // Emissora atualmente selecionada
  const activeNetwork = useMemo(() => {
    return networkDefinitions.find((n) => n.id === selectedNetworkId) || null;
  }, [selectedNetworkId, networkDefinitions]);

  // Canais filtrados quando dentro de uma emissora ou durante busca
  const filteredChannels = useMemo(() => {
    let list = channels;

    // Se estiver em modo busca livre global (sem emissora)
    if (!selectedNetworkId && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return list.filter(
        (c) =>
          !isAdultContent(c) &&
          (c.name.toLowerCase().includes(q) ||
            c.group.toLowerCase().includes(q) ||
            (c.epgCurrent && c.epgCurrent.title.toLowerCase().includes(q)))
      );
    }

    // Se selecionou "Todas as Emissoras"
    if (selectedNetworkId === 'all') {
      list = list.filter((c) => !isAdultContent(c));
    } else if (activeNetwork) {
      list = list.filter(activeNetwork.filter);

      // Subfiltro regional ou temático (ex: Globo SP, Premiere, etc.)
      if (activeNetwork.subFilters && selectedSubFilter !== 'all') {
        const subDef = activeNetwork.subFilters.find((s) => s.id === selectedSubFilter);
        if (subDef) {
          list = list.filter(subDef.filter);
        }
      }
    }

    // Filtro apenas favoritos
    if (onlyFavorites) {
      list = list.filter((c) => favorites.has(c.id));
    }

    // Busca interna dentro da emissora
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.group.toLowerCase().includes(q) ||
          (c.epgCurrent && c.epgCurrent.title.toLowerCase().includes(q))
      );
    }

    return list;
  }, [
    channels,
    selectedNetworkId,
    activeNetwork,
    selectedSubFilter,
    onlyFavorites,
    searchQuery,
    favorites,
  ]);

  // Ao clicar em um card de emissora no Hub
  const handleSelectNetworkCard = (net: NetworkDef) => {
    // Se for canal adulto e não estiver destravado, pede PIN
    if (net.id === 'adults' && !isParentalUnlocked) {
      const sampleAdult = channels.find(net.filter) || {
        id: 'adult-preview',
        name: 'Canal Adulto Restrito',
        group: 'ADULTOS',
        url: '',
        mediaType: 'live',
      };
      onRequestParentalUnlock(sampleAdult);
      return;
    }

    setSelectedNetworkId(net.id);
    setSelectedSubFilter('all');
    setSearchQuery('');
  };

  // =========================================================================
  // CENÁRIO 1: ESCOLHA DE EMISSORA (Hub de Emissoras - Tela Inicial Limpa)
  // =========================================================================
  if (selectedNetworkId === null && !searchQuery.trim()) {
    return (
      <div className="w-full h-full flex flex-col p-4 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar select-none">
        {/* Header Elegante do Hub de Emissoras */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 shrink-0">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Guia de Transmissão ao Vivo
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>Escolha uma Emissora</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {channels.filter((c) => !isAdultContent(c)).length.toLocaleString('pt-BR')} canais disponíveis
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Selecione a rede de televisão que deseja assistir para ver a grade de canais organizada.
            </p>
          </div>

          {/* Controles do Topo: Busca Global + Favoritos + Ver Todos */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Campo de Busca Rápida */}
            <div className="relative w-56 sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar qualquer canal ou programa..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0e1622] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            {/* Ver Todos os Canais de uma vez */}
            <button
              onClick={() => setSelectedNetworkId('all')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0d141d] hover:bg-[#151f2c] border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition"
            >
              <Tv className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ver Todos ({channels.length})</span>
            </button>
          </div>
        </div>

        {/* Grade Magnífica de Cards das Emissoras */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {networkDefinitions.map((net) => {
            const count = networkCounts[net.id] || 0;
            const logo = networkLogos[net.id];

            // Se a lista IPTV do usuário não possui nenhum canal nessa categoria, esconde
            if (count === 0) return null;

            return (
              <div
                key={net.id}
                tabIndex={0}
                role="button"
                data-tv-card="true"
                onClick={() => handleSelectNetworkCard(net)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectNetworkCard(net);
                  }
                }}
                className={`group relative flex flex-col justify-between p-5 rounded-2xl border bg-gradient-to-br ${net.bgGradient} cursor-pointer transition-all duration-200 transform hover:-translate-y-1 hover:shadow-2xl overflow-hidden border-slate-800/80 ${net.accentBorder}`}
              >
                {/* Glow decorativo de fundo */}
                <div
                  className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-10 group-hover:opacity-20 blur-2xl transition-opacity pointer-events-none"
                  style={{ backgroundColor: net.themeColor }}
                />

                {/* Topo do Card: Logo da Emissora + Badge de Canais */}
                <div className="flex items-start justify-between gap-3">
                  <div className="relative w-14 h-14 rounded-2xl bg-[#080d14]/90 border border-slate-800 p-2 flex items-center justify-center shrink-0 shadow-inner group-hover:border-slate-700 transition">
                    {logo ? (
                      <img
                        src={logo}
                        alt={net.name}
                        loading="lazy"
                        className="max-w-full max-h-full object-contain filter drop-shadow group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center">{net.icon}</div>
                    )}
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900/80 text-white border border-slate-700/80 backdrop-blur-md shadow-sm">
                    {count} canais
                  </span>
                </div>

                {/* Conteúdo do Card */}
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold text-white group-hover:text-cyan-300 transition tracking-tight">
                      {net.name}
                    </h3>
                    {net.id === 'adults' && <Lock className="w-3.5 h-3.5 text-rose-400" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {net.description}
                  </p>
                </div>

                {/* Rodapé do Card com Ação */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-cyan-400 transition">
                  <span>{net.id === 'adults' ? 'Desbloquear com PIN' : 'Acessar Emissora'}</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // CENÁRIO 2: DENTRO DE UMA EMISSORA (OU RESULTADOS DE BUSCA)
  // =========================================================================
  return (
    <div className="w-full h-full flex flex-col p-4 sm:p-8 space-y-5 overflow-y-auto custom-scrollbar select-none">
      {/* 1. Barra de Navegação Superior com Botão Voltar Bem Destacado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          {/* BOTÃO VOLTAR PARA A ESCOLHA DE EMISSORA */}
          <button
            data-tv-back="true"
            onClick={() => {
              setSelectedNetworkId(null);
              setSearchQuery('');
              setSelectedSubFilter('all');
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 text-slate-200 hover:text-white text-xs font-bold transition shadow-md group"
            title="Voltar para a Escolha de Emissora"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Escolher Outra Emissora</span>
          </button>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          {/* Título da Emissora Atual */}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                <span>{activeNetwork ? activeNetwork.name : 'Todos os Canais'}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {filteredChannels.length} canais
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Controles da Emissora: Busca + Favoritos + Seletor Grade/EPG */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Busca na Emissora */}
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Buscar em ${activeNetwork ? activeNetwork.shortName : 'canais'}...`}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#0e1622] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition"
            />
          </div>

          {/* Toggle Apenas Favoritos */}
          <button
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              onlyFavorites
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-md'
                : 'bg-[#0e1622] border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>Favoritos</span>
          </button>

          {/* Seletor Grade vs Guia EPG */}
          <div className="flex items-center bg-[#0e1622] p-0.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              title="Visualização em Grade Vertical de Cards"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'grid'
                  ? 'bg-cyan-500 text-slate-950 shadow-neon-cyan'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grade</span>
            </button>
            <button
              onClick={() => setViewMode('guide')}
              title="Visualização em Guia de Programação EPG"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'guide'
                  ? 'bg-cyan-500 text-slate-950 shadow-neon-cyan'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Guia EPG</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Sub-filtros Rápidos da Emissora (Ex: Globo SP, RJ, MG, etc.) */}
      {activeNetwork?.subFilters && (
        <div className="flex items-center gap-2 overflow-x-auto py-2 custom-scrollbar shrink-0 min-h-[50px]">
          {activeNetwork.subFilters.map((sub) => {
            const isSelected = selectedSubFilter === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedSubFilter(sub.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border shrink-0 ${
                  isSelected
                    ? 'bg-white text-slate-950 border-white shadow-md'
                    : 'bg-[#0d141d] hover:bg-[#131d2a] border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {sub.name}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Se nenhum canal for encontrado nos filtros */}
      {filteredChannels.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 rounded-3xl bg-[#0b121b] border border-dashed border-slate-800 text-center my-6">
          <Tv className="w-10 h-10 text-cyan-400/50 mb-3" />
          <h3 className="text-base font-bold text-white">Nenhum canal encontrado</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Tente limpar a busca ou selecionar outra região/subcategoria.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedSubFilter('all');
              setOnlyFavorites(false);
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold hover:brightness-110 transition"
          >
            Ver Todos os Canais da Emissora
          </button>
        </div>
      )}

      {/* 4. MODO GRADE VERTICAL DE CARDS (Não estica logos, layout 100% vertical e limpo) */}
      {viewMode === 'grid' && filteredChannels.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 pb-8">
          {filteredChannels.map((channel) => {
            const isPlaying = channel.id === activeChannelId;
            const isFav = favorites.has(channel.id);
            const cleanName = sanitizeChannelTitle(channel.name);
            const quality = extractQualityBadge(channel.name);
            const epg = channel.epgCurrent;

            return (
              <div
                key={channel.id}
                tabIndex={0}
                role="button"
                data-tv-card="true"
                onClick={() => handleChannelClick(channel)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleChannelClick(channel);
                  }
                }}
                className={`group relative flex flex-col justify-between rounded-2xl p-3 bg-[#0a1017] border cursor-pointer transition-all duration-200 transform hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.8)] overflow-hidden ${
                  isPlaying
                    ? 'border-cyan-400 bg-cyan-950/20 shadow-neon-cyan'
                    : 'border-slate-800/80 hover:border-cyan-500/50 hover:bg-[#0e1622]'
                }`}
              >
                {/* Box do Logotipo Preservado */}
                <div className="relative w-full aspect-video rounded-xl bg-gradient-to-b from-[#131b26] to-[#080d13] border border-slate-800 flex items-center justify-center p-3 overflow-hidden">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={cleanName}
                      loading="lazy"
                      className="max-w-full max-h-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Tv className="w-8 h-8 text-slate-600 group-hover:text-cyan-400 transition" />
                  )}

                  {/* Badge Ao Vivo Vermelho */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-600/90 backdrop-blur-md text-[9px] font-black text-white shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span>AO VIVO</span>
                  </div>

                  {/* Badge de Qualidade */}
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-[9px] font-mono font-bold text-cyan-300 border border-slate-700">
                    {quality}
                  </div>

                  {/* Botão de Play Overlay no Hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-neon-cyan transform group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Informações do Canal */}
                <div className="mt-2.5 flex-1 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-1.5">
                    <h4
                      className="text-xs font-bold text-white group-hover:text-cyan-300 transition line-clamp-1"
                      title={channel.name}
                    >
                      {cleanName}
                    </h4>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(channel.id);
                      }}
                      className={`p-1 rounded-md transition shrink-0 ${
                        isFav
                          ? 'text-rose-500 hover:text-rose-400'
                          : 'text-slate-600 hover:text-slate-300'
                      }`}
                      title="Favoritar Canal"
                    >
                      <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500' : ''}`} />
                    </button>
                  </div>

                  {/* EPG do Programa Atual */}
                  <div className="mt-1.5 pt-1.5 border-t border-slate-800/80">
                    <p className="text-[11px] text-slate-300 font-medium line-clamp-1">
                      {epg?.title || `${cleanName} — Transmissão Principal`}
                    </p>

                    {/* Horário & Barra de Progresso */}
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>{epg?.start || 'Ao Vivo'}</span>
                      <span>{epg?.end || '24h'}</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-teal-400 rounded-full"
                        style={{ width: `${epg?.progress || 45}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. MODO GUIA DE PROGRAMAÇÃO EPG (List Guide View) */}
      {viewMode === 'guide' && filteredChannels.length > 0 && (
        <div className="rounded-2xl bg-[#0a1017] border border-slate-800/80 p-4 divide-y divide-slate-800/60 pb-8">
          {filteredChannels.map((channel, idx) => {
            const isPlaying = channel.id === activeChannelId;
            const isFav = favorites.has(channel.id);
            const cleanName = sanitizeChannelTitle(channel.name);
            const quality = extractQualityBadge(channel.name);
            const epg = channel.epgCurrent;
            const nextEpg = channel.epgNext;

            return (
              <div
                key={channel.id}
                tabIndex={0}
                role="button"
                data-tv-card="true"
                onClick={() => handleChannelClick(channel)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleChannelClick(channel);
                  }
                }}
                className={`group flex items-center justify-between py-3 px-3 rounded-xl cursor-pointer transition-all ${
                  isPlaying
                    ? 'bg-cyan-500/15 border border-cyan-400/50'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                {/* Logo, Número e Nome */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <span className="text-xs font-mono text-slate-500 w-7 text-right shrink-0">
                    {String(idx + 1).padStart(3, '0')}
                  </span>

                  <div className="relative w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 p-1 flex items-center justify-center shrink-0">
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt={cleanName}
                        loading="lazy"
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Tv className="w-5 h-5 text-slate-600" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition truncate">
                        {cleanName}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0">
                        {quality}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 truncate mt-0.5">
                      <strong className="text-white font-semibold">Agora:</strong>{' '}
                      {epg?.title || `${cleanName} — Programação Ao Vivo`}
                    </p>

                    {nextEpg && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        <span className="text-slate-400">A seguir:</span> {nextEpg.title} ({nextEpg.start})
                      </p>
                    )}
                  </div>
                </div>

                {/* Horário, Progresso & Ações */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden md:flex flex-col items-end w-32">
                    <span className="text-[11px] font-mono text-slate-400">
                      {epg?.start || 'Ao Vivo'} - {epg?.end || '24h'}
                    </span>
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded-full"
                        style={{ width: `${epg?.progress || 45}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(channel.id);
                    }}
                    className={`p-2 rounded-xl border transition ${
                      isFav
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-500 hover:text-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500' : ''}`} />
                  </button>

                  <button
                    type="button"
                    className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-neon-cyan"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-950" />
                    <span className="hidden sm:inline">Assistir</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
