import React, { useState } from 'react';
import {
  Plus,
  Pencil,
  Lock,
  Check,
  Trash2,
  X,
  Sparkles,
  ShieldCheck,
  Baby,
  LogOut,
  Users,
  KeyRound,
  History,
} from 'lucide-react';
import { UserAccount, UserSubProfile } from '../types/iptv';

export interface ProfileAvatarPreset {
  id: string;
  label: string;
  gradient: string;
  border: string;
  glow: string;
  svg: React.ReactNode;
}

export const PROFILE_AVATARS: ProfileAvatarPreset[] = [
  {
    id: 'cyber-wolf',
    label: 'Cyber Wolf',
    gradient: 'from-cyan-500 via-blue-600 to-indigo-800',
    border: 'border-cyan-400',
    glow: 'shadow-[0_0_30px_rgba(34,211,238,0.45)]',
    svg: (
      <svg viewBox="0 0 80 80" className="w-full h-full">
        <circle cx="40" cy="40" r="32" fill="rgba(255,255,255,0.08)" />
        {/* Sorriso estilizado clássico estilo Netflix */}
        <circle cx="28" cy="34" r="4.5" fill="#fff" />
        <circle cx="52" cy="34" r="4.5" fill="#fff" />
        <path
          d="M24 49 Q40 61 56 49"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'crimson-hero',
    label: 'Escarlate',
    gradient: 'from-rose-500 via-red-600 to-rose-900',
    border: 'border-rose-400',
    glow: 'shadow-[0_0_30px_rgba(244,63,94,0.45)]',
    svg: (
      <svg viewBox="0 0 80 80" className="w-full h-full">
        <circle cx="40" cy="40" r="32" fill="rgba(255,255,255,0.08)" />
        {/* Óculos de sol estiloso */}
        <rect x="17" y="27" width="20" height="13" rx="3" fill="#fff" />
        <rect x="43" y="27" width="20" height="13" rx="3" fill="#fff" />
        <line x1="37" y1="32" x2="43" y2="32" stroke="#fff" strokeWidth="4" />
        <path
          d="M27 52 Q40 60 53 50"
          fill="none"
          stroke="#fff"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'emerald-ninja',
    label: 'Ninja Neon',
    gradient: 'from-emerald-400 via-teal-600 to-emerald-900',
    border: 'border-emerald-400',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.45)]',
    svg: (
      <svg viewBox="0 0 80 80" className="w-full h-full">
        <rect x="14" y="26" width="52" height="18" rx="9" fill="rgba(0,0,0,0.45)" />
        <circle cx="29" cy="35" r="4" fill="#fff" />
        <circle cx="51" cy="35" r="4" fill="#fff" />
        <path d="M23 30 L34 33" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M57 30 L46 33" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
        <path
          d="M30 54 Q40 59 50 54"
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'royal-queen',
    label: 'Realeza VIP',
    gradient: 'from-purple-500 via-violet-600 to-fuchsia-900',
    border: 'border-purple-400',
    glow: 'shadow-[0_0_30px_rgba(168,85,247,0.45)]',
    svg: (
      <svg viewBox="0 0 80 80" className="w-full h-full">
        {/* Coroa */}
        <path
          d="M20 28 L27 16 L40 25 L53 16 L60 28 Z"
          fill="#fde047"
          stroke="#fff"
          strokeWidth="1.5"
        />
        <circle cx="28" cy="39" r="4" fill="#fff" />
        <circle cx="52" cy="39" r="4" fill="#fff" />
        <path
          d="M27 53 Q40 62 53 53"
          fill="none"
          stroke="#fff"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'golden-lion',
    label: 'Gold Solar',
    gradient: 'from-amber-400 via-orange-500 to-red-800',
    border: 'border-amber-400',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.45)]',
    svg: (
      <svg viewBox="0 0 80 80" className="w-full h-full">
        <circle cx="28" cy="33" r="4.5" fill="#fff" />
        <circle cx="52" cy="33" r="4.5" fill="#fff" />
        {/* Piscada / sorriso confiante */}
        <path
          d="M25 48 Q40 62 56 47"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <polygon points="40,14 43,21 50,21 45,25 47,32 40,28 33,32 35,25 30,21 37,21" fill="#fef08a" />
      </svg>
    ),
  },
  {
    id: 'astro-cat',
    label: 'Astro Gato',
    gradient: 'from-indigo-500 via-blue-700 to-slate-900',
    border: 'border-indigo-400',
    glow: 'shadow-[0_0_30px_rgba(99,102,241,0.45)]',
    svg: (
      <svg viewBox="0 0 80 80" className="w-full h-full">
        {/* Orelhas de gato */}
        <polygon points="20,28 24,13 35,24" fill="#fff" opacity="0.9" />
        <polygon points="60,28 56,13 45,24" fill="#fff" opacity="0.9" />
        <circle cx="29" cy="37" r="4.5" fill="#38bdf8" />
        <circle cx="51" cy="37" r="4.5" fill="#38bdf8" />
        <polygon points="40,44 36,40 44,40" fill="#f472b6" />
        <path
          d="M30 50 Q35 55 40 50 Q45 55 50 50"
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'retro-arcade',
    label: 'Gamer Retrô',
    gradient: 'from-fuchsia-500 via-pink-600 to-purple-900',
    border: 'border-fuchsia-400',
    glow: 'shadow-[0_0_30px_rgba(217,70,239,0.45)]',
    svg: (
      <svg viewBox="0 0 80 80" className="w-full h-full">
        {/* Headset Gamer */}
        <path
          d="M18 40 A22 22 0 0 1 62 40"
          fill="none"
          stroke="#fff"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <rect x="13" y="34" width="7" height="15" rx="3.5" fill="#22d3ee" />
        <rect x="60" y="34" width="7" height="15" rx="3.5" fill="#22d3ee" />
        <circle cx="30" cy="37" r="4" fill="#fff" />
        <circle cx="50" cy="37" r="4" fill="#fff" />
        <path
          d="M29 51 Q40 59 51 51"
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'cinema-pop',
    label: 'Cine Pipoca',
    gradient: 'from-red-600 via-rose-600 to-amber-700',
    border: 'border-amber-300',
    glow: 'shadow-[0_0_30px_rgba(251,191,36,0.4)]',
    svg: (
      <svg viewBox="0 0 80 80" className="w-full h-full">
        {/* Óculos 3D */}
        <rect x="16" y="28" width="21" height="13" rx="3" fill="#38bdf8" stroke="#fff" strokeWidth="2.5" />
        <rect x="43" y="28" width="21" height="13" rx="3" fill="#f43f5e" stroke="#fff" strokeWidth="2.5" />
        <line x1="37" y1="34" x2="43" y2="34" stroke="#fff" strokeWidth="3" />
        <path
          d="M27 52 Q40 62 53 52"
          fill="none"
          stroke="#fff"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'dragon-fire',
    label: 'Chama Turbo',
    gradient: 'from-orange-500 via-red-600 to-slate-950',
    border: 'border-orange-400',
    glow: 'shadow-[0_0_30px_rgba(249,115,22,0.45)]',
    svg: (
      <svg viewBox="0 0 80 80" className="w-full h-full">
        <path d="M23 26 L35 33" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        <path d="M57 26 L45 33" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        <circle cx="29" cy="37" r="4" fill="#fde047" />
        <circle cx="51" cy="37" r="4" fill="#fde047" />
        <path
          d="M26 52 Q40 60 54 52"
          fill="none"
          stroke="#fff"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'musik-vibe',
    label: 'Sound Wave',
    gradient: 'from-teal-400 via-cyan-600 to-blue-900',
    border: 'border-teal-300',
    glow: 'shadow-[0_0_30px_rgba(45,212,191,0.45)]',
    svg: (
      <svg viewBox="0 0 80 80" className="w-full h-full">
        <circle cx="28" cy="34" r="4.5" fill="#fff" />
        <circle cx="52" cy="34" r="4.5" fill="#fff" />
        <path
          d="M22 50 L28 46 L34 54 L40 44 L46 54 L52 46 L58 50"
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'kids-panda',
    label: 'Kids Panda',
    gradient: 'from-sky-400 via-emerald-400 to-teal-600',
    border: 'border-sky-300',
    glow: 'shadow-[0_0_30px_rgba(56,189,248,0.45)]',
    svg: (
      <svg viewBox="0 0 80 80" className="w-full h-full">
        <circle cx="22" cy="20" r="8" fill="#0f172a" />
        <circle cx="58" cy="20" r="8" fill="#0f172a" />
        <circle cx="40" cy="42" r="24" fill="#fff" />
        <ellipse cx="30" cy="38" rx="6" ry="7" fill="#0f172a" />
        <ellipse cx="50" cy="38" rx="6" ry="7" fill="#0f172a" />
        <circle cx="31" cy="36" r="2.5" fill="#fff" />
        <circle cx="51" cy="36" r="2.5" fill="#fff" />
        <ellipse cx="40" cy="45" rx="4" ry="3" fill="#0f172a" />
        <path
          d="M33 52 Q40 58 47 52"
          fill="none"
          stroke="#0f172a"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'kids-unicorn',
    label: 'Kids Estrela',
    gradient: 'from-pink-400 via-fuchsia-500 to-indigo-500',
    border: 'border-pink-300',
    glow: 'shadow-[0_0_30px_rgba(244,114,182,0.45)]',
    svg: (
      <svg viewBox="0 0 80 80" className="w-full h-full">
        <polygon points="40,10 34,26 46,26" fill="#fde047" />
        <circle cx="28" cy="38" r="4.5" fill="#fff" />
        <circle cx="52" cy="38" r="4.5" fill="#fff" />
        <circle cx="22" cy="45" r="4" fill="#f9a8d4" opacity="0.8" />
        <circle cx="58" cy="45" r="4" fill="#f9a8d4" opacity="0.8" />
        <path
          d="M29 50 Q40 60 51 50"
          fill="none"
          stroke="#fff"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function getAvatarPreset(avatarId?: string): ProfileAvatarPreset {
  return PROFILE_AVATARS.find((a) => a.id === avatarId) || PROFILE_AVATARS[0];
}

export const ProfileAvatarBadge: React.FC<{
  avatarId?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}> = ({ avatarId, size = 'md', className = '' }) => {
  const preset = getAvatarPreset(avatarId);
  const sizeClasses = {
    sm: 'w-7 h-7 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-24 h-24 sm:w-28 sm:h-28 rounded-2xl',
    xl: 'w-28 h-28 sm:w-36 sm:h-36 rounded-3xl',
  }[size];

  return (
    <div
      className={`bg-gradient-to-br ${preset.gradient} flex items-center justify-center overflow-hidden select-none relative ${sizeClasses} ${className}`}
    >
      {preset.svg}
    </div>
  );
};

interface ProfileGateScreenProps {
  user: UserAccount | null;
  profiles: UserSubProfile[];
  activeProfileId: string | null;
  onSelectProfile: (profile: UserSubProfile) => void;
  onCreateProfile: (payload: {
    name: string;
    avatarId: string;
    isKids: boolean;
    pin: string | null;
  }) => Promise<void>;
  onUpdateProfile: (
    profileId: string,
    payload: {
      name: string;
      avatarId: string;
      isKids: boolean;
      pin: string | null;
    }
  ) => Promise<void>;
  onDeleteProfile: (profileId: string) => Promise<void>;
  onClearProfileHistory?: (profileId: string) => Promise<void>;
  onLogoutAccount: () => void;
}

export const ProfileGateScreen: React.FC<ProfileGateScreenProps> = ({
  user,
  profiles,
  activeProfileId,
  onSelectProfile,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onClearProfileHistory,
  onLogoutAccount,
}) => {
  const [isManageMode, setIsManageMode] = useState(false);

  // Modal de Criar / Editar Perfil
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserSubProfile | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState('cyber-wolf');
  const [isKidsInput, setIsKidsInput] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal de Desbloqueio por PIN ao clicar num Perfil Reservado
  const [lockedTarget, setLockedTarget] = useState<UserSubProfile | null>(null);
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState(false);

  const openCreateModal = () => {
    const usedAvatars = new Set(profiles.map((p) => p.avatarId));
    const nextAvatar =
      PROFILE_AVATARS.find((a) => !usedAvatars.has(a.id))?.id || PROFILE_AVATARS[0].id;
    setEditingProfile(null);
    setNameInput('');
    setSelectedAvatarId(nextAvatar);
    setIsKidsInput(false);
    setPinEnabled(false);
    setPinInput('');
    setErrorMsg(null);
    setEditorOpen(true);
  };

  const openEditModal = (profile: UserSubProfile) => {
    setEditingProfile(profile);
    setNameInput(profile.name);
    setSelectedAvatarId(profile.avatarId || 'cyber-wolf');
    setIsKidsInput(Boolean(profile.isKids));
    setPinEnabled(Boolean(profile.pin));
    setPinInput(profile.pin || '');
    setErrorMsg(null);
    setEditorOpen(true);
  };

  const handleProfileClick = (profile: UserSubProfile) => {
    if (isManageMode) {
      openEditModal(profile);
      return;
    }
    if (profile.pin && profile.pin.length === 4) {
      setLockedTarget(profile);
      setUnlockPin('');
      setUnlockError(false);
      return;
    }
    onSelectProfile(profile);
  };

  const handleConfirmUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockedTarget) return;
    if (unlockPin.trim() === lockedTarget.pin) {
      const target = lockedTarget;
      setLockedTarget(null);
      setUnlockPin('');
      onSelectProfile(target);
    } else {
      setUnlockError(true);
      setUnlockPin('');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName) {
      setErrorMsg('Digite o nome do perfil.');
      return;
    }
    if (pinEnabled && !/^\d{4}$/.test(pinInput.trim())) {
      setErrorMsg('O PIN de reserva do perfil deve conter exatamente 4 números.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        name: cleanName,
        avatarId: selectedAvatarId,
        isKids: isKidsInput,
        pin: pinEnabled ? pinInput.trim() : null,
      };
      if (editingProfile) {
        await onUpdateProfile(editingProfile.id, payload);
      } else {
        await onCreateProfile(payload);
      }
      setEditorOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingProfile) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await onDeleteProfile(editingProfile.id);
      setEditorOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao excluir perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#070b10] text-white flex flex-col justify-between overflow-y-auto select-none">
      {/* Brilho Cinematográfico de Fundo */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[750px] h-[380px] bg-cyan-500/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
        <div className="flex items-center gap-3">
          <img
            src="/brand/logo-full.png"
            alt="NextPlay"
            className="h-10 sm:h-11 w-auto object-contain"
          />
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span className="truncate max-w-[180px]">{user.email}</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-bold text-[10px]">
                {profiles.length}/5 Perfis
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={onLogoutAccount}
            className="px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-rose-500/15 border border-slate-800 hover:border-rose-500/40 text-xs font-semibold text-slate-300 hover:text-rose-300 flex items-center gap-2 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </header>

      {/* Centro: "Quem está assistindo?" Estilo Netflix */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center mb-10 sm:mb-14">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3">
            {isManageMode ? 'Gerenciar Perfis' : 'Quem está assistindo?'}
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto">
            {isManageMode
              ? 'Toque em um perfil para personalizar o avatar, ativar o modo Kids ou bloquear com PIN.'
              : 'Cada perfil possui sua própria Minha Lista e histórico Continuar Assistindo individual.'}
          </p>
        </div>

        {/* Grade de até 5 Perfis */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-9 max-w-5xl">
          {profiles.map((profile) => {
            const preset = getAvatarPreset(profile.avatarId);
            const isCurrent = activeProfileId === profile.id;
            const historyCount = Array.isArray(profile.history) ? profile.history.length : 0;

            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleProfileClick(profile)}
                className="group flex flex-col items-center focus:outline-none cursor-pointer transition-transform duration-200 hover:scale-105 focus:scale-105"
              >
                <div
                  className={`relative rounded-3xl p-1 transition-all duration-200 ${
                    isCurrent
                      ? `ring-4 ring-cyan-400 ${preset.glow}`
                      : 'ring-2 ring-transparent group-hover:ring-white group-focus:ring-cyan-400'
                  }`}
                >
                  <ProfileAvatarBadge
                    avatarId={profile.avatarId}
                    size="xl"
                    className="shadow-2xl"
                  />

                  {/* Badge KIDS */}
                  {profile.isKids && (
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 text-slate-950 font-black text-[10px] tracking-wider uppercase shadow-lg">
                      KIDS
                    </span>
                  )}

                  {/* Ícone de Cadeado se tiver PIN reservado */}
                  {profile.pin && !isManageMode && (
                    <div
                      title="Perfil Reservado com PIN"
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/70 backdrop-blur-md border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-lg"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  )}

                  {/* Overlay de Edição no modo Gerenciar Perfis */}
                  {isManageMode && (
                    <div className="absolute inset-1 rounded-3xl bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1.5 text-white transition">
                      <div className="w-11 h-11 rounded-full bg-white/15 border border-white/40 flex items-center justify-center">
                        <Pencil className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                        Editar
                      </span>
                    </div>
                  )}
                </div>

                {/* Nome do Perfil */}
                <span className="mt-4 text-base sm:text-lg font-bold text-slate-300 group-hover:text-white group-focus:text-cyan-300 transition max-w-[140px] truncate">
                  {profile.name}
                </span>

                {/* Contador sutil de itens no histórico do perfil */}
                <span className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-1">
                  {profile.pin ? (
                    <>
                      <Lock className="w-3 h-3 text-amber-400/80" />
                      <span>Reservado</span>
                    </>
                  ) : historyCount > 0 ? (
                    <span>{historyCount} no histórico</span>
                  ) : (
                    <span>Histórico limpo</span>
                  )}
                </span>
              </button>
            );
          })}

          {/* Botão "+ Adicionar Perfil" (Exibido até completar 5 perfis) */}
          {profiles.length < 5 && (
            <button
              type="button"
              onClick={openCreateModal}
              className="group flex flex-col items-center focus:outline-none cursor-pointer transition-transform duration-200 hover:scale-105 focus:scale-105"
            >
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-slate-900/70 hover:bg-slate-800/90 border-2 border-dashed border-slate-700 group-hover:border-cyan-400 group-focus:border-cyan-400 flex flex-col items-center justify-center gap-2 transition shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 group-hover:bg-cyan-500/20 flex items-center justify-center text-slate-400 group-hover:text-cyan-300 transition">
                  <Plus className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-bold text-slate-400 group-hover:text-cyan-300">
                  {5 - profiles.length} {5 - profiles.length === 1 ? 'vaga' : 'vagas'}
                </span>
              </div>
              <span className="mt-4 text-base sm:text-lg font-bold text-slate-400 group-hover:text-white transition">
                Adicionar Perfil
              </span>
              <span className="mt-0.5 text-[11px] text-slate-600">Até 5 perfis</span>
            </button>
          )}
        </div>

        {/* Botão Inferior: Gerenciar Perfis / Concluído */}
        <div className="mt-12 sm:mt-16">
          <button
            type="button"
            onClick={() => setIsManageMode(!isManageMode)}
            className={`px-8 py-3 rounded-xl font-bold text-sm tracking-wide uppercase transition cursor-pointer flex items-center gap-2.5 ${
              isManageMode
                ? 'bg-white text-slate-950 hover:bg-cyan-300 shadow-lg'
                : 'bg-transparent hover:bg-white/5 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-400'
            }`}
          >
            {isManageMode ? (
              <>
                <Check className="w-4 h-4" />
                <span>Concluído</span>
              </>
            ) : (
              <>
                <Pencil className="w-4 h-4" />
                <span>Gerenciar Perfis</span>
              </>
            )}
          </button>
        </div>
      </main>

      {/* Rodapé informativo */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-600">
        NextPlay Multi-Perfil • Histórico e Favoritos sincronizados individualmente por perfil
      </footer>

      {/* ===================================================================== */}
      {/* MODAL DE DESBLOQUEIO DE PERFIL RESERVADO (PIN DE 4 DÍGITOS)           */}
      {/* ===================================================================== */}
      {lockedTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#0c131d] border border-slate-800 shadow-2xl p-6 text-center relative">
            <button
              type="button"
              onClick={() => setLockedTarget(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex justify-center mb-4">
              <ProfileAvatarBadge avatarId={lockedTarget.avatarId} size="lg" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold mb-2">
              <Lock className="w-3.5 h-3.5" />
              <span>Perfil Reservado</span>
            </div>

            <h3 className="text-xl font-black text-white">{lockedTarget.name}</h3>
            <p className="text-xs text-slate-400 mt-1 mb-5">
              Digite o PIN de 4 dígitos para entrar neste perfil.
            </p>

            <form onSubmit={handleConfirmUnlock} className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={unlockPin}
                onChange={(e) => {
                  setUnlockError(false);
                  setUnlockPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                }}
                placeholder="• • • •"
                className="w-44 mx-auto block text-center text-2xl tracking-[0.6em] font-black py-3 px-4 rounded-2xl bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:outline-none text-white"
              />

              {unlockError && (
                <p className="text-xs font-semibold text-rose-400">
                  PIN incorreto. Tente novamente.
                </p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLockedTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={unlockPin.length !== 4}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-xs font-black text-white transition cursor-pointer"
                >
                  Desbloquear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE CRIAR / EDITAR PERFIL + ESCOLHA DE AVATAR E PIN              */}
      {/* ===================================================================== */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl bg-[#0b121b] border border-slate-800 shadow-2xl p-6 sm:p-8 my-8 relative">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {editingProfile ? 'Editar Perfil' : 'Novo Perfil'}
              </h2>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Preview + Input Nome */}
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/90">
                <ProfileAvatarBadge avatarId={selectedAvatarId} size="lg" className="shrink-0" />
                <div className="flex-1 w-full space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Nome do Perfil
                  </label>
                  <input
                    type="text"
                    maxLength={22}
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Ex: Wellington, Sala, Kids..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:outline-none text-sm font-bold text-white"
                  />
                  <p className="text-[11px] text-slate-500">
                    Histórico &quot;Continuar Assistindo&quot; e favoritos ficarão salvos exclusivamente neste perfil.
                  </p>
                </div>
              </div>

              {/* Galeria de Avatares Estilo Netflix */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Escolha o Avatar do Perfil
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {PROFILE_AVATARS.map((av) => {
                    const isSelected = selectedAvatarId === av.id;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => setSelectedAvatarId(av.id)}
                        className={`group flex flex-col items-center p-1.5 rounded-2xl border transition cursor-pointer ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-500/15 scale-105'
                            : 'border-slate-800 bg-slate-900/40 hover:border-slate-600'
                        }`}
                      >
                        <ProfileAvatarBadge avatarId={av.id} size="md" />
                        <span className="mt-1.5 text-[10px] font-semibold text-slate-300 truncate max-w-full">
                          {av.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opções de Privacidade: Modo Kids e PIN de Reserva */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Toggle Perfil Kids */}
                <button
                  type="button"
                  onClick={() => setIsKidsInput(!isKidsInput)}
                  className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition cursor-pointer ${
                    isKidsInput
                      ? 'bg-sky-500/15 border-sky-400/60 text-white'
                      : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isKidsInput ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Baby className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Perfil Kids / Infantil</span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isKidsInput ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isKidsInput ? 'ATIVO' : 'OFF'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Oculta automaticamente canais e conteúdos adultos (+18).
                    </p>
                  </div>
                </button>

                {/* Toggle PIN de Reserva do Perfil */}
                <div
                  className={`p-3.5 rounded-2xl border transition ${
                    pinEnabled
                      ? 'bg-amber-500/10 border-amber-400/60 text-white'
                      : 'bg-slate-900/50 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !pinEnabled;
                        setPinEnabled(next);
                        if (!next) setPinInput('');
                      }}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer ${
                        pinEnabled ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Reservar com PIN</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !pinEnabled;
                            setPinEnabled(next);
                            if (!next) setPinInput('');
                          }}
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full cursor-pointer ${
                            pinEnabled
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {pinEnabled ? 'COM PIN' : 'LIVRE'}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Protege seu perfil e histórico com senha de 4 dígitos.
                      </p>
                    </div>
                  </div>

                  {pinEnabled && (
                    <div className="mt-3 pt-2.5 border-t border-amber-500/20 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-amber-300">PIN de 4 dígitos:</span>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={pinInput}
                        onChange={(e) =>
                          setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                        }
                        placeholder="0000"
                        className="w-24 text-center font-mono font-black tracking-widest text-sm py-1.5 px-2.5 rounded-lg bg-slate-950 border border-amber-400/50 text-white focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-semibold text-rose-300">
                  {errorMsg}
                </div>
              )}

              {/* Ações do Modal */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  {editingProfile && profiles.length > 1 && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleDelete}
                      className="px-3.5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-300 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir Perfil</span>
                    </button>
                  )}

                  {editingProfile &&
                    onClearProfileHistory &&
                    Array.isArray(editingProfile.history) &&
                    editingProfile.history.length > 0 && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={async () => {
                          await onClearProfileHistory(editingProfile.id);
                          setEditorOpen(false);
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Limpar Histórico ({editingProfile.history.length})</span>
                      </button>
                    )}
                </div>

                <div className="flex items-center gap-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditorOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-black text-white shadow-lg flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{saving ? 'Salvando...' : 'Salvar Perfil'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

