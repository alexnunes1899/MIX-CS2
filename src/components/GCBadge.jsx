import React from 'react';
import { getGCTier } from '../data/gcLevels';

export default function GCBadge({ level, size = 'md', showTier = false, className = '' }) {
  const lvl = Math.max(1, Math.min(21, Number(level) || 1));
  const tier = getGCTier(lvl);

  const sizeClasses = {
    sm: 'w-6 h-6 text-[11px] rounded-md shrink-0',
    md: 'w-8 h-8 text-xs font-black rounded-lg shrink-0',
    lg: 'w-11 h-11 text-base font-black rounded-xl shrink-0',
    xl: 'w-14 h-14 text-xl font-black rounded-2xl shrink-0',
  };

  const isLegend = lvl === 21;
  const isPro = lvl >= 19;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div
        className={`relative flex items-center justify-center bg-gradient-to-br ${tier.color} border-2 ${tier.border} text-white font-mono shadow-md overflow-hidden select-none ${sizeClasses[size]} ${
          isLegend
            ? 'ring-2 ring-amber-400 shadow-amber-500/50 animate-pulse'
            : isPro
            ? 'ring-1 ring-red-400/50'
            : ''
        }`}
        title={`Gamers Club Nível ${lvl} • ${tier.category}`}
      >
        {/* Subtle glass reflection on top */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-white/25 pointer-events-none" />

        <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
          {lvl}
        </span>

        {lvl === 21 && (
          <span className="absolute -top-1 -right-0.5 text-[9px] drop-shadow" title="Hall da Fama Gamers Club (Top 21)">
            👑
          </span>
        )}
      </div>

      {showTier && (
        <span className={`text-[11px] font-bold uppercase tracking-wider ${tier.text}`}>
          {tier.category}
        </span>
      )}
    </div>
  );
}
