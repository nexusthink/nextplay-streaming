import React, { useState, useRef, useEffect } from 'react';
import { Lock, X, AlertCircle, KeyRound, ShieldAlert } from 'lucide-react';

interface ParentalPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentPin: string;
}

export const ParentalPinModal: React.FC<ParentalPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentPin,
}) => {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '']);
      setError(false);
      setTimeout(() => {
        inputRefs[0].current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, val: string) => {
    const char = val.slice(-1); // Apenas o último caractere digitado
    if (char && !/^\d$/.test(char)) return;

    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setError(false);

    // Auto-avanço para o próximo campo
    if (char && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Se completou os 4 dígitos, valida imediatamente
    if (index === 3 && char) {
      const entered = newDigits.join('');
      if (entered === currentPin) {
        onSuccess();
      } else {
        setError(true);
        setTimeout(() => {
          setDigits(['', '', '', '']);
          inputRefs[0].current?.focus();
        }, 500);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-sm bg-[#0c131c] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-center">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Ícone de Cadeado */}
        <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center mb-4 shadow-[0_0_24px_rgba(244,63,94,0.3)]">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h3 className="text-lg font-black text-white tracking-tight">Controle dos Pais</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          Conteúdo restrito (+18). Digite seu PIN de 4 dígitos para desbloquear.
        </p>

        {/* 4 Caixinhas de PIN */}
        <div className="flex items-center justify-center gap-3 my-6">
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={inputRefs[idx]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className={`w-12 h-14 rounded-2xl bg-[#060a0f] text-center text-2xl font-bold text-white border transition-all focus:outline-none ${
                error
                  ? 'border-rose-500 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.5)] animate-shake'
                  : digit
                  ? 'border-cyan-400 text-cyan-300 shadow-neon-cyan'
                  : 'border-slate-800 focus:border-cyan-400'
              }`}
            />
          ))}
        </div>

        {error ? (
          <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-semibold mb-2 animate-bounce">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>PIN incorreto. Tente novamente.</span>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 font-mono mb-2">
            PIN padrão inicial: <strong className="text-cyan-300">0000</strong>
          </p>
        )}

        <div className="pt-3 border-t border-slate-800/80">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

