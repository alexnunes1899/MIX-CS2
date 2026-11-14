import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, X, AlertCircle, Hash, Sparkles, Globe } from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function RoomPasswordModal({
  isOpen,
  onClose,
  roomId,
  roomName,
  onSubmitPassword,
  errorMessage = '',
  errorType = 'private_room',
  onOpenRoomsHub,
  soundEnabled,
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setShowPassword(false);
      return;
    }
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

  const isPasswordRequired = errorType === 'wrong_password' && typeof onSubmitPassword === 'function';

  const handleClose = () => {
    if (soundEnabled) playClickSound();
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim() || !onSubmitPassword) return;
    if (soundEnabled) playClickSound();
    onSubmitPassword(password.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isPasswordRequired ? 'Senha da Sala' : 'Sala Privada'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar janela"
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner bg-purple-500/20 text-purple-300 border-purple-500/30 shrink-0">
            <Lock size={24} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border text-purple-300 bg-purple-500/10 border-purple-500/20">
              {isPasswordRequired ? 'Protegida por Senha' : 'Mix Privado (Apenas Link)'}
            </span>
            <h2 className="text-lg font-bold font-heading text-white mt-1">
              {roomName || `Mix ${roomId}`}
            </h2>
            <p className="text-xs text-slate-400">
              {isPasswordRequired
                ? 'Digite a senha definida pelo criador da sala para entrar'
                : 'Entrada permitida somente através do Link de Convite'}
            </p>
          </div>
        </div>

        {/* Room User Card */}
        <div className="mb-4 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Identificador do Mix:
          </span>
          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1">
            <Hash size={13} /> {roomId}
          </span>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isPasswordRequired ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha da sala..."
                autoFocus
                className="w-full px-4 py-3 pr-11 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 outline-none text-sm text-white placeholder-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!password.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck size={14} />
                <span>Desbloquear</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs flex items-start gap-2.5">
              <Sparkles size={16} className="text-purple-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="text-purple-300 font-bold block">Acesso Exclusivo por Link Direto:</strong>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Esta sala foi criada como <strong>Privada</strong>. Para entrar nela, peça o <strong>Link de Convite</strong> para o criador do mix e abra diretamente pelo link.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Voltar
              </button>
              {onOpenRoomsHub && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onOpenRoomsHub();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Globe size={14} />
                  <span>Ver Mixes Públicos</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
