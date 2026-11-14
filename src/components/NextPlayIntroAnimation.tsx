import React, { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';

interface NextPlayIntroAnimationProps {
  onFinish: () => void;
}

// Acorde de entrada leve e limpo (apenas 2 osciladores senoidais leves, zero peso de CPU na Smart TV)
const playLightweightIntroChime = (): AudioContext | null => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const t = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.35, t);
    master.connect(ctx.destination);

    // Impacto suave estilo streaming (grave quente e leve)
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(110, t);
    bass.frequency.exponentialRampToValueAtTime(55, t + 0.7);
    bassGain.gain.setValueAtTime(0.7, t);
    bassGain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    bass.connect(bassGain);
    bassGain.connect(master);
    bass.start(t);
    bass.stop(t + 1.15);

    // Harmônico cristalino NextPlay
    const chime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chime.type = 'triangle';
    chime.frequency.setValueAtTime(523.25, t + 0.12); // C5
    chime.frequency.exponentialRampToValueAtTime(659.25, t + 0.45); // E5
    chimeGain.gain.setValueAtTime(0.001, t);
    chimeGain.gain.linearRampToValueAtTime(0.45, t + 0.18);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 1.35);
    chime.connect(chimeGain);
    chimeGain.connect(master);
    chime.start(t + 0.12);
    chime.stop(t + 1.4);

    return ctx;
  } catch {
    return null;
  }
};

export const NextPlayIntroAnimation: React.FC<NextPlayIntroAnimationProps> = ({ onFinish }) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [phase, setPhase] = useState<'enter' | 'ready' | 'exit'>('enter');

  useEffect(() => {
    let finished = false;
    const finishNow = () => {
      if (finished) return;
      finished = true;
      setPhase('exit');
      window.setTimeout(onFinish, 260);
    };

    const tReady = window.setTimeout(() => setPhase('ready'), 80);
    const tDone = window.setTimeout(finishNow, 1850);

    const audioCtx = playLightweightIntroChime();
    audioCtxRef.current = audioCtx;

    window.addEventListener('keydown', finishNow);

    return () => {
      clearTimeout(tReady);
      clearTimeout(tDone);
      window.removeEventListener('keydown', finishNow);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, [onFinish]);

  return (
    <div
      onClick={() => {
        setPhase('exit');
        setTimeout(onFinish, 220);
      }}
      role="presentation"
      title="Pressione qualquer tecla ou clique para pular"
      className={`fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#06090e] select-none cursor-pointer transition-opacity duration-300 ${
        phase === 'exit' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ willChange: 'opacity' }}
    >
      {/* Fundo estático em gradiente radial leve (Zero Canvas / 100% GPU Hardware Accelerated) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(132, 204, 22, 0.14) 0%, rgba(16, 185, 129, 0.05) 38%, rgba(6, 9, 14, 1) 75%)',
        }}
      />

      {/* Indicador discreto no topo */}
      <div className="fixed top-6 right-6 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-lime-500/30 text-lime-300 text-xs font-mono">
        <Volume2 className="w-3.5 h-3.5 text-lime-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider">NextPlay TV Engine</span>
      </div>

      {/* Núcleo Central com aceleração pura por GPU (apenas transform e opacity) */}
      <div
        className={`relative z-10 flex flex-col items-center text-center px-6 transition-all duration-700 ease-out ${
          phase === 'enter'
            ? 'opacity-0 scale-90 translate-y-3'
            : phase === 'ready'
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-105'
        }`}
        style={{ willChange: 'transform, opacity' }}
      >
        <div className="relative flex items-center justify-center mb-5">
          <img
            src="/brand/logo-full.png"
            alt="NextPlay"
            className="relative h-24 sm:h-32 w-auto object-contain"
          />
        </div>

        <p className="mt-1 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.35em] text-lime-300/85">
          Streaming em Alta Definição
        </p>

        {/* Barra de carregamento leve por transform scaleX (60fps garantidos em TV Box) */}
        <div className="mt-10 w-48 sm:w-60 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full w-full bg-gradient-to-r from-lime-400 to-emerald-400 rounded-full origin-left transition-transform duration-[1500ms] ease-out"
            style={{
              transform: phase === 'enter' ? 'scaleX(0.08)' : 'scaleX(1)',
              willChange: 'transform',
            }}
          />
        </div>
      </div>

      <span className="fixed bottom-6 text-[10px] tracking-wider uppercase text-slate-500 font-medium">
        Pressione OK no controle para pular
      </span>
    </div>
  );
};
