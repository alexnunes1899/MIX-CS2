import React, { useEffect, useState } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { subscribeToasts } from '../utils/toast';

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const timers = new Map();
    const unsubscribe = subscribeToasts((toast) => {
      setToasts((prev) => [...prev.slice(-3), toast]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
        timers.delete(toast.id);
      }, toast.duration || 2600);
      timers.set(toast.id, timer);
    });

    return () => {
      unsubscribe();
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-20 right-4 z-[60] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-xs pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const isError = t.type === 'error';
        const isInfo = t.type === 'info';
        const Icon = isError ? AlertTriangle : isInfo ? Info : CheckCircle2;
        const accentCls = isError
          ? 'border-rose-500/50 bg-rose-950/90 text-rose-100'
          : isInfo
          ? 'border-sky-500/50 bg-slate-900/95 text-sky-100'
          : 'border-emerald-500/50 bg-slate-900/95 text-slate-100';
        const iconCls = isError ? 'text-rose-400' : isInfo ? 'text-sky-400' : 'text-emerald-400';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border backdrop-blur-xl shadow-2xl animate-fadeIn ${accentCls}`}
          >
            <Icon size={16} className={`${iconCls} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold leading-snug">{t.title}</div>
              {t.description && (
                <div className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">{t.description}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-slate-500 hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label="Fechar notificação"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
