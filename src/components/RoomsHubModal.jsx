import React, { useState, useEffect } from 'react';
import { Layers, Plus, Users, ArrowRight, X, Sparkles, Hash, Lock, Shield, Zap, Server, Trash2, Dices, Eye, EyeOff, KeyRound, Globe, Link2 } from 'lucide-react';
import SteamIcon from './SteamIcon';
import DeleteRoomModal from './DeleteRoomModal';
import { playClickSound } from '../utils/audio';
import { generateRoomCredentials, generateRoomUser, generateRoomPassword } from '../utils/roomCredentials';

export default function RoomsHubModal({
  isOpen,
  onClose,
  currentRoomId,
  onSelectRoom,
  onDeleteRoom,
  soundEnabled,
  isSteamLogged = false,
  onRequireSteamLogin,
  myProfile,
}) {
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newServerIp, setNewServerIp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false); // Default: false = Mix Público (like GC default)
  const [rankingSystem, setRankingSystem] = useState('gc'); // 'gc' | 'faceit'
  const [loading, setLoading] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
      // Auto-generate room credentials with creator nick (e.g. Alex -> "Time Alex", "TIME-ALEX")
      const creds = generateRoomCredentials(myProfile?.nick);
      setNewRoomCode(creds.roomUser);
      setNewPassword(creds.roomPassword);
      setNewRoomName(creds.suggestedName);
    }
  }, [isOpen, myProfile?.nick]);

  const handleGenerateAll = () => {
    if (soundEnabled) playClickSound();
    const creds = generateRoomCredentials(myProfile?.nick);
    setNewRoomCode(creds.roomUser);
    setNewPassword(creds.roomPassword);
    setNewRoomName(creds.suggestedName);
  };

  const handleGenerateUserOnly = () => {
    if (soundEnabled) playClickSound();
    const user = generateRoomUser(myProfile?.nick);
    setNewRoomCode(user);
    if (myProfile?.nick) {
      setNewRoomName(`Time ${myProfile.nick.trim()}`);
    } else {
      setNewRoomName(`Mix ${user.replace('MIX-', '').replace('TIME-', '')}`);
    }
  };

  const handleGeneratePasswordOnly = () => {
    if (soundEnabled) playClickSound();
    setNewPassword(generateRoomPassword());
  };

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

    if (!isSteamLogged) {
      if (onRequireSteamLogin) {
        onRequireSteamLogin('criar uma nova sala de mix');
      } else {
        window.location.href = '/api/auth/steam';
      }
      return;
    }

    if (soundEnabled) playClickSound();

    const code = newRoomCode.trim().toUpperCase().replace(/\s+/g, '-');
    const defaultName = myProfile?.nick ? `Time ${myProfile.nick.trim()}` : `Mix ${code}`;
    onSelectRoom(
      code,
      newRoomName.trim() || defaultName,
      rankingSystem,
      newServerIp.trim(),
      newPassword.trim(),
      isPrivate
    );
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
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 mb-5 pr-10">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
            <Layers size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold font-heading text-white truncate">Hub de Salas de Mix (Estilo GC)</h2>
            <p className="text-[11px] sm:text-xs text-slate-400">Crie mix público para a comunidade ou privado exclusivo via link</p>
          </div>
        </div>

        {/* Create New Room Form */}
        <form onSubmit={handleCreate} className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 mb-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <Plus size={14} /> Criar Novo Mix
            </div>
            {!isSteamLogged && (
              <span className="text-[10px] text-amber-300 font-bold bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Lock size={10} /> Requer Steam
              </span>
            )}
          </div>

          {/* Gamers Club Style Lobby Type Selector: Mix Público vs Mix Privado */}
          <div>
            <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wide block mb-1.5">
              Tipo de Sala (Gamers Club)
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Public Mix */}
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  setIsPrivate(false);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  !isPrivate
                    ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                    <Globe size={14} /> Mix Público
                  </span>
                  {!isPrivate && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                  )}
                </div>
                <p className="text-[10px] text-slate-300 leading-tight">
                  Aparece no Hub. <strong>Qualquer pessoa pode entrar</strong> livremente.
                </p>
              </button>

              {/* Private Mix */}
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  setIsPrivate(true);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  isPrivate
                    ? 'bg-purple-500/15 border-purple-500 text-white shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-purple-300 flex items-center gap-1.5">
                    <Lock size={14} /> Mix Privado
                  </span>
                  {isPrivate && (
                    <span className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400" />
                  )}
                </div>
                <p className="text-[10px] text-slate-300 leading-tight">
                  Oculto da lista pública. <strong>Só entra quem tiver o link direto</strong>.
                </p>
              </button>
            </div>
          </div>

          {/* Gamers Club Explanation Notice */}
          <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-colors ${
            isPrivate
              ? 'bg-purple-500/10 border-purple-500/30 text-purple-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          }`}>
            {isPrivate ? (
              <Lock size={15} className="text-purple-400 shrink-0 mt-0.5" />
            ) : (
              <Globe size={15} className="text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <span className="font-bold block">
                {isPrivate ? '🔒 Modo Privado Selecionado:' : '🌐 Modo Público Selecionado:'}
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {isPrivate
                  ? 'A sala ficará oculta da lista do Hub. Apenas seus amigos que receberem o Link Direto de Convite entrarão automaticamente.'
                  : 'Sua sala aparecerá na lista de Salas Ativas para qualquer jogador da comunidade encontrar e entrar com 1 clique.'}
              </p>
            </div>
          </div>

          {/* Room User and Name inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-400 font-semibold block">CÓDIGO / IDENTIFICADOR</label>
                <button
                  type="button"
                  onClick={handleGenerateUserOnly}
                  className="text-[10px] text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Dices size={10} /> Gerar
                </button>
              </div>
              <div className="relative flex items-center">
                <Hash size={13} className="absolute left-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="EX: MIX-CORUJA-42"
                  value={newRoomCode}
                  onChange={(e) => setNewRoomCode(e.target.value.toUpperCase())}
                  required
                  maxLength={20}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs font-mono font-bold text-white placeholder-slate-600 outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-400 font-semibold block uppercase">Nome do Mix / Sala</label>
                {myProfile?.nick && (
                  <span className="text-[9px] text-amber-400 font-mono">
                    Líder: {myProfile.nick}
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder={myProfile?.nick ? `Ex: Time ${myProfile.nick}` : 'Ex: Time Alex'}
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                maxLength={30}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 font-bold"
              />
            </div>
          </div>

          {/* Optional Password only for private or special rooms */}
          {isPrivate && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Senha da Sala (Opcional)
                </label>
                <span className="text-[9px] text-slate-500 font-mono">Deixe em branco para usar apenas o link</span>
              </div>
              <div className="relative flex items-center">
                <KeyRound size={13} className="absolute left-3 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="PIN opcional (Ex: 7492)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  maxLength={20}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-9 py-2 text-xs font-mono text-white placeholder-slate-600 outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}

          {/* Ranking System Selector: GC (Manual) vs FACEIT (Auto) */}
          <div>
            <label className="text-[10px] text-slate-400 font-semibold block mb-1.5 uppercase">
              Sistema de Nível das Equipes
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRankingSystem('gc')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  rankingSystem === 'gc'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm ring-1 ring-amber-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-xs text-amber-400 flex items-center gap-1">
                    <Shield size={12} /> Gamers Club
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded">
                    1 a 21
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Inserido manualmente pelo jogador via barra
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRankingSystem('faceit')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  rankingSystem === 'faceit'
                    ? 'bg-orange-500/15 border-orange-500 text-white shadow-sm ring-1 ring-orange-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-xs text-orange-400 flex items-center gap-1">
                    <Zap size={12} /> FACEIT
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-orange-500/20 text-orange-300 px-1.5 py-0.2 rounded whitespace-nowrap shrink-0">
                    Auto 1-10
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Puxa nível e ELO automaticamente via Steam
                </p>
              </button>
            </div>
          </div>

          {/* Dedicated CS2 Server Configuration */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-slate-400 font-semibold block uppercase">
                Servidor do Mix (IP / Connect) - Opcional
              </label>
              <span className="text-[9px] text-slate-500 font-mono">1-Clique ou Console</span>
            </div>
            <div className="relative">
              <Server size={13} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Ex: 189.1.168.10:27015 ou connect 189.1.168.10:27015; password mix"
                value={newServerIp}
                onChange={(e) => setNewServerIp(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs font-mono text-white placeholder-slate-600 outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {!isSteamLogged ? (
            <button
              type="button"
              onClick={() => {
                if (onRequireSteamLogin) {
                  onRequireSteamLogin('criar uma sala');
                } else {
                  window.location.href = '/api/auth/steam';
                }
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#171a21] via-[#1b2838] to-[#2a475e] hover:from-[#1b2838] text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-[#66c0f4]/40 shadow-md cursor-pointer"
            >
              <SteamIcon className="w-4 h-4 text-[#66c0f4]" />
              <span>Login Steam Necessário para Criar</span>
            </button>
          ) : (
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95"
            >
              <Sparkles size={14} />
              <span>{isPrivate ? 'Criar Mix Privado (Link)' : 'Criar Mix Público'}</span>
            </button>
          )}
        </form>

        {/* Existing Rooms List (Public Rooms) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Globe size={13} className="text-emerald-400" />
              Mixes Públicos Ativos ({rooms.length})
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
                Nenhum mix público aberto no momento. Crie o seu acima!
              </div>
            ) : (
              rooms.map((r) => {
                const isCurrent = r.id === currentRoomId;
                const isFaceit = r.rankingSystem === 'faceit';
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
                        onSelectRoom(r.id, r.name, r.rankingSystem, r.serverIp, null, false);
                        onClose();
                      }
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">{r.name}</span>
                        <span className="font-mono text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                          #{r.id}
                        </span>
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono flex items-center gap-1">
                          <Globe size={9} /> Público
                        </span>
                        {isFaceit ? (
                          <span className="text-[9px] font-bold text-orange-400 bg-orange-500/15 border border-orange-500/30 px-1.5 py-0.2 rounded font-mono">
                            ⚡ FACEIT
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono">
                            🛡️ GC
                          </span>
                        )}
                        {Boolean(r.hasServer || r.serverIp) && (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono flex items-center gap-1">
                            <Server size={9} /> Servidor
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {getPhaseLabel(r.phase)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1 text-xs font-semibold text-slate-300">
                        <Users size={13} className="text-amber-400" />
                        <span>{r.playerCount}/10</span>
                      </div>

                      {/* Excluir Sala Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (soundEnabled) playClickSound();
                          setRoomToDelete(r);
                        }}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/60 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                        title={`Excluir sala ${r.name || r.id}`}
                      >
                        <Trash2 size={13} />
                      </button>

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

        {/* Delete Confirmation Modal */}
        <DeleteRoomModal
          isOpen={Boolean(roomToDelete)}
          onClose={() => setRoomToDelete(null)}
          onConfirm={(roomId) => {
            if (onDeleteRoom) {
              onDeleteRoom(roomId);
            }
            setRooms((prev) => prev.filter((r) => r.id !== roomId));
            setRoomToDelete(null);
          }}
          roomId={roomToDelete?.id || ''}
          roomName={roomToDelete?.name || ''}
          soundEnabled={soundEnabled}
        />
      </div>
    </div>
  );
}
