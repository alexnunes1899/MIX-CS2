import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function DeleteRoomModal({
  isOpen,
  onClose,
  onConfirm,
  roomId,
  roomName,
  soundEnabled,
}) {
  useEffect(() => {
    if (!isOpen) return;
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

  const handleConfirm = () => {
    if (soundEnabled) playClickSound();
    onConfirm(roomId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-room-modal-title"
    >
      <div className="relative w-full max-w-md bg-[#0d131f] border-2 border-red-500/60 rounded-3xl p-6 text-center shadow-2xl">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar janela de exclusão"
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Warning Icon */}
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/40 shadow-lg shadow-red-500/20">
          <Trash2 size={26} className="animate-pulse" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-black font-heading text-white tracking-wide mb-2">
          Excluir Sala de Mix?
        </h3>

        {/* Body Description */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 mb-5 text-left text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-500 font-semibold uppercase text-[10px]">SALA SELECIONADA:</span>
            <span className="font-bold text-white">{roomName || roomId}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-500 font-semibold uppercase text-[10px]">CÓDIGO:</span>
            <span className="font-mono font-bold text-amber-400">#{roomId}</span>
          </div>
          <p className="text-[11px] text-red-300/90 leading-relaxed pt-1 border-t border-slate-800/80 flex items-start gap-1.5">
            <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <span>
              Esta ação excluirá permanentemente a sala de mix. Todos os jogadores conectados serão desconectados e redirecionados para a tela inicial.
            </span>
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border border-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-500/25 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Trash2 size={14} />
            <span>Excluir Sala</span>
          </button>
        </div>
      </div>
    </div>
  );
}
