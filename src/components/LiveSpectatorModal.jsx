import React, { useState, useEffect, useCallback } from 'react';
import { X, Eye, Radio, Heart, Shield, Crosshair, Trophy, RefreshCw, Users, Sparkles } from 'lucide-react';
import { playClickSound } from '../utils/audio';

function formatBombBadge(bomb) {
  if (bomb === 'planted') {
    return { text: '💣 C4 PLANTADA', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse' };
  }
  if (bomb === 'defused') {
    return { text: '🛡️ C4 DESARMADA', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
  }
  if (bomb === 'exploded') {
    return { text: '💥 C4 DETONADA', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
  }
  return null;
}

function TeamSpectatorTable({ title, players = [], totalMoney = 0, aliveCount = 0, accent }) {
  const isCt = accent === 'ct';
  const borderCls = isCt ? 'border-sky-500/35' : 'border-amber-500/35';
  const headerBg = isCt ? 'bg-sky-500/10 text-sky-300' : 'bg-amber-500/10 text-amber-300';

  return (
    <div className={`rounded-2xl bg-slate-950/90 border ${borderCls} overflow-hidden flex flex-col`}>
      <div className={`px-4 py-2.5 flex items-center justify-between gap-2 border-b border-slate-800 ${headerBg}`}>
        <div className="flex items-center gap-2">
          <Shield size={14} />
          <span className="text-xs font-black uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span>Vivos: <strong>{aliveCount}/{players.length}</strong></span>
          <span className="text-emerald-300">Banco: <strong>${Number(totalMoney || 0).toLocaleString('pt-BR')}</strong></span>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500">
          Nenhum jogador detectado neste lado ainda.
        </div>
      ) : (
        <div className="divide-y divide-slate-800/70">
          {players.map((p, idx) => {
            const hp = Math.max(0, Math.min(100, Number(p.health ?? (p.isAlive ? 100 : 0))));
            const alive = Boolean(p.isAlive && hp > 0);
            return (
              <div
                key={`${p.steamId || p.name || idx}`}
                className={`px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs ${
                  alive ? 'bg-slate-950/60' : 'bg-slate-950/30 opacity-55'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        alive ? 'bg-emerald-400' : 'bg-rose-500/60'
                      }`}
                    />
                    <span className="font-bold text-white truncate">{p.name || 'Jogador'}</span>
                    {p.activeWeapon && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 truncate max-w-[95px]">
                        {p.activeWeapon}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          hp > 50 ? 'bg-emerald-400' : hp > 20 ? 'bg-amber-400' : 'bg-rose-500'
                        }`}
                        style={{ width: `${alive ? hp : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-300 flex items-center gap-1">
                      <Heart size={10} className={alive ? 'text-rose-400' : 'text-slate-600'} />
                      {alive ? hp : 'DEAD'}
                    </span>
                    {Number(p.armor || 0) > 0 && (
                      <span className="text-[10px] font-mono text-sky-300">
                        🛡️{p.armor}{p.helmet ? '+' : ''}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-emerald-300">
                      ${Number(p.money || 0).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 font-mono text-[11px]">
                  <div className="text-right">
                    <div className="font-bold text-white">
                      {p.kills || 0}/{p.deaths || 0}/{p.assists || 0}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      K/D {p.kd ?? 0}{p.mvps > 0 ? ` • ⭐${p.mvps}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Real-time Valve CS2 GSI Live Spectator Modal (score, bomb, economy & per-player HP/weapons/KDA).
 */
export default function LiveSpectatorModal({
  isOpen,
  onClose,
  roomId,
  roomName = '',
  socket,
  soundEnabled = true,
}) {
  const [gsiState, setGsiState] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/gsi/status/${encodeURIComponent(roomId)}`);
      if (res.ok) {
        const data = await res.json();
        setGsiState(data);
      }
    } catch {}
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    if (!isOpen || !roomId) return;
    setGsiState(null);
    setLoading(true);
    fetchStatus();
    const timer = setInterval(fetchStatus, 2500);
    return () => clearInterval(timer);
  }, [isOpen, roomId, fetchStatus]);

  useEffect(() => {
    if (!isOpen || !socket || !roomId) return;
    const handleGsiUpdate = (payload) => {
      if (!payload || typeof payload !== 'object') return;
      if (payload.roomId && String(payload.roomId).toUpperCase() !== String(roomId).toUpperCase()) return;
      setGsiState(payload);
      setLoading(false);
    };
    socket.emit('spectate_gsi', { roomId });
    socket.on('gsi_update', handleGsiUpdate);
    return () => {
      socket.emit('leave_spectate_gsi', { roomId });
      socket.off('gsi_update', handleGsiUpdate);
    };
  }, [isOpen, socket, roomId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const bombBadge = formatBombBadge(gsiState?.bomb);
  const connected = Boolean(gsiState?.connected);
  const teamCT = Array.isArray(gsiState?.teamCT) ? gsiState.teamCT : [];
  const teamTR = Array.isArray(gsiState?.teamTR) ? gsiState.teamTR : [];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border-2 border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/95 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
              <Eye size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black font-heading text-white flex items-center gap-2 flex-wrap">
                <span>Espectador Ao Vivo • {roomName || roomId}</span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    connected
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <Radio size={11} className={connected ? 'animate-pulse text-emerald-400' : ''} />
                  {connected ? 'GSI CONECTADO' : 'AGUARDANDO GSI'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Telemetria Valve CS2 em tempo real (placar, vida, colete, armas, K/D/A e economia)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) playClickSound();
                fetchStatus();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
              title="Atualizar agora"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) playClickSound();
                onClose();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
              title="Fechar (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Scoreboard Top Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-sky-950/60 via-slate-950 to-amber-950/60 border border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <span className="text-[10px] font-mono uppercase tracking-widest text-sky-400 block">
                Contra-Terroristas (CT)
              </span>
              <div className="text-4xl font-black font-mono text-sky-300">
                {Number(gsiState?.scoreCT ?? 0)}
              </div>
            </div>

            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white">
                <span>🗺️ {gsiState?.mapName || 'CS2 Map'}</span>
                <span className="text-slate-500">•</span>
                <span className="text-amber-300">Round {Number(gsiState?.roundNumber ?? 0)}</span>
                {gsiState?.phase && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="uppercase text-emerald-300">{gsiState.phase}</span>
                  </>
                )}
              </div>
              {bombBadge && (
                <div>
                  <span className={`inline-block text-[11px] font-mono font-black px-3 py-0.5 rounded-full border ${bombBadge.cls}`}>
                    {bombBadge.text}
                  </span>
                </div>
              )}
            </div>

            <div className="text-center sm:text-right">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 block">
                Terroristas (TR)
              </span>
              <div className="text-4xl font-black font-mono text-amber-300">
                {Number(gsiState?.scoreTR ?? 0)}
              </div>
            </div>
          </div>

          {!connected && teamCT.length === 0 && teamTR.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-2">
              <Sparkles size={26} className="mx-auto text-slate-500" />
              <div className="text-sm font-bold text-white">Aguardando transmissão ao vivo do CS2 (GSI)</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Assim que algum jogador da sala abrir o CS2 com o arquivo GSI instalado, o placar, a vida e as estatísticas aparecem automaticamente aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TeamSpectatorTable
                title="Contra-Terroristas (CT)"
                players={teamCT}
                totalMoney={gsiState?.totalMoneyCT || 0}
                aliveCount={gsiState?.aliveCountCT || teamCT.filter((p) => p.isAlive).length}
                accent="ct"
              />
              <TeamSpectatorTable
                title="Terroristas (TR)"
                players={teamTR}
                totalMoney={gsiState?.totalMoneyTR || 0}
                aliveCount={gsiState?.aliveCountTR || teamTR.filter((p) => p.isAlive).length}
                accent="tr"
              />
            </div>
          )}

          {gsiState?.topFragger && (
            <div className="rounded-2xl bg-slate-950/75 border border-amber-500/25 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <Trophy size={14} />
                <span>Top Fragger Atual: {gsiState.topFragger.name}</span>
                <span className="font-mono text-slate-300">
                  ({gsiState.topFragger.kills}K / {gsiState.topFragger.deaths}D • {gsiState.topFragger.kd} K/D)
                </span>
              </div>
              {gsiState?.matchMvp && (
                <div className="flex items-center gap-1.5 text-emerald-300 font-mono">
                  <Crosshair size={13} />
                  <span>MVP Provisório: {gsiState.matchMvp.name} ({gsiState.matchMvp.mvps}★)</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
