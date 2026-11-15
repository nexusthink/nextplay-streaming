import React, { useMemo } from 'react';
import { ChannelItem, WatchHistoryItem } from '../types/iptv';
import { StreamingHeroBanner } from './StreamingHeroBanner';
import { StreamingRow } from './StreamingRow';
import { isAdultContent } from '../services/contentFilter';

interface NetflixCatalogViewProps {
  channels: ChannelItem[];
  history: WatchHistoryItem[];
  favorites: Set<string>;
  activeChannelId?: string;
  onSelectChannel: (channel: ChannelItem) => void;
  onToggleFavorite: (channelId: string) => void;
  selectedMediaType: 'all' | 'live' | 'movie' | 'series';
}

export const NetflixCatalogView: React.FC<NetflixCatalogViewProps> = ({
  channels,
  history,
  favorites,
  activeChannelId,
  onSelectChannel,
  onToggleFavorite,
  selectedMediaType,
}) => {
  // Filtra itens adultos da tela inicial para manter discrição e privacidade total
  const safeChannels = useMemo(() => {
    return channels.filter((c) => !isAdultContent(c));
  }, [channels]);

  // Monta um Rolo de Destaques Dinâmico intercalando Filmes e Séries (10 títulos variados)
  const featuredList = useMemo(() => {
    const vodWithImage = safeChannels.filter(
      (c) =>
        (c.mediaType === 'movie' || c.mediaType === 'series') &&
        Boolean(c.backdropUrl || c.logo)
    );
    if (vodWithImage.length === 0) return [];

    // Pontua títulos recentes (2024/2025/2026) ou com boa nota/sinopse para destacar o melhor do catálogo
    const scoreItem = (c: ChannelItem) => {
      let score = 0;
      const text = `${c.name} ${c.group || ''} ${c.year || ''}`;
      if (/2026|2025|2024|lançamento|lancamento|destaque|top/i.test(text)) score += 30;
      else if (/2023|2022|4k|uhd/i.test(text)) score += 15;
      if (c.backdropUrl) score += 20;
      if (c.plot && c.plot.length > 30) score += 15;
      const numRating = parseFloat(String(c.rating || '0').replace(',', '.'));
      if (Number.isFinite(numRating) && numRating >= 7) score += numRating * 2;
      return score;
    };

    const moviesPool = vodWithImage
      .filter((c) => c.mediaType === 'movie')
      .sort((a, b) => scoreItem(b) - scoreItem(a));
    const seriesPool = vodWithImage
      .filter((c) => c.mediaType === 'series')
      .sort((a, b) => scoreItem(b) - scoreItem(a));

    // Seleciona títulos de grupos variados intercalando 1 Filme e 1 Série
    const selected: ChannelItem[] = [];
    const usedIds = new Set<string>();
    const groupCounts = new Map<string, number>();

    const pickNextFromPool = (pool: ChannelItem[]) => {
      for (const item of pool) {
        if (usedIds.has(item.id)) continue;
        const grp = item.group || 'Geral';
        if ((groupCounts.get(grp) || 0) >= 2 && pool.length > 20) continue;
        usedIds.add(item.id);
        groupCounts.set(grp, (groupCounts.get(grp) || 0) + 1);
        selected.push(item);
        return;
      }
    };

    for (let i = 0; i < 8 && selected.length < 10; i++) {
      if (moviesPool.length > 0) pickNextFromPool(moviesPool);
      if (selected.length < 10 && seriesPool.length > 0) pickNextFromPool(seriesPool);
    }

    if (selected.length === 0) {
      return vodWithImage.slice(0, 8);
    }

    return selected;
  }, [safeChannels]);

  // Fileiras Organizadas Estilo Streaming
  const {
    vodHistory,
    recentTvChannels,
    favoriteItems,
    popularMovies,
    trendingSeries,
    groupedCategories,
  } = useMemo(() => {
    // Histórico seguro (sem adultos)
    const safeHist = history.filter((h) => !isAdultContent(h.channel));

    // Separado: No máximo os 3 ÚLTIMOS canais de TV ao vivo assistidos
    const lastTv = safeHist
      .filter((h) => h.channel.mediaType === 'live')
      .map((h) => h.channel)
      .slice(0, 3);

    // Filmes e séries em andamento (Continuar Assistindo)
    const histVod = safeHist
      .filter((h) => h.channel.mediaType !== 'live')
      .map((h) => h.channel);

    const favs = safeChannels.filter((c) => favorites.has(c.id));
    const movies = safeChannels.filter((c) => c.mediaType === 'movie').slice(0, 24);
    const series = safeChannels.filter((c) => c.mediaType === 'series').slice(0, 24);

    // Agrupa outras categorias comuns em fileiras (APENAS Filmes e Séries, TV fica no seu próprio módulo)
    const catMap = new Map<string, ChannelItem[]>();
    for (const ch of safeChannels) {
      if (!ch.group || ch.mediaType === 'live') continue;
      const list = catMap.get(ch.group) || [];
      if (list.length < 24) {
        list.push(ch);
        catMap.set(ch.group, list);
      }
    }

    // Pega as top categorias VOD com mais de 3 itens
    const topCats: Array<{ name: string; items: ChannelItem[] }> = [];
    for (const [name, items] of catMap.entries()) {
      if (items.length >= 3 && topCats.length < 10) {
        topCats.push({
          name,
          items,
        });
      }
    }

    return {
      vodHistory: histVod,
      recentTvChannels: lastTv,
      favoriteItems: favs,
      popularMovies: movies,
      trendingSeries: series,
      groupedCategories: topCats,
    };
  }, [safeChannels, history, favorites]);

  return (
    <div className="w-full h-full overflow-y-auto pr-1 pb-12 custom-scrollbar">
      {/* 1. ROLO DE DESTAQUES AUTOMÁTICO (Filmes & Séries em Rotação) */}
      {featuredList.length > 0 && (
        <StreamingHeroBanner
          items={featuredList}
          favorites={favorites}
          onPlay={onSelectChannel}
          onToggleFavorite={onToggleFavorite}
        />
      )}

      {/* 2. Fileira: Últimos Canais Assistidos (Exatamente os 3 últimos, se houver) */}
      {recentTvChannels.length > 0 && (
        <StreamingRow
          title="Últimos Canais Assistidos"
          items={recentTvChannels}
          activeChannelId={activeChannelId}
          favorites={favorites}
          onSelectChannel={onSelectChannel}
          onToggleFavorite={onToggleFavorite}
          aspect="landscape"
        />
      )}

      {/* 3. Fileira: Continuar Assistindo Filmes & Séries */}
      {vodHistory.length > 0 && (
        <StreamingRow
          title="Continuar Assistindo (Filmes e Séries)"
          items={vodHistory}
          activeChannelId={activeChannelId}
          favorites={favorites}
          onSelectChannel={onSelectChannel}
          onToggleFavorite={onToggleFavorite}
          aspect="landscape"
        />
      )}

      {/* 4. Fileira: Minha Lista / Favoritos */}
      {favoriteItems.length > 0 && (
        <StreamingRow
          title="Minha Lista"
          items={favoriteItems}
          activeChannelId={activeChannelId}
          favorites={favorites}
          onSelectChannel={onSelectChannel}
          onToggleFavorite={onToggleFavorite}
          aspect="poster"
        />
      )}

      {/* 5. Fileira: Filmes em Alta */}
      {popularMovies.length > 0 && (
        <StreamingRow
          title="Filmes Recomendados para Você"
          items={popularMovies}
          activeChannelId={activeChannelId}
          favorites={favorites}
          onSelectChannel={onSelectChannel}
          onToggleFavorite={onToggleFavorite}
          aspect="poster"
        />
      )}

      {/* 6. Fileira: Séries Populares */}
      {trendingSeries.length > 0 && (
        <StreamingRow
          title="Séries em Destaque"
          items={trendingSeries}
          activeChannelId={activeChannelId}
          favorites={favorites}
          onSelectChannel={onSelectChannel}
          onToggleFavorite={onToggleFavorite}
          aspect="poster"
        />
      )}

      {/* 7. Fileiras Automáticas de Categorias On Demand */}
      {groupedCategories.map((cat) => (
        <StreamingRow
          key={cat.name}
          title={cat.name}
          items={cat.items}
          activeChannelId={activeChannelId}
          favorites={favorites}
          onSelectChannel={onSelectChannel}
          onToggleFavorite={onToggleFavorite}
          aspect="poster"
        />
      ))}
    </div>
  );
};

