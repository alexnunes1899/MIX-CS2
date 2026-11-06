import React, { useState, useEffect } from 'react';
import { Layers, Plus, Users, ArrowRight, X, Sparkles, Hash } from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function RoomsHubModal({
  isOpen,
  onClose,
  currentRoomId,
  onSelectRoom,
  soundEnabled,
}) {
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCode, setNewRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
    }
  }, [isOpen]);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (e) {
      // offline fallback
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newRoomCode.trim()) return;
    if (soundEnabled) playClickSound();

    const code = newRoomCode.trim().toUpperCase().replace(/\s+/g, '-');
    onSelectRoom(code, newRoomName.trim() || `Mix ${code}`);
    onClose();
  };

  const getPhaseLabel = (phase) => {
    switch (phase) {
      case 'teams': return 'Times Formados';
      case 'captains_draft': return 'Draft de Capitães';
      case 'veto': return 'Veto de Mapas';
      case 'finished': return 'Partida Pronta';
      default: return 'No Lobby';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Layers size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading text-white">Hub de Salas de Mix</h2>
            <p className="text-xs text-slate-400">Entre em um mix existente ou crie uma nova sala para seus amigos</p>
          </div>
        </div>

        {/* Create New Room Form */}
        <form onSubmit={handleCreate} className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 mb-5 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Plus size={14} /> Criar Novo Mix
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">CÓDIGO DA SALA (URL)</label>
              <div className="relative">
                <Hash size={13} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="EX: MIX-CORUJA"
                  value={newRoomCode}
                  onChange={(e) => setNewRoomCode(e.target.value.toUpperCase())}
                  required
                  maxLength={15}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs font-mono text-white placeholder-slate-600 outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">NOME DA SALA (OPCIONAL)</label>
              <input
                type="text"
                placeholder="Ex: Mix dos Cria"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                maxLength={25}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
          >
            <Sparkles size={14} />
            <span>Criar Sala e Entrar</span>
          </button>
        </form>

        {/* Existing Rooms List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Salas Ativas no Momento ({rooms.length})
            </span>
            <button
              onClick={fetchRooms}
              className="text-[11px] text-amber-400 hover:underline cursor-pointer"
            >
              Atualizar lista
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {rooms.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/60">
                Nenhuma outra sala ativa no momento. Crie a sua acima!
              </div>
            ) : (
              rooms.map((r) => {
                const isCurrent = r.id === currentRoomId;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-amber-500/10 border-amber-500/50 text-white'
                        : 'bg-slate-950/60 hover:bg-slate-800/60 border-slate-800 text-slate-200 cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!isCurrent) {
                        if (soundEnabled) playClickSound();
                        onSelectRoom(r.id, r.name);
                        onClose();
                      }
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{r.name}</span>
                        <span className="font-mono text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                          #{r.id}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {getPhaseLabel(r.phase)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs font-semibold text-slate-300">
                        <Users size={13} className="text-amber-400" />
                        <span>{r.playerCount}/10</span>
                      </div>

                      {isCurrent ? (
                        <span className="text-[10px] uppercase font-bold text-amber-400 px-2 py-1 rounded bg-amber-500/20">
                          Sala Atual
                        </span>
                      ) : (
                        <button className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white">
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
