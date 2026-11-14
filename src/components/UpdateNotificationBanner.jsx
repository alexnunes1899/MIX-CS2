import React from 'react';

export default function UpdateNotificationBanner({ isAvailable, onUpdate }) {
  if (!isAvailable) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] max-w-lg w-[92%] px-2 animate-slideUp">
      <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-500 text-white shadow-[0_10px_35px_rgba(249,115,22,0.4)] border border-amber-300/40 flex items-center justify-between gap-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg shadow-inner animate-pulse">
            🚀
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider font-heading flex items-center gap-1.5 text-white">
              Nova Versão Disponível!
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
            </h4>
            <p className="text-[11px] text-amber-100/90 leading-tight">
              O código foi atualizado no GitHub / Railway. Atualize para carregar agora!
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onUpdate}
          className="px-3.5 py-2 rounded-xl bg-white text-orange-700 hover:bg-orange-50 font-black text-xs uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
        >
          ⚡ Atualizar
        </button>
      </div>
    </div>
  );
}
