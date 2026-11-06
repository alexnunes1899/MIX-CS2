import React from 'react';
import { Star } from 'lucide-react';

/**
 * Official FACEIT Skill Level Badges (Levels 1 to 10)
 */
const FACEIT_TIERS = {
  1: { label: 'Nível 1', bg: 'bg-zinc-800/90', border: 'border-zinc-500', text: 'text-zinc-200', glow: 'shadow-zinc-500/10' },
  2: { label: 'Nível 2', bg: 'bg-emerald-950/80', border: 'border-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  3: { label: 'Nível 3', bg: 'bg-emerald-900/80', border: 'border-emerald-400', text: 'text-emerald-300', glow: 'shadow-emerald-400/20' },
  4: { label: 'Nível 4', bg: 'bg-yellow-950/80', border: 'border-yellow-500', text: 'text-yellow-400', glow: 'shadow-yellow-500/20' },
  5: { label: 'Nível 5', bg: 'bg-yellow-900/80', border: 'border-yellow-400', text: 'text-yellow-300', glow: 'shadow-yellow-400/20' },
  6: { label: 'Nível 6', bg: 'bg-amber-950/80', border: 'border-amber-500', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
  7: { label: 'Nível 7', bg: 'bg-orange-950/80', border: 'border-orange-500', text: 'text-orange-400', glow: 'shadow-orange-500/25' },
  8: { label: 'Nível 8', bg: 'bg-orange-900/80', border: 'border-orange-400', text: 'text-orange-300', glow: 'shadow-orange-400/30' },
  9: { label: 'Nível 9', bg: 'bg-rose-950/80', border: 'border-rose-500', text: 'text-rose-400', glow: 'shadow-rose-500/30' },
  10: { label: 'Nível 10', bg: 'bg-gradient-to-tr from-rose-950 via-red-900 to-rose-950', border: 'border-red-500', text: 'text-red-400', glow: 'shadow-red-500/40 ring-1 ring-red-400/30' },
};

export default function FaceitBadge({ level = 5, elo, size = 'md', showLabel = false }) {
  const lvl = Math.max(1, Math.min(10, Number(level) || 5));
  const tier = FACEIT_TIERS[lvl] || FACEIT_TIERS[5];

  const sizeClasses = {
    sm: 'w-6 h-6 text-[11px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm font-black',
  }[size] || 'w-8 h-8 text-xs';

  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        className={`relative flex items-center justify-center font-heading font-black rounded-lg border shadow-md transition-all ${tier.bg} ${tier.border} ${tier.text} ${tier.glow} ${sizeClasses}`}
        title={`FACEIT Level ${lvl}${elo ? ` • ${elo} ELO` : ''}`}
      >
        {lvl === 10 ? (
          <div className="flex items-center gap-0.5">
            <Star size={size === 'lg' ? 12 : 9} fill="currentColor" className="text-amber-400" />
            <span>10</span>
          </div>
        ) : (
          <span>{lvl}</span>
        )}
      </div>

      {showLabel && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider font-heading">FACEIT</span>
            <span className={`text-[11px] font-bold ${tier.text}`}>LVL {lvl}</span>
          </div>
          {elo && (
            <span className="text-[10px] text-slate-400 font-mono">{elo} ELO</span>
          )}
        </div>
      )}
    </div>
  );
}
