import React from 'react';

/**
 * MixHubLogo - Brasão Oficial eSports do CS2 Mix Hub
 * Renderiza o escudo vetorial facetado de alta performance com gradientes dinâmicos.
 */
export default function MixHubLogo({ className = 'w-10 h-10', animated = true }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className} ${animated ? 'group-hover:scale-105 transition-transform duration-300' : ''}`}>
      <img
        src="/logo.svg"
        alt="CS2 Mix Hub"
        className="w-full h-full object-contain drop-shadow-[0_4px_16px_rgba(245,158,11,0.35)] select-none pointer-events-none"
        loading="eager"
      />
    </div>
  );
}
