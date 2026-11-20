import React, { useState } from 'react';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import PlayerAvatar from './PlayerAvatar';
import ServerConnectBar from './ServerConnectBar';
import { Users, Trash2, Bot, Scale, Shuffle, Shield, Flame, CheckCircle2, Crown, Check, AlertCircle, Zap, Lock, Globe, Share2, Layers, Copy, Hash, Eye, Sparkles, Bell, Clock, UserX, ArrowLeftRight } from 'lucide-react';
import { playClickSound, playReadySound } from '../utils/audio';
import { copyText, buildRoomInviteData } from '../utils/clipboard';

export default function Lobby({
  players = [],
  myProfile,
  rankingSystem = 'gc',
  onChangeRankingSystem,
  onToggleReady,
  onRemovePlayer,
  onFillMockBots,
  onClearPlayers,
  onDrawTeams,
  onStartCaptainDraft,
  onOpenQuickVeto,
  onOpenQuickMapRoll,
  onOpenDiscordModal,
  onOpenGrenades,
  onOpenAimReflex,
  onOpenTournament,
  serverIp = '',
  onUpdateServerIp,
  rconPassword = '',
  onUpdateRconPassword,
  roomId = 'MIX-PRO',
  roomName = '',
  liveMatch = null,
  onOpenGsiSetup,
  onOpenServersPage,
  soundEnabled,
  isAdmin = false,
  adminId = null,
  onKickPlayer,
  onAdminChangeSide,
  roomPassword = '',
  isPrivate = false,
  hasPassword = false,
  inviteKey = '',
  readyCheck = null,
  onStartReadyCheck,
  onAcceptReadyCheck,
  onCancelReadyCheck,
  onKickAfkReadyCheck,
}) {
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [showLobbyPassword, setShowLobbyPassword] = useState(false);
  const [readySecondsLeft, setReadySecondsLeft] = useState(null);

  React.useEffect(() => {
    if (!readyCheck?.active || !readyCheck?.expiresAt) {
      setReadySecondsLeft(null);
      return;
    }
    const update = () => {
      setReadySecondsLeft(Math.max(0, Math.ceil((readyCheck.expiresAt - Date.now()) / 1000)));
    };
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [readyCheck?.active, readyCheck?.expiresAt]);

  const maxSlots = 10;
  const emptySlots = Math.max(0, maxSlots - players.length);
  const isFaceit = rankingSystem === 'faceit';

  // Gamers Club stats
  const totalLevel = players.reduce((acc, p) => acc + (Number(p.level) || 1), 0);
  const avgLevel = players.length > 0 ? (totalLevel / players.length).toFixed(1) : 0;

  // FACEIT stats
  const totalFaceit = players.reduce((acc, p) => acc + (Number(p.faceitLevel) || (p.level <= 10 ? p.level : Math.round(p.level / 2.1)) || 5), 0);
  const avgFaceit = players.length > 0 ? (totalFaceit / players.length).toFixed(1) : 0;
  const playersWithElo = players.filter((p) => p.faceitElo);
  const avgElo = playersWithElo.length > 0 ? Math.round(playersWithElo.reduce((acc, p) => acc + Number(p.faceitElo), 0) / playersWithElo.length) : null;

  const readyCount = players.filter((p) => p.ready).length;

  const myPlayer = players.find((p) => p.id === myProfile?.id || (p.nick && p.nick === myProfile?.nick));
  const isMyPlayerReady = myPlayer?.ready || false;

  const handleCopyInviteLink = () => {
    if (soundEnabled) playClickSound();
    const { inviteText } = buildRoomInviteData({
      roomId,
      roomName,
      isPrivate,
      inviteKey,
      rankingSystem,
      playerCount: players.length,
      maxSlots,
    });
    copyText(inviteText);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleCopyUser = () => {
    if (soundEnabled) playClickSound();
    copyText(roomId);
    setCopiedUser(true);
    setTimeout(() => setCopiedUser(false), 2000);
  };

  const handleMyReadyToggle = () => {
    if (soundEnabled) playReadySound();
    if (myPlayer) {
      onToggleReady(myPlayer.id);
    }
  };

  return (
    <div className="space-y-6 pb-24 sm:pb-12">
      {/* Spectator Notice Banner when not logged in */}
      {!myProfile?.steamId && (
        <div className="bg-sky-950/35 border border-sky-500/35 rounded-2xl px-4 py-3 flex items-center gap-2.5 text-xs text-sky-200 shadow-sm">
          <Eye size={16} className="text-sky-400 shrink-0" />
          <span>
            <strong>Modo Espectador:</strong> Você está visualizando a sala em tempo real. Faça login com a <strong>Steam</strong> ao lado para garantir sua vaga na fila.
          </span>
        </div>
      )}

      {/* Compact Room Info & Invite Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 shadow-lg backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5 min-w-0">
            <Layers size={14} className="text-amber-400 shrink-0" />
            <span className="text-amber-400 font-bold truncate max-w-[200px]">{roomName || roomId}</span>
          </span>

          {isPrivate ? (
            <span className="text-[10px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono shrink-0">
              <Lock size={10} /> Privado
            </span>
          ) : (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono shrink-0">
              <Globe size={10} /> Público
            </span>
          )}

          {isAdmin && (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono shrink-0">
              <Crown size={10} className="text-amber-400" /> Admin
            </span>
          )}

          <button
            type="button"
            onClick={handleCopyUser}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950/90 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-mono font-bold text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Copiar código identificador da sala"
          >
            <Hash size={11} className="text-amber-400" />
            <span>{roomId}</span>
            {copiedUser ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} className="text-slate-500" />}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {onOpenDiscordModal && (
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) playClickSound();
                onOpenDiscordModal();
              }}
              className="px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Configurar Notificações no Discord (Avisar quando fechar 10/10)"
            >
              <Bell size={14} className="text-indigo-400" />
              <span>Discord</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title={isPrivate ? 'Copiar link de acesso exclusivo para convidados' : 'Copiar link para amigos entrarem'}
          >
            {copiedInvite ? <Check size={14} className="text-slate-950" /> : <Share2 size={14} />}
            <span>{copiedInvite ? 'Copiado!' : 'Copiar Link'}</span>
          </button>
        </div>
      </div>

      {/* Top Banner & Quick Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
              <Users size={20} className="text-amber-400" />
              Lobby de Jogadores ({players.length}/{maxSlots})
            </h2>

            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                readyCount === maxSlots && players.length === maxSlots
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}
            >
              <CheckCircle2 size={12} /> {readyCount}/{players.length} Prontos
            </span>

            {/* Ranking System Switcher Pill */}
            {onChangeRankingSystem && (
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  onChangeRankingSystem(isFaceit ? 'gc' : 'faceit');
                }}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 border transition-all cursor-pointer ${
                  isFaceit
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 hover:bg-orange-500/30'
                    : 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                }`}
                title="Clique para alternar entre ranking da Gamers Club (1-21) e FACEIT (1-10)"
              >
                {isFaceit ? <Zap size={11} /> : <Shield size={11} />}
                <span>Ranking: {isFaceit ? 'FACEIT' : 'Gamers Club'}</span>
                <ArrowLeftRight size={9} className="opacity-70" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
            {isFaceit ? (
              <>
                <span>Média FACEIT: <strong className="text-orange-400 font-mono">Nv {avgFaceit}</strong></span>
                {avgElo && (
                  <>
                    <span>•</span>
                    <span>Média ELO: <strong className="text-orange-300 font-mono">{avgElo}</strong></span>
                  </>
                )}
                <span>•</span>
                <span className="text-[11px] text-slate-500">Puxado da Steam</span>
              </>
            ) : (
              <>
                <span>Média Gamers Club: <strong className="text-amber-400 font-mono">Nv {avgLevel}</strong></span>
                <span>•</span>
                <span className="text-[11px] text-slate-500">Distribuição Oficial 1-21</span>
              </>
            )}
          </div>

          {/* 10-Slot Capacity Segmented Bar */}
          <div className="mt-2.5 flex items-center gap-1 max-w-xs" aria-label={`Capacidade ${players.length} de ${maxSlots}`}>
            {Array.from({ length: maxSlots }).map((_, slotIdx) => {
              const player = players[slotIdx];
              return (
                <div
                  key={slotIdx}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    player
                      ? player.ready
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                        : 'bg-amber-400'
                      : 'bg-slate-800'
                  }`}
                  title={player ? `${player.nick} (${player.ready ? 'Pronto' : 'Aguardando'})` : `Vaga #${slotIdx + 1} livre`}
                />
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Ready / Cancel Ready Button for Myself */}
          {myPlayer && (
            <button
              onClick={handleMyReadyToggle}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md ${
                isMyPlayerReady
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30 shadow-emerald-500/20'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25 active:scale-95'
              }`}
            >
              <CheckCircle2 size={14} />
              <span>{isMyPlayerReady ? 'Pronto! (Cancelar)' : 'Ficar Pronto'}</span>
            </button>
          )}

          {isAdmin && (
            <>
              {onStartReadyCheck && (
                <button
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    onStartReadyCheck(30);
                  }}
                  disabled={players.length < 2 || Boolean(readyCheck?.active)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Enviar confirmação cronometrada (30s) para todos os jogadores do lobby"
                >
                  <Clock size={14} className="text-emerald-400" />
                  <span className="hidden sm:inline">Ready Check (30s)</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  onFillMockBots();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
                title="Preencher com bots de teste para balanceamento rápido"
              >
                <Bot size={14} className="text-amber-400" />
                <span className="hidden sm:inline">Preencher Bots</span>
              </button>

              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  onClearPlayers();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-all cursor-pointer"
                title="Limpar todos os jogadores do lobby"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Server Connect Bar */}
      <ServerConnectBar
        serverIp={serverIp}
        onUpdateServerIp={onUpdateServerIp}
        rconPassword={rconPassword}
        onUpdateRconPassword={onUpdateRconPassword}
        roomId={roomId}
        liveMatch={liveMatch}
        onOpenGsiSetup={onOpenGsiSetup}
        onOpenServersPage={onOpenServersPage}
        soundEnabled={soundEnabled}
        isAdmin={isAdmin}
      />

      {/* Timed Ready Check Banner */}
      {readyCheck && (readyCheck.active || readyCheck.status === 'expired') && (() => {
        const confirmedSet = new Set(readyCheck.confirmedIds || []);
        const isConfirmed = myPlayer && (myPlayer.ready || confirmedSet.has(myPlayer.id));
        const missingPlayers = players.filter((p) => !p.ready && !confirmedSet.has(p.id) && !String(p.id).startsWith('bot-'));
        const confirmedCount = players.filter((p) => p.ready || confirmedSet.has(p.id)).length;

        return (
          <div
            className={`rounded-2xl p-4 border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl ${
              readyCheck.active
                ? 'bg-emerald-950/40 border-emerald-500/60 shadow-emerald-500/10'
                : 'bg-rose-950/40 border-rose-500/60 shadow-rose-500/10'
            }`}
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Bell size={16} className={readyCheck.active ? 'text-emerald-400 animate-bounce' : 'text-rose-400'} />
                <span className="font-heading font-black text-sm uppercase tracking-wider text-white">
                  {readyCheck.active ? 'Ready Check em Andamento!' : 'Ready Check Expirado'}
                </span>
                {readyCheck.active && readySecondsLeft !== null && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${
                      readySecondsLeft <= 5
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    ⏱️ {readySecondsLeft}s
                  </span>
                )}
                <span className="text-xs font-mono text-slate-300">
                  {confirmedCount}/{players.length} confirmados
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {readyCheck.active
                  ? missingPlayers.length > 0
                    ? `Aguardando: ${missingPlayers.map((p) => p.nick).join(', ')}`
                    : 'Todos os jogadores confirmaram presença!'
                  : missingPlayers.length > 0
                  ? `Jogadores ausentes (AFK): ${missingPlayers.map((p) => p.nick).join(', ')}`
                  : 'Ready Check encerrado.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {readyCheck.active && myPlayer && !isConfirmed && onAcceptReadyCheck && (
                <button
                  type="button"
                  onClick={() => {
                    if (soundEnabled) playReadySound();
                    onAcceptReadyCheck();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 cursor-pointer animate-pulse"
                >
                  <CheckCircle2 size={15} />
                  <span>Confirmar Agora!</span>
                </button>
              )}

              {readyCheck.status === 'expired' && isAdmin && missingPlayers.length > 0 && onKickAfkReadyCheck && (
                <button
                  type="button"
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    onKickAfkReadyCheck();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <UserX size={14} />
                  <span>Expulsar Ausentes ({missingPlayers.length})</span>
                </button>
              )}

              {isAdmin && onCancelReadyCheck && (
                <button
                  type="button"
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    onCancelReadyCheck();
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  {readyCheck.active ? 'Cancelar' : 'Fechar'}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Players Grid (10 Slots — 2 Roomy Horizontal Columns on sm+) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {players.map((p, idx) => {
          const isMe = p.id === myProfile?.id || (p.nick && p.nick === myProfile?.nick);
          const isSlotAdmin = adminId && p.id === adminId;

          return (
            <div
              key={p.id || idx}
              className={`relative overflow-hidden bg-slate-900/90 border rounded-2xl p-3.5 pt-4 flex flex-col justify-between gap-2.5 transition-all group ${
                p.ready
                  ? 'border-emerald-500/45 shadow-md shadow-emerald-500/10'
                  : 'border-slate-800 hover:border-slate-700'
              } ${isMe ? 'ring-2 ring-amber-500/45 bg-slate-900' : ''}`}
            >
              {/* Top Status Accent Strip */}
              <div
                className={`absolute top-0 inset-x-0 h-1 ${
                  p.ready ? 'bg-emerald-400' : isMe ? 'bg-amber-400' : 'bg-slate-800'
                }`}
              />

              {/* Row 1: Identity & Skill Badge */}
              <div className="flex items-center justify-between gap-2.5 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <PlayerAvatar avatar={p.avatar} size="md" />
                    {isSlotAdmin && (
                      <div
                        className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center border border-amber-400/80 shadow-md z-10"
                        title="Administrador / Criador da Sala"
                      >
                        <Crown size={9} className="fill-amber-400/30" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-sm text-white truncate" title={p.nick}>
                        {p.nick}
                      </span>
                      {isMe && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded shrink-0">
                          VOCÊ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        Slot #{idx + 1}
                      </span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          p.ready ? 'bg-emerald-400' : 'bg-slate-600'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Skill Badge & CS2 Hours */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.cs2Hours && (
                    <span
                      className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold shrink-0"
                      title={`${p.cs2Hours.toLocaleString('pt-BR')} horas no CS2`}
                    >
                      {p.cs2Hours.toLocaleString('pt-BR')}h
                    </span>
                  )}
                  {isFaceit ? (
                    <FaceitBadge level={p.faceitLevel} elo={p.faceitElo} size="sm" showElo={false} />
                  ) : (
                    <GCBadge level={p.level} size="sm" />
                  )}
                </div>
              </div>

              {/* Row 2: Side Selector & Ready / Action Controls */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-semibold text-slate-400 shrink-0">Lado:</span>
                  {isAdmin && onAdminChangeSide ? (
                    <div className="grid grid-cols-3 gap-0.5 bg-slate-950 border border-slate-800 rounded-lg p-0.5 w-[124px]">
                      <button
                        type="button"
                        onClick={() => onAdminChangeSide(p.id, 'CT')}
                        className={`py-0.5 rounded text-[10px] font-bold text-center transition-colors cursor-pointer ${
                          p.side === 'CT' ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title="Fixar no lado CT"
                      >
                        CT
                      </button>
                      <button
                        type="button"
                        onClick={() => onAdminChangeSide(p.id, 'TR')}
                        className={`py-0.5 rounded text-[10px] font-bold text-center transition-colors cursor-pointer ${
                          p.side === 'TR' ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title="Fixar no lado TR"
                      >
                        TR
                      </button>
                      <button
                        type="button"
                        onClick={() => onAdminChangeSide(p.id, 'ANY')}
                        className={`py-0.5 rounded text-[10px] font-bold text-center transition-colors cursor-pointer ${
                          !p.side || p.side === 'ANY' ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title="Qualquer lado (Flex / Automático)"
                      >
                        Flex
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] shrink-0 ${
                        p.side === 'CT'
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          : p.side === 'TR'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {!p.side || p.side === 'ANY' ? 'Flex' : p.side}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {(isMe || isAdmin) ? (
                    <button
                      onClick={() => {
                        if (soundEnabled) playReadySound();
                        onToggleReady(p.id);
                      }}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        p.ready
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                      }`}
                      title={isMe ? 'Alternar meu status de pronto' : 'Alternar status (Admin)'}
                    >
                      {p.ready ? 'Pronto ✓' : 'Aguardando'}
                    </button>
                  ) : (
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg select-none ${
                        p.ready
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-950 text-slate-500 border border-slate-800'
                      }`}
                    >
                      {p.ready ? 'Pronto ✓' : 'Aguardando'}
                    </span>
                  )}

                  {(isAdmin || isMe) && (
                    <button
                      onClick={() => {
                        if (soundEnabled) playClickSound();
                        if (isAdmin && !isMe && onKickPlayer) {
                          onKickPlayer(p.id);
                        } else {
                          onRemovePlayer(p.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title={isAdmin && p.id !== myProfile?.id ? 'Expulsar jogador da sala (Admin)' : 'Sair da sala'}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty Slot Placeholders (Horizontal Rhythm Match) */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="border-2 border-dashed border-slate-800/70 hover:border-amber-500/35 rounded-2xl px-4 py-3 flex items-center justify-between min-h-[86px] text-slate-600 bg-slate-950/30 hover:bg-slate-900/40 transition-all select-none group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 group-hover:border-amber-500/40 flex items-center justify-center text-slate-500 group-hover:text-amber-400 transition-colors shrink-0">
                <Users size={15} />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-slate-400 block">
                  Vaga #{players.length + i + 1}
                </span>
                <span className="text-[11px] text-slate-600 block">Livre para entrar</span>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border border-slate-800/80 text-slate-500">
              Aberta
            </span>
          </div>
        ))}
      </div>

      {/* Draw Action Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Scale size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Formação de Equipes</h3>
            <p className="text-xs text-slate-400">
              {players.length < 2
                ? 'Necessário no mínimo 2 jogadores para iniciar'
                : isAdmin
                ? `Pronto para sortear equipes usando ranking ${isFaceit ? 'FACEIT' : 'Gamers Club'}`
                : 'O líder da sala iniciará o sorteio quando os jogadores estiverem prontos'}
            </p>
          </div>
        </div>

        {isAdmin ? (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Balanced Draw */}
            <button
              onClick={() => onDrawTeams('balanced')}
              disabled={players.length < 2}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              title="Calcular os times com o menor desbalanceamento de nível possível"
            >
              <Scale size={16} />
              <span>Sorteio Equilibrado ({isFaceit ? 'FACEIT' : 'GC'})</span>
            </button>

            {/* Captains 1v1 Draft */}
            <button
              onClick={onStartCaptainDraft}
              disabled={players.length < 4}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 hover:border-amber-400 text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              title="Capitães escolhem os jogadores alternadamente no estilo 1v1 Draft"
            >
              <Crown size={15} className="text-amber-400" />
              <span>Draft 1v1</span>
            </button>

            {/* Random Shuffle */}
            <button
              onClick={() => onDrawTeams('random')}
              disabled={players.length < 2}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Sorteio 100% Aleatório (Sem levar em consideração o nível)"
            >
              <Shuffle size={16} />
            </button>
          </div>
        ) : (
          <div className="px-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 flex items-center gap-2 shrink-0">
            <Crown size={14} className="text-amber-400 shrink-0" />
            <span>
              Aguardando{' '}
              <strong className="text-amber-300">
                {players.find((p) => p.id === adminId)?.nick || 'o líder da sala'}
              </strong>{' '}
              sortear os times...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
