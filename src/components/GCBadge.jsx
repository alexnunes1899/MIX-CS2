import React from 'react';
import { getGCTier } from '../data/gcLevels';

export default function GCBadge({ level, size = 'md', showTier = false }) {
  const lvl = Math.max(1, Math.min(21, Number(level) || 1));
  const tier = getGCTier(lvl);

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm font-bold',
    lg: 'w-11 h-11 text-base font-extrabold',
    xl: 'w-14 h-14 text-xl font-black',
  };

  const isHighLevel = lvl >= 20;

  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        className={`relative flex items-center justify-center rounded-lg bg-gradient-to-br ${tier.color} border ${tier.border} text-white font-mono shadow-md ${sizeClasses[size]} ${
          isHighLevel ? 'ring-2 ring-amber-400/50 shadow-amber-500/30' : ''
        }`}
        title={`Gamers Club Nível ${lvl} (${tier.name})`}
      >
        <span>{lvl}</span>
        {lvl === 21 && (
          <span className="absolute -top-1.5 -right-1 text-[10px]" title="Lenda">
            👑
          </span>
        )}
      </div>
      {showTier && (
        <span className={`text-xs font-semibold ${tier.text}`}>
          {tier.name}
        </span>
      )}
    </div>
  );
}
