// Gamers Club CS2 - Sistema Oficial de Níveis (1 a 21)
// Classificação oficial por faixas de habilidade com as cores oficiais da Gamers Club

export const GC_TIERS = [
  {
    min: 1,
    max: 4,
    name: 'Nível 1 a 4',
    category: 'Iniciante',
    color: 'from-slate-500 via-slate-600 to-slate-700',
    border: 'border-slate-400/50',
    text: 'text-slate-300',
    bg: 'bg-slate-900/60',
    badgeGlow: 'shadow-slate-500/20',
  },
  {
    min: 5,
    max: 8,
    name: 'Nível 5 a 8',
    category: 'Amador',
    color: 'from-sky-400 via-sky-500 to-blue-600',
    border: 'border-sky-400/60',
    text: 'text-sky-400',
    bg: 'bg-sky-950/40',
    badgeGlow: 'shadow-sky-500/25',
  },
  {
    min: 9,
    max: 10,
    name: 'Nível 9 a 10',
    category: 'Intermediário',
    color: 'from-blue-600 via-indigo-600 to-indigo-700',
    border: 'border-blue-400/70',
    text: 'text-blue-400',
    bg: 'bg-blue-950/40',
    badgeGlow: 'shadow-blue-500/30',
  },
  {
    min: 11,
    max: 14,
    name: 'Nível 11 a 14',
    category: 'Ranked START',
    color: 'from-emerald-500 via-green-600 to-teal-700',
    border: 'border-emerald-400/70',
    text: 'text-emerald-400',
    bg: 'bg-emerald-950/40',
    badgeGlow: 'shadow-emerald-500/30',
  },
  {
    min: 15,
    max: 18,
    name: 'Nível 15 a 18',
    category: 'Ranked RISE',
    color: 'from-amber-400 via-orange-500 to-amber-600',
    border: 'border-amber-400/80',
    text: 'text-amber-400',
    bg: 'bg-amber-950/40',
    badgeGlow: 'shadow-amber-500/35',
  },
  {
    min: 19,
    max: 20,
    name: 'Nível 19 e 20',
    category: 'Ranked PRO',
    color: 'from-red-600 via-rose-600 to-red-800',
    border: 'border-red-400/80',
    text: 'text-red-400',
    bg: 'bg-red-950/40',
    badgeGlow: 'shadow-red-500/40',
  },
  {
    min: 21,
    max: 21,
    name: 'Nível 21',
    category: 'Hall da Fama (Top 21)',
    color: 'from-amber-300 via-red-600 to-yellow-500',
    border: 'border-amber-300',
    text: 'text-amber-300',
    bg: 'bg-gradient-to-r from-red-950/60 to-amber-950/60',
    badgeGlow: 'shadow-amber-400/50',
  },
];

export function getGCTier(level) {
  const lvl = Math.max(1, Math.min(21, Number(level) || 1));
  const tier = GC_TIERS.find((t) => lvl >= t.min && lvl <= t.max) || GC_TIERS[0];
  return {
    ...tier,
    level: lvl,
    // Preserve name as category or clear label
    name: tier.category,
  };
}
