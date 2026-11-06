import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, X, AlertCircle, Hash, Sparkles, Globe } from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function RoomPasswordModal({
  isOpen,
  onClose,
  roomId,
  roomName,
  onSubmitPassword,
  errorMessage,
  errorType = 'wrong_password',
  onOpenRoomsHub,
  soundEnabled,
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const isPrivateRoom = errorType === 'private_room';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    if (soundEnabled) playClickSound();
    setSubmitting(true);
    onSubmitPassword(password.trim());
    setTimeout(() => setSubmitting(false), 500);
  };

  const handleClose = () => {
    if (soundEnabled) playClickSound();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${
            isPrivateRoom
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          }`}>
            <Lock size={24} />
          </div>
          <div>
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              isPrivateRoom
                ? 'text-purple-300 bg-purple-500/10 border-purple-500/20'
                : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            }`}>
              {isPrivateRoom ? 'Mix Privado (Estilo GC)' : 'Sala com Senha'}
            </span>
            <h2 className="text-lg font-bold font-heading text-white mt-1">
              {roomName || `Mix ${roomId}`}
            </h2>
            <p className="text-xs text-slate-400">
              {isPrivateRoom ? 'Acesso restrito a convidados via link' : 'Esta sala requer uma senha para entrar'}
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

        {/* Private Room Notice */}
        {isPrivateRoom ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs flex items-start gap-2.5">
              <Sparkles size={16} className="text-purple-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="text-purple-300 font-bold block">Acesso Exclusivo por Link Direto:</strong>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Este mix foi criado como <strong>Privado</strong>. Para entrar nele, solicite o <strong>Link de Convite</strong> ao criador da sala e abra diretamente pelo seu navegador.
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
        ) : (
          /* Password Form */
          <>
            {/* Direct Link Tip */}
            <div className="mb-4 p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-200 text-xs flex items-start gap-2">
              <Sparkles size={15} className="text-sky-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong className="text-sky-300">Dica:</strong> Se você recebeu o link de convite do criador, basta clicar nele para entrar <strong>direto sem precisar de senha</strong>!
              </p>
            </div>

            {/* Error Notice */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 animate-pulse">
                <AlertCircle size={15} className="shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1.5 uppercase tracking-wide">
                  Digite a Senha da Sala (PIN)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ex: 7492"
                    autoFocus
                    required
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-600 outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                    title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !password.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <ShieldCheck size={15} />
                  <span>{submitting ? 'Verificando...' : 'Entrar na Sala'}</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
