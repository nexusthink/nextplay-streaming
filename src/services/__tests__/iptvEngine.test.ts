import { describe, it, expect } from 'vitest';
import { parseM3UContent, inferMediaType } from '../m3uParser';
import { normalizeServerUrl, buildXtreamStreamUrl, extractXtreamFromM3uUrl } from '../xtreamService';
import { parseSrtOrVtt, findAlternateAudioVariant, decodeCea608Samples } from '../subtitleEngine';

describe('NextPlay IPTV Core Engine — M3U & Xtream Tests', () => {
  it('parses standard M3U8 playlists with tvg-id, tvg-logo and group-title accurately', () => {
    const sampleM3u = `#EXTM3U
#EXTINF:-1 tvg-id="espn.br" tvg-name="ESPN HD" tvg-logo="https://img.test/espn.png" group-title="Action Now",ESPN Brasil HD
http://iptv.example.com:8080/live/user123/pass123/101.m3u8
#EXTINF:-1 tvg-id="matrix.vod" group-title="Sci-Fi Zone",Matrix Resurrections 4K
http://iptv.example.com:8080/movie/user123/pass123/992.mp4
#EXTINF:-1 group-title="Séries Sci-Fi",Cyberpunk Edgerunners S01E01
http://iptv.example.com:8080/series/user123/pass123/5501.mkv`;

    const parsed = parseM3UContent(sampleM3u);
    expect(parsed).toHaveLength(3);

    expect(parsed[0].name).toBe('ESPN Brasil HD');
    expect(parsed[0].group).toBe('Action Now');
    expect(parsed[0].logo).toBe('https://img.test/espn.png');
    expect(parsed[0].mediaType).toBe('live');
    expect(parsed[0].epgCurrent).toBeDefined();

    expect(parsed[1].name).toBe('Matrix Resurrections 4K');
    expect(parsed[1].mediaType).toBe('movie');

    expect(parsed[2].name).toBe('Cyberpunk Edgerunners S01E01');
    expect(parsed[2].mediaType).toBe('series');
    expect(parsed[2].seriesName).toBe('Cyberpunk Edgerunners');
    expect(parsed[2].seasonNumber).toBe(1);
    expect(parsed[2].episodeNumber).toBe(1);
  });

  it('handles 10,000+ channels rapidly without memory spike', () => {
    const lines = ['#EXTM3U'];
    for (let i = 1; i <= 10000; i++) {
      lines.push(`#EXTINF:-1 group-title="Group ${i % 10}",Channel ${i}`);
      lines.push(`http://server.local/live/u/p/${i}.ts`);
    }
    const start = performance.now();
    const result = parseM3UContent(lines.join('\n'));
    const elapsed = performance.now() - start;

    expect(result).toHaveLength(10000);
    expect(elapsed).toBeLessThan(1500);
  });

  it('correctly normalizes Xtream Codes server URLs and builds stream URLs', () => {
    expect(normalizeServerUrl('painel.meuiptv.com:8080/')).toBe('http://painel.meuiptv.com:8080');
    expect(normalizeServerUrl('https://cdn.iptv.io///')).toBe('https://cdn.iptv.io');

    const liveUrl = buildXtreamStreamUrl('painel.meuiptv.com:8080', 'cliente01', 'senha99', 4421, 'live', 'm3u8');
    expect(liveUrl).toBe('http://painel.meuiptv.com:8080/live/cliente01/senha99/4421.m3u8');

    const vodUrl = buildXtreamStreamUrl('http://painel.meuiptv.com:8080', 'cliente01', 'senha99', 880, 'movie', 'mp4');
    expect(vodUrl).toBe('http://painel.meuiptv.com:8080/movie/cliente01/senha99/880.mp4');

    const seriesEpUrl = buildXtreamStreamUrl('http://cinemaxhub.xyz', '514694', '754197', '904758', 'series', 'mp4');
    expect(seriesEpUrl).toBe('http://cinemaxhub.xyz/series/514694/754197/904758.mp4');
  });

  it('infers media type accurately from URL and metadata', () => {
    expect(inferMediaType('http://x.com/live/u/p/1.ts', 'Esportes', 'Premiere Clubes')).toBe('live');
    expect(inferMediaType('http://x.com/movie/u/p/1.mp4', 'Lançamentos', 'Duna Parte 2')).toBe('movie');
    expect(inferMediaType('http://x.com/u/p/1.mkv', 'Geral', 'The Last of Us S01E03')).toBe('series');
    expect(inferMediaType('http://x.com/play/1234.ts', 'Netflix Filmes', 'Resgate 2')).toBe('movie');
    expect(inferMediaType('http://x.com/play/5544.ts', 'Animes', 'Naruto Shippuden 1x05')).toBe('series');
    expect(inferMediaType('http://x.com/play/9988.ts', 'Séries Globoplay', 'Os Outros T01E02')).toBe('series');
    expect(inferMediaType('http://x.com/play/7766.ts', 'Geral', 'Inception (2010)', 'movie')).toBe('movie');
  });

  it('extracts Xtream credentials from shortened /p/user/pass/m3u and /get.php links', () => {
    const shortRes = extractXtreamFromM3uUrl('http://e.cinemaxhub.xyz/p/514694/754197/m3u');
    expect(shortRes).toEqual({
      serverUrl: 'http://e.cinemaxhub.xyz',
      username: '514694',
      password: '754197',
    });

    const getPhpRes = extractXtreamFromM3uUrl(
      'http://cinemaxhub.xyz:8080/get.php?username=514694&password=754197&type=m3u_plus'
    );
    expect(getPhpRes).toEqual({
      serverUrl: 'http://cinemaxhub.xyz:8080',
      username: '514694',
      password: '754197',
    });
  });

  it('parses SRT/VTT subtitles and matches Dublado <-> Legendado [Leg] variants in catalog', () => {
    const sampleSrt = `1
00:00:02,500 --> 00:00:05,000
<i>Bem-vindo ao NextPlay Streaming Engine!</i>

2
00:00:06,000 --> 00:00:09,500
Legendas sincronizadas em tempo real.`;

    const cues = parseSrtOrVtt(sampleSrt);
    expect(cues).toHaveLength(2);
    expect(cues[0].start).toBe(2.5);
    expect(cues[0].end).toBe(5);
    expect(cues[0].text).toBe('Bem-vindo ao NextPlay Streaming Engine!');

    const dubMovie = {
      id: 'vod-1',
      name: 'Street Fighter (2026)',
      group: 'Lançamentos',
      url: 'http://cinemaxhub.xyz/movie/u/p/100.mp4',
      mediaType: 'movie' as const,
    };
    const legMovie = {
      id: 'vod-2',
      name: 'Street Fighter (2026) [Leg] [Webrip]',
      group: 'Legendados',
      url: 'http://cinemaxhub.xyz/movie/u/p/101.mp4',
      mediaType: 'movie' as const,
    };

    const match = findAlternateAudioVariant(dubMovie, [dubMovie, legMovie]);
    expect(match?.id).toBe('vod-2');

    // E o inverso também (Legendado -> Dublado)
    const reverseMatch = findAlternateAudioVariant(legMovie, [dubMovie, legMovie]);
    expect(reverseMatch?.id).toBe('vod-1');

    // E Canais Ao Vivo (BR Dublado <-> US Inglês)
    const hboBr = {
      id: 'live-hbo-br',
      name: 'HBO Plus FHD',
      group: 'HBO',
      url: 'http://cinemaxhub.xyz/live/u/p/1840.m3u8',
      mediaType: 'live' as const,
    };
    const hboUs = {
      id: 'live-hbo-us',
      name: 'US: HBO',
      group: 'Estados Unidos',
      url: 'http://cinemaxhub.xyz/live/u/p/10848.m3u8',
      mediaType: 'live' as const,
    };
    expect(findAlternateAudioVariant(hboBr, [hboBr, hboUs])?.id).toBe('live-hbo-us');
    expect(findAlternateAudioVariant(hboUs, [hboBr, hboUs])?.id).toBe('live-hbo-br');
  });

  it('decodes CEA-608 binary H.264 SEI userdata packets with Portuguese accents', () => {
    const state = { text: '', lastA: -1, lastB: -1, startPts: -1 };
    // Packet 1: "OL" (0x4f, 0x4c), "A" + extended 'Á' (0x12, 0x20 -> 0x90 = Á), "!" (0x21, 0x00)
    // Packet 2: EOC (0x14, 0x2f) at pts=12.5
    const samples = [
      {
        pts: 12.0,
        bytes: new Uint8Array([
          0x43, 0xff,
          0x04, 0x4f, 0x4c, // 'OL'
          0x04, 0x41, 0x00, // 'A'
          0x04, 0x12, 0x20, // replaces 'A' with 'Á'
        ]),
      },
      {
        pts: 12.5,
        bytes: new Uint8Array([
          0x41, 0xff,
          0x04, 0x14, 0x2f, // EOC
        ]),
      },
    ];
    const cues = decodeCea608Samples(samples, state, 12.0);
    expect(cues).toHaveLength(1);
    expect(cues[0].rawText).toBe('OLÁ');
    expect(cues[0].startTime).toBe(12.5);
  });
});

