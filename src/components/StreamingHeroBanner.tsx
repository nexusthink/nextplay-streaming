import React from 'react';
import { Play, Heart, Star, Sparkles, Film, Clapperboard, Radio } from 'lucide-react';
import { ChannelItem } from '../types/iptv';

interface StreamingHeroBannerProps {
  channel: ChannelItem | null;
  isFavorite: boolean;
  onPlay: (channel: ChannelItem) => void;
  onToggleFavorite: (channelId: string) => void;
}

// Higieniza nomes poluídos de IPTV (ex: "BR | GLOBO SP FHD H265 [VIP]" -> "Globo SP")
const cleanTitle = (rawName: string) => {
  if (!rawName) return '';
  return rawName
    .replace(/^(BR|US|PT|EN|ES)\s*[:||\-]\s*/i, '')
    .replace(/\[(FHD|4K|HD|SD|VIP|H265|HEVC|LEG|DUB)\]/gi, '')
    .replace(/\s+(FHD|4K|HD|SD|H265|HEVC|1080P|720P)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

export const StreamingHeroBanner: React.FC<StreamingHeroBannerProps> = ({
  channel,
  isFavorite,
  onPlay,
  onToggleFavorite,
}) => {
  if (!channel) return null;

  const bgImage = channel.backdropUrl || channel.logo;
  const displayName = cleanTitle(channel.name) || channel.name;

  return (
    <div className="relative w-full h-[360px] sm:h-[440px] md:h-[500px] lg:h-[540px] rounded-3xl overflow-hidden shadow-2xl mb-6 border border-slate-800/60 group select-none">
      {/* Imagem de Fundo / Backdrop Cinematográfico em Alta Resolução */}
      {bgImage ? (
        <img
          src={bgImage}
          alt={channel.name}
          className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-1000 filter brightness-90"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#070b10] via-[#0d1622] to-[#070b10]" />
      )}

      {/* Gradientes Múltiplos Estilo Netflix (Vignette Escura para leitura impecável) */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090d11] via-[#090d11]/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#090d11] via-[#090d11]/85 to-transparent w-full md:w-3/4" />
      <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-[#090d11]/80 to-transparent" />

      {/* Conteúdo em Destaque */}
      <div className="absolute inset-0 p-6 sm:p-10 md:p-12 flex flex-col justify-end max-w-2xl z-10">
        {/* Badges de Categoria & Especificações Técnicas Limpas */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase bg-cyan-500 text-slate-950 shadow-neon-cyan flex items-center gap-1">
            <Sparkles className="w-3 h-3 fill-slate-950" />
            {channel.mediaType === 'movie'
              ? 'FILME EM DESTAQUE'
              : channel.mediaType === 'series'
              ? 'SÉRIE POPULAR'
              : 'TRANSMISSÃO AO VIVO'}
          </span>

          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/10 text-slate-200 backdrop-blur-md border border-white/10">
            {channel.group || 'Geral'}
          </span>

          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-cyan-300 border border-cyan-400/30">
            4K ULTRA HD
          </span>

          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-slate-300 border border-white/15">
            5.1 SURROUND
          </span>

          {channel.rating && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-400/40">
              <Star className="w-3 h-3 fill-amber-400" />
              {channel.rating}
            </span>
          )}
        </div>

        {/* Título Principal */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] tracking-tight mb-3 line-clamp-1">
          {displayName}
        </h1>

        {/* Sinopse / EPG */}
        <p className="text-xs sm:text-sm text-slate-300/90 line-clamp-2 sm:line-clamp-3 mb-6 leading-relaxed font-medium drop-shadow-md max-w-xl">
          {channel.plot ||
            (channel.epgCurrent
              ? `Agora transmitindo: ${channel.epgCurrent.title} (${channel.epgCurrent.start} - ${channel.epgCurrent.end})`
              : 'Aproveite a melhor transmissão em ultra definição com som cinematográfico, cores vívidas e buffer express zero delay.')}
        </p>

        {/* Botões de Ação Netflix (Assistir Agora Branco Sólido + Minha Lista) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPlay(channel)}
            className="flex items-center gap-2.5 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-black text-sm shadow-[0_8px_25px_rgba(255,255,255,0.25)] transition-all transform hover:scale-105 active:scale-95"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            Assistir Agora
          </button>

          <button
            onClick={() => onToggleFavorite(channel.id)}
            className={`flex items-center gap-2 px-5 py-3 sm:py-3.5 rounded-xl border backdrop-blur-md text-sm font-bold transition-all ${
              isFavorite
                ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 hover:bg-rose-500/30'
                : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/20 text-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
            {isFavorite ? 'Salvo' : 'Minha Lista'}
          </button>
        </div>
      </div>
    </div>
  );
};

