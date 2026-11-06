import React from 'react';
import { X, ShieldAlert, CheckCircle2, Lock, Sparkles } from 'lucide-react';
import SteamIcon from './SteamIcon';
import { playClickSound } from '../utils/audio';

export default function SteamLoginGateModal({
  isOpen,
  onClose,
  roomId = 'MIX-PRO',
  soundEnabled,
  actionText = 'criar salas e entrar no mix',
}) {
  if (!isOpen) return null;

  const handleLogin = () => {
    if (soundEnabled) playClickSound();
    window.location.href = `/api/auth/steam?room=${encodeURIComponent(roomId)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-slate-900 border-2 border-[#66c0f4]/60 rounded-3xl p-6 text-center shadow-2xl">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-[#66c0f4]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        )}

        {/* Top Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#1b2838] text-[#66c0f4] border border-[#66c0f4]/30 text-xs font-bold uppercase tracking-wider mb-4">
          <Lock size={13} /> Autenticação Steam Obrigatória
        </div>

        {/* Steam Icon Hero */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-[#171a21] to-[#2a475e] border border-[#66c0f4]/50 flex items-center justify-center shadow-lg shadow-[#66c0f4]/20 mb-4">
          <SteamIcon className="w-10 h-10 text-[#66c0f4]" />
        </div>

        <h2 className="text-2xl font-black font-heading text-white tracking-wide mb-2">
          CONECTE SUA STEAM
        </h2>

        <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto mb-6">
          Para <strong>{actionText}</strong>, é necessário entrar com sua conta Steam oficial. Isso garante a integridade dos times e busca automaticamente suas estatísticas.
        </p>

        {/* Benefits list */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 text-left space-y-2.5 mb-6 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>Puxa seu <strong>Nickname</strong> e <strong>Avatar</strong> oficial do CS2</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>Sincroniza seu <strong>Nível e ELO no FACEIT</strong> automaticamente</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>Evita fakes e balanceia partidas 5v5 com precisão</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleLogin}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#171a21] via-[#1b2838] to-[#2a475e] hover:from-[#1b2838] hover:to-[#2a475e] text-white border-2 border-[#66c0f4]/60 hover:border-[#66c0f4] shadow-xl text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-3 cursor-pointer group active:scale-95"
        >
          <SteamIcon className="w-5 h-5 text-[#66c0f4] group-hover:scale-110 transition-transform" />
          <span>Fazer Login com a Steam ➔</span>
        </button>

        <p className="text-[10px] text-slate-500 font-mono mt-3">
          Autenticação 100% segura via Steam OpenID oficial da Valve.
        </p>
      </div>
    </div>
  );
}
