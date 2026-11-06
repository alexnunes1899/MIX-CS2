export const GC_TIERS = [
  { min: 1, max: 4, name: 'Bronze', color: 'from-amber-700 to-amber-900', border: 'border-amber-700/60', text: 'text-amber-500', bg: 'bg-amber-950/40' },
  { min: 5, max: 8, name: 'Prata', color: 'from-slate-400 to-slate-600', border: 'border-slate-400/60', text: 'text-slate-300', bg: 'bg-slate-900/60' },
  { min: 9, max: 12, name: 'Ouro', color: 'from-yellow-400 to-amber-500', border: 'border-yellow-400/60', text: 'text-yellow-400', bg: 'bg-amber-950/30' },
  { min: 13, max: 16, name: 'Platina', color: 'from-cyan-400 to-blue-600', border: 'border-cyan-400/60', text: 'text-cyan-400', bg: 'bg-cyan-950/30' },
  { min: 17, max: 19, name: 'Diamante', color: 'from-purple-400 to-indigo-600', border: 'border-purple-400/60', text: 'text-purple-400', bg: 'bg-purple-950/30' },
  { min: 20, max: 20, name: 'Desafiante', color: 'from-red-500 to-rose-700', border: 'border-rose-500/80', text: 'text-rose-400', bg: 'bg-rose-950/40' },
  { min: 21, max: 21, name: 'Pro / Lenda', color: 'from-amber-300 via-orange-500 to-red-600', border: 'border-amber-400', text: 'text-amber-300', bg: 'bg-gradient-to-r from-amber-950/60 to-red-950/60' },
];

export function getGCTier(level) {
  const lvl = Math.max(1, Math.min(21, Number(level) || 1));
  return GC_TIERS.find((t) => lvl >= t.min && lvl <= t.max) || GC_TIERS[0];
}
