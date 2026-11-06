import React, { useEffect } from 'react';
import { X, ShieldAlert, CheckCircle2, Lock, Sparkles, ArrowLeft } from 'lucide-react';
import SteamIcon from './SteamIcon';
import { playClickSound } from '../utils/audio';

export default function SteamLoginGateModal({
  isOpen,
  onClose,
  roomId = 'MIX-PRO',
  soundEnabled,
  actionText = 'criar salas e entrar no mix',
}) {
  useEffect(() => {
    if (!isOpen || !onClose) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (soundEnabled) playClickSound();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, soundEnabled]);

  if (!isOpen) return null;

  const handleLogin = () => {
    if (soundEnabled) playClickSound();
    window.location.href = `/api/auth/steam?room=${encodeURIComponent(roomId)}`;
  };

  const handleCloseClick = () => {
    if (soundEnabled) playClickSound();
    if (onClose) onClose();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          handleCloseClick();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-slate-900 border-2 border-[#66c0f4]/60 rounded-3xl shadow-2xl overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-[#66c0f4]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Pinned Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/95 backdrop-blur z-20 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#1b2838] text-[#66c0f4] border border-[#66c0f4]/30 text-[11px] font-bold uppercase tracking-wider">
            <Lock size={12} /> Autenticação Steam
          </div>

          {onClose && (
            <button
              onClick={handleCloseClick}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Fechar janela (Esc)"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar text-center space-y-4">
          {/* Steam Icon Hero */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-[#171a21] to-[#2a475e] border border-[#66c0f4]/50 flex items-center justify-center shadow-lg shadow-[#66c0f4]/20">
            <SteamIcon className="w-10 h-10 text-[#66c0f4]" />
          </div>

          <h2 className="text-2xl font-black font-heading text-white tracking-wide">
            CONECTE SUA STEAM
          </h2>

          <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
            Para <strong>{actionText}</strong>, é necessário entrar com sua conta Steam oficial. Isso garante a integridade dos times e busca automaticamente suas estatísticas.
          </p>

          {/* Benefits list */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 text-left space-y-2.5 text-xs text-slate-300 shadow-inner">
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

          {onClose && (
            <button
              onClick={handleCloseClick}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Voltar para a Página Inicial</span>
            </button>
          )}

          <p className="text-[10px] text-slate-500 font-mono">
            Autenticação 100% segura via Steam OpenID oficial da Valve.
          </p>
        </div>
      </div>
    </div>
  );
}
