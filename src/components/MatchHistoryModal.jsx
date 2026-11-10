import React, { useState, useEffect } from 'react';
import { Trophy, History, X, Calendar, MapPin } from 'lucide-react';
import { playClickSound } from '../utils/audio';

const AVAILABLE_MAPS = [
  { id: 'de_mirage', name: 'Mirage', image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_mirage_1_png.png' },
  { id: 'de_inferno', name: 'Inferno', image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_inferno_1_png.png' },
  { id: 'de_nuke', name: 'Nuke', image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_nuke_1_png.png' },
  { id: 'de_dust2', name: 'Dust II', image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_dust2_1_png.png' },
  { id: 'de_ancient', name: 'Ancient', image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_ancient_1_png.png' },
  { id: 'de_anubis', name: 'Anubis', image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_anubis_1_png.png' },
  { id: 'de_vertigo', name: 'Vertigo', image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_vertigo_1_png.png' },
  { id: 'de_overpass', name: 'Overpass', image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_overpass_1_png.png' },
  { id: 'de_train', name: 'Train', image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_train_1_png.png' },
  { id: 'de_cache', name: 'Cache', image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_cache_1_png.png' },
];

export default function MatchHistoryModal({
  isOpen,
  onClose,
  history = [],
  currentMap = 'Mirage',
  onSaveScore,
  onOpenGlobalHistory,
  soundEnabled,
}) {
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [selectedMap, setSelectedMap] = useState(currentMap || 'Mirage');

  useEffect(() => {
    if (currentMap) {
      setSelectedMap(currentMap);
    }
  }, [currentMap, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (scoreA === '' || scoreB === '') return;
    if (soundEnabled) playClickSound();

    onSaveScore(scoreA, scoreB, selectedMap);
    setScoreA('');
    setScoreB('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <History size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading text-white">Histórico de Mixes da Sala</h2>
            <p className="text-xs text-slate-400">Placares registrados das partidas jogadas aqui</p>
          </div>
        </div>

        {/* Record Result Form */}
        <form onSubmit={handleSubmit} className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 mb-5 space-y-3.5">
          <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Trophy size={14} /> Registrar Placar do Último Mix
          </div>

          {/* Interactive Map Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={13} className="text-amber-400" /> Mapa Jogado no Mix:
              </label>
              <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {selectedMap}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {AVAILABLE_MAPS.slice(0, 5).map((m) => {
                const isSelected = selectedMap.toLowerCase() === m.name.toLowerCase();
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      setSelectedMap(m.name);
                    }}
                    className={`py-1.5 px-1 rounded-xl text-[10px] font-bold text-center border transition-all cursor-pointer truncate ${
                      isSelected
                        ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20 ring-1 ring-amber-500/30'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {AVAILABLE_MAPS.slice(5).map((m) => {
                const isSelected = selectedMap.toLowerCase() === m.name.toLowerCase();
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      setSelectedMap(m.name);
                    }}
                    className={`py-1.5 px-1 rounded-xl text-[10px] font-bold text-center border transition-all cursor-pointer truncate ${
                      isSelected
                        ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20 ring-1 ring-amber-500/30'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scores Input */}
          <div className="flex items-center justify-center gap-4 pt-1">
            <div className="text-center">
              <span className="text-[10px] font-bold text-sky-400 uppercase block mb-1">Time A</span>
              <input
                type="number"
                min="0"
                max="30"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                placeholder="13"
                required
                className="w-16 h-12 bg-slate-900 border border-slate-700 rounded-xl text-center text-xl font-black font-mono text-white outline-none focus:border-sky-400"
              />
            </div>

            <span className="text-xl font-bold text-slate-600 font-mono">X</span>

            <div className="text-center">
              <span className="text-[10px] font-bold text-amber-400 uppercase block mb-1">Time B</span>
              <input
                type="number"
                min="0"
                max="30"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                placeholder="11"
                required
                className="w-16 h-12 bg-slate-900 border border-slate-700 rounded-xl text-center text-xl font-black font-mono text-white outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
          >
            Salvar Placar
          </button>
        </form>

        {/* History List */}
        <div>
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Partidas Anteriores ({history.length})
          </h4>

          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {history.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/60">
                Nenhum placar registrado ainda. Salve o primeiro acima!
              </div>
            ) : (
              history.map((h) => {
                const mapObj = AVAILABLE_MAPS.find((m) => m.name.toLowerCase() === (h.map || '').toLowerCase());
                const img = h.mapImage || mapObj?.image;

                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80"
                  >
                    <div className="flex items-center gap-2.5">
                      {img ? (
                        <img
                          src={img}
                          alt={h.map || 'Mapa'}
                          className="w-12 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs">
                          🏆
                        </span>
                      )}
                      <div>
                        <div className="font-bold text-sm text-white">Mapa: {h.map || 'Mirage'}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <Calendar size={10} /> {h.date} às {h.time}
                          </span>
                          {(h.mvpNick || h.mvp?.nick) && (
                            <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 rounded-md flex items-center gap-1 shadow-sm">
                              👑 MVP: <strong>{h.mvpNick || h.mvp?.nick}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-base font-black text-white">
                        <span className="text-sky-400">{h.scoreA}</span> - <span className="text-amber-400">{h.scoreB}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold block">
                        Vitória: {h.winner}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {onOpenGlobalHistory && (
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Quer ver todos os mixes registrados no Discord e no Hub?
            </span>
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onOpenGlobalHistory();
              }}
              className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Histórico Global (Discord + Site) ➔</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
