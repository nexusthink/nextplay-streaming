import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface NextPlayIntroAnimationProps {
  onFinish: () => void;
}

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const easeOutExpo = (x: number) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

// Sintetizador de Áudio de Entrada Cinematográfico Autoral NextPlay (Web Audio API 100% nativa com Master Limiter)
const playNextPlayIntroAudio = (): AudioContext | null => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();

    const t = ctx.currentTime;

    // Master Compressor / Limiter para máxima clareza, pegada e volume sem distorção
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, t);
    compressor.knee.setValueAtTime(24, t);
    compressor.ratio.setValueAtTime(6, t);
    compressor.attack.setValueAtTime(0.003, t);
    compressor.release.setValueAtTime(0.25, t);

    // Master Output Gain com presença encorpada (1.0 = volume cheio)
    const masterOut = ctx.createGain();
    masterOut.gain.setValueAtTime(1.0, t);
    compressor.connect(masterOut);
    masterOut.connect(ctx.destination);

    // 1. IMPACTO CINEMATOGRÁFICO DUPLO (Estilo Ta-Dum / Boom com harmônicos audíveis em TVs e notebooks)
    const playBassImpact = (time: number, startFreq: number, endFreq: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle'; // triangle traz corpo e harmônicos quentes
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.9);
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 1.6);
      osc.connect(gain);
      gain.connect(compressor);
      osc.start(time);
      osc.stop(time + 1.8);
    };

    // Primeiro impacto seco (t) + Segundo impacto pesado com reverberação (t + 0.28s)
    playBassImpact(t, 140, 48, 0.9);
    playBassImpact(t + 0.28, 120, 34, 1.0);

    // 2. SWELL DE SINTETIZADOR CINEMATOGRÁFICO (Acorde Cmaj9 Expansivo)
    const freqs = [130.81, 196.0, 261.63, 329.63, 392.0, 493.88]; // C3, G3, C4, E4, G4, B4
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, t);
    filter.frequency.exponentialRampToValueAtTime(5200, t + 1.4);
    filter.frequency.exponentialRampToValueAtTime(1200, t + 3.1);

    const chordGain = ctx.createGain();
    chordGain.gain.setValueAtTime(0.05, t);
    chordGain.gain.linearRampToValueAtTime(0.85, t + 0.85);
    chordGain.gain.setValueAtTime(0.85, t + 1.8);
    chordGain.gain.exponentialRampToValueAtTime(0.001, t + 3.4);

    filter.connect(chordGain);
    chordGain.connect(compressor);

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime((idx - 2.5) * 8, t); // Chorus estéreo analógico
      oscGain.gain.setValueAtTime(0.32, t);
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start(t + idx * 0.03);
      osc.stop(t + 3.5);
    });

    // 3. BRILHO DE CRISTAL / CHIME DE CLÍMAX (ao abrir os prismas)
    const chimes = [
      { delay: 0.85, freq: 1046.5, vol: 0.45 }, // C6
      { delay: 1.25, freq: 1567.98, vol: 0.45 }, // G6
      { delay: 1.65, freq: 2093.0, vol: 0.5 },  // C7
    ];
    chimes.forEach(({ delay, freq, vol }) => {
      const cOsc = ctx.createOscillator();
      const cGain = ctx.createGain();
      cOsc.type = 'sine';
      cOsc.frequency.setValueAtTime(freq, t + delay);
      cGain.gain.setValueAtTime(vol, t + delay);
      cGain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 1.4);
      cOsc.connect(cGain);
      cGain.connect(compressor);
      cOsc.start(t + delay);
      cOsc.stop(t + delay + 1.5);
    });

    return ctx;
  } catch (err) {
    console.warn('Áudio de entrada:', err);
    return null;
  }
};

export const NextPlayIntroAnimation: React.FC<NextPlayIntroAnimationProps> = ({ onFinish }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [exiting, setExiting] = useState(false);
  const [bootStage, setBootStage] = useState(0);
  const [audioMuted, setAudioMuted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    // Partículas do túnel de streaming NextPlay
    const stars = Array.from({ length: 90 }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: Math.random(),
      color: Math.random() > 0.3 ? '#00f2fe' : '#10b981',
    }));

    const startTime = performance.now();
    const totalMs = 3400;
    let rafId = 0;
    let done = false;

    const triggerFinish = () => {
      if (done) return;
      done = true;
      setExiting(true);
      window.setTimeout(onFinish, 420);
    };

    const t1 = window.setTimeout(() => setBootStage(1), 600);
    const t2 = window.setTimeout(() => setBootStage(2), 1400);
    const t3 = window.setTimeout(() => setBootStage(3), 2200);

    // Inicia o Áudio de Entrada Cinematográfico Autoral
    const audioCtx = playNextPlayIntroAudio();
    audioCtxRef.current = audioCtx;

    // Se o navegador suspendeu por política de autoplay antes de interação,
    // retoma imediatamente no primeiro toque/clique ou tecla
    if (audioCtx && audioCtx.state === 'suspended') {
      const resumeAudio = () => {
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        window.removeEventListener('pointerdown', resumeAudio);
        window.removeEventListener('keydown', resumeAudio);
      };
      window.addEventListener('pointerdown', resumeAudio, { once: true });
      window.addEventListener('keydown', resumeAudio, { once: true });
    }

    const render = (now: number) => {
      const elapsed = now - startTime;
      const progress = clamp(elapsed / totalMs);
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.fillStyle = '#05080c';
      ctx.fillRect(0, 0, w, h);

      // 1. Grade de Horizonte Cyberpunk em Perspectiva 3D
      const horizonY = cy + 90 * dpr;
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.12)';
      ctx.lineWidth = 1 * dpr;

      const numVertical = 18;
      for (let i = -numVertical; i <= numVertical; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 28 * dpr, horizonY);
        ctx.lineTo(cx + i * 190 * dpr, h);
        ctx.stroke();
      }

      const speedOffset = (elapsed * 0.04) % 1;
      for (let j = 0; j < 10; j++) {
        const p = (j + speedOffset) / 10;
        const y = horizonY + Math.pow(p, 2.3) * (h - horizonY);
        ctx.strokeStyle = `rgba(0, 242, 254, ${p * 0.22})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Partículas Warp Speed
      const warpBoost = progress > 0.78 ? 1 + (progress - 0.78) * 18 : 1;
      for (const s of stars) {
        s.z -= 0.012 * warpBoost;
        if (s.z <= 0.02) {
          s.z = 1;
          s.x = (Math.random() - 0.5) * 2;
          s.y = (Math.random() - 0.5) * 2;
        }
        const sx = cx + (s.x / s.z) * (w * 0.35);
        const sy = cy + (s.y / s.z) * (h * 0.35);
        const prevZ = s.z + 0.035 * warpBoost;
        const px = cx + (s.x / prevZ) * (w * 0.35);
        const py = cy + (s.y / prevZ) * (h * 0.35);

        const alpha = clamp((1 - s.z) * 0.9);
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = (1 - s.z) * 2.6 * dpr;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 3. Equalizador de Espectro Sonoro Circular / Simétrico (Assinatura Visual do NextPlay)
      const specAppear = easeOutExpo(clamp((elapsed - 300) / 1200));
      const barCount = 36;
      const baseY = cy + 68 * dpr;
      const totalWidth = Math.min(w * 0.75, 520 * dpr);
      const gap = 5 * dpr;
      const barW = (totalWidth - gap * (barCount - 1)) / barCount;
      const startX = cx - totalWidth / 2;

      for (let i = 0; i < barCount; i++) {
        const distFromCenter = Math.abs(i - (barCount - 1) / 2) / ((barCount - 1) / 2);
        const envelope = Math.cos(distFromCenter * (Math.PI / 2));
        const waveA = Math.sin(elapsed * 0.008 + i * 0.45) * 0.5 + 0.5;
        const waveB = Math.cos(elapsed * 0.013 - i * 0.3) * 0.5 + 0.5;
        const maxBarH = 54 * dpr * envelope * specAppear;
        const barH = Math.max(4 * dpr, (waveA * 0.65 + waveB * 0.35) * maxBarH);

        const x = startX + i * (barW + gap);
        const grad = ctx.createLinearGradient(x, baseY - barH, x, baseY + barH * 0.35);
        grad.addColorStop(0, '#5efce8');
        grad.addColorStop(0.5, '#00f2fe');
        grad.addColorStop(1, 'rgba(8, 145, 178, 0.1)');

        ctx.shadowColor = 'rgba(0, 242, 254, 0.7)';
        ctx.shadowBlur = 12 * dpr;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, baseY - barH, barW, barH, 3 * dpr);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // 4. Anel de Pulso de Choque quando os Prismas NextPlay se fundem
      if (elapsed > 750 && elapsed < 2200) {
        const pulseP = clamp((elapsed - 750) / 1100);
        const radius = easeOutExpo(pulseP) * 260 * dpr;
        ctx.strokeStyle = `rgba(0, 242, 254, ${(1 - pulseP) * 0.65})`;
        ctx.lineWidth = 2.5 * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy - 42 * dpr, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (elapsed >= totalMs) {
        triggerFinish();
        return;
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    window.addEventListener('keydown', triggerFinish);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', triggerFinish);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, [onFinish]);

  const prismScale = easeOutBack(clamp((bootStage + 1) / 3));

  return (
    <div
      onClick={() => {
        setExiting(true);
        setTimeout(onFinish, 300);
      }}
      role="presentation"
      title="Clique para entrar imediatamente"
      className={`fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#05080c] select-none cursor-pointer transition-all duration-500 ${
        exiting ? 'opacity-0 scale-110 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Indicador de Áudio Cinematográfico Ativo */}
      <div className="fixed top-6 right-6 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0d1622]/80 border border-cyan-400/40 text-cyan-300 text-xs font-mono backdrop-blur-md shadow-neon-cyan">
        <Volume2 className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Áudio de Entrada Ativo</span>
      </div>

      {/* Núcleo Central: Prisma Duplo "NEXT >> PLAY" + Tipografia Holográfica */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 -mt-12">
        {/* Ícone Duplo Prisma NextPlay (Assinatura da Imagem Oficial) */}
        <div
          className="relative w-28 h-28 flex items-center justify-center mb-4 transition-transform duration-500"
          style={{ transform: `scale(${prismScale})` }}
        >
          <div className="absolute inset-0 rounded-3xl bg-cyan-500/15 blur-2xl animate-pulse" />
          <svg viewBox="0 0 120 120" className="w-28 h-28 overflow-visible">
            <defs>
              <linearGradient id="np-prism-back" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0891b2" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </linearGradient>
              <linearGradient id="np-prism-front" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7ef9ff" />
                <stop offset="50%" stopColor="#00f2fe" />
                <stop offset="100%" stopColor="#0d9488" />
              </linearGradient>
              <filter id="np-neon-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Hexágono Técnico de Precisão ao Fundo */}
            <polygon
              points="60,8 106,34 106,86 60,112 14,86 14,34"
              fill="rgba(9, 16, 26, 0.85)"
              stroke="rgba(0, 242, 254, 0.35)"
              strokeWidth="2"
            />

            {/* Primeiro Prisma (NEXT >) */}
            <path
              d="M34 32 L74 60 L34 88 Z"
              fill="url(#np-prism-back)"
              stroke="#00f2fe"
              strokeWidth="1.5"
              opacity="0.75"
              className="transition-all duration-700"
              style={{
                transform: bootStage >= 1 ? 'translateX(0px)' : 'translateX(-24px)',
              }}
            />

            {/* Segundo Prisma Principal (PLAY >) com Brilho Neon */}
            <path
              d="M52 28 L96 60 L52 92 Z"
              fill="url(#np-prism-front)"
              filter="url(#np-neon-glow)"
              className="transition-all duration-700"
              style={{
                transform: bootStage >= 1 ? 'translateX(0px)' : 'translateX(24px)',
              }}
            />
          </svg>
        </div>

        {/* Logotipo Tipográfico NextPlay */}
        <div className="flex items-baseline gap-1 tracking-tight">
          <span className="text-4xl sm:text-6xl font-black text-white drop-shadow-[0_4px_24px_rgba(255,255,255,0.2)]">
            Next
          </span>
          <span className="text-4xl sm:text-6xl font-black bg-gradient-to-r from-[#5efce8] via-[#00f2fe] to-[#0ea5e9] bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(0,242,254,0.65)]">
            Play
          </span>
        </div>

        {/* Subtítulo Sofisticado Estilo Cinema */}
        <p className="mt-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.45em] text-cyan-200/70">
          Experiência de Streaming em Alta Definição
        </p>

        {/* Linha Fina Luminosa de Progresso Cinematográfica (Substitui boxes de terminal hacker) */}
        <div className="mt-14 w-48 sm:w-64 h-1 rounded-full bg-slate-800/80 overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-200 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(0,242,254,0.8)]"
            style={{
              width: bootStage === 0 ? '20%' : bootStage === 1 ? '55%' : bootStage === 2 ? '85%' : '100%',
            }}
          />
        </div>
      </div>

      <span className="fixed bottom-6 text-[10px] tracking-wider uppercase text-slate-500/80 font-medium">
        Clique em qualquer lugar para pular
      </span>
    </div>
  );
};
