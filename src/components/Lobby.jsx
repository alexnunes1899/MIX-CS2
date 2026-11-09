import React, { useState } from 'react';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import PlayerAvatar from './PlayerAvatar';
import ServerConnectBar from './ServerConnectBar';
import { Users, Trash2, Bot, Scale, Shuffle, Shield, Flame, CheckCircle2, Crown, Check, AlertCircle, Zap, Dices, ArrowLeftRight, Lock, Globe, Share2, Layers, Copy, KeyRound, Hash, Eye, EyeOff, Sparkles, Bell, BookOpen, Target, Trophy, Server } from 'lucide-react';
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
}) {
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [showLobbyPassword, setShowLobbyPassword] = useState(false);

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
      {/* Room Security & Privacy Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3 backdrop-blur">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Layers size={14} className="text-amber-400" />
                Mix: <span className="text-amber-400 font-bold truncate max-w-[200px]">{roomName || roomId}</span>
                {roomName && roomName !== roomId && (
                  <span className="text-slate-500 font-mono text-[10px]">({roomId})</span>
                )}
              </span>

              {isPrivate ? (
                <span className="text-[10px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                  <Lock size={10} /> Privado (Só via Link)
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                  <Globe size={10} /> Mix Público
                </span>
              )}

              {isAdmin && (
                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                  <Crown size={10} className="text-amber-400" /> Admin
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {isPrivate
                ? 'Sala privada sem senha. Os jogadores entram exclusivamente abrindo o Link de Convite.'
                : 'Mix público aberto. Qualquer jogador da comunidade pode entrar pelo Hub ou pelo link.'}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
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

        {/* Room Identity & Direct Invite Link Bar (No Password Needed) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
          {/* Room Identifier */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Hash size={14} className="text-amber-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Código Identificador</span>
                <span className="text-xs font-mono font-bold text-white truncate block">{roomId}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyUser}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-1 shrink-0"
              title="Copiar Código da Sala"
            >
              {copiedUser ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copiedUser ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>

          {/* Direct Invite Link Status */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isPrivate ? (
                <Lock size={14} className="text-purple-400 shrink-0" />
              ) : (
                <Globe size={14} className="text-emerald-400 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Modo de Entrada</span>
                <span className={`text-xs font-mono font-bold truncate block ${isPrivate ? 'text-purple-300' : 'text-emerald-300'}`}>
                  {isPrivate ? 'Somente pelo Link Direto' : 'Aberto / Link Direto'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-1 shrink-0"
              title="Copiar Link Direto de Convite"
            >
              {copiedInvite ? <Check size={12} className="text-emerald-400" /> : <Share2 size={12} />}
              <span>{copiedInvite ? 'Link Copiado!' : 'Copiar Link'}</span>
            </button>
          </div>
        </div>

        {/* Informative Note */}
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
          <Sparkles size={12} className="text-amber-400 shrink-0" />
          <span>
            {isPrivate
              ? <>Sala privada: envie o <strong>Link de Convite</strong> para seus amigos — só entra quem abrir pelo link!</>
              : <>Envie o <strong>Link de Convite</strong> para seus amigos entrarem direto na sala com 1 clique!</>}
          </span>
        </div>
      </div>

      {/* Quick Mode Shortcuts Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          onClick={() => {
            if (soundEnabled) playClickSound();
            onOpenQuickVeto();
          }}
          className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/50 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Zap size={18} />
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-white group-hover:text-sky-300 transition-colors">
                Times Já Montados?
              </h4>
              <p className="text-[11px] text-slate-400">Ir direto para o Pick & Ban de Mapas</p>
            </div>
          </div>
          <span className="text-xs font-bold text-sky-400 group-hover:translate-x-1 transition-transform">➔</span>
        </div>

        <div
          onClick={() => {
            if (soundEnabled) playClickSound();
            onOpenQuickMapRoll();
          }}
          className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Dices size={18} />
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-white group-hover:text-amber-300 transition-colors">
                Sorteio Rápido de Mapa
              </h4>
              <p className="text-[11px] text-slate-400">Roleta oficial ou com Train e extras</p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">➔</span>
        </div>

        {/* Tactical Grenade Playbook */}
        {onOpenGrenades && (
          <div
            onClick={() => {
              if (soundEnabled) playClickSound();
              onOpenGrenades();
            }}
            className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <BookOpen size={18} />
              </div>
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-white group-hover:text-emerald-300 transition-colors">
                  Guia de Granadas
                </h4>
                <p className="text-[11px] text-slate-400">Smokes e táticas de cada mapa</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">➔</span>
          </div>
        )}

        {/* Aim Warmup Mini-Game */}
        {onOpenAimReflex && (
          <div
            onClick={() => {
              if (soundEnabled) playClickSound();
              onOpenAimReflex();
            }}
            className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-orange-500/50 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Target size={18} />
              </div>
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-white group-hover:text-orange-300 transition-colors">
                  Aquecer Mira & Reflexo
                </h4>
                <p className="text-[11px] text-slate-400">Teste em ms e treino de flick</p>
              </div>
            </div>
            <span className="text-xs font-bold text-orange-400 group-hover:translate-x-1 transition-transform">➔</span>
          </div>
        )}

        {/* Tournament Bracket Mode */}
        {onOpenTournament && (
          <div
            onClick={() => {
              if (soundEnabled) playClickSound();
              onOpenTournament();
            }}
            className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Trophy size={18} />
              </div>
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-white group-hover:text-purple-300 transition-colors">
                  Modo Torneio
                </h4>
                <p className="text-[11px] text-slate-400">Chaveamento 4, 8 ou 16 equipes</p>
              </div>
            </div>
            <span className="text-xs font-bold text-purple-400 group-hover:translate-x-1 transition-transform">➔</span>
          </div>
        )}

        {/* Dedicated Servers Hub */}
        {onOpenServersPage && (
          <div
            onClick={() => {
              if (soundEnabled) playClickSound();
              onOpenServersPage();
            }}
            className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Server size={18} />
              </div>
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-white group-hover:text-emerald-300 transition-colors">
                  Central de Servidores
                </h4>
                <p className="text-[11px] text-slate-400">Host 0ms, LAN e Dedicado Online</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">➔</span>
          </div>
        )}
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

      {/* Players Grid (10 Slots) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {players.map((p, idx) => {
          const isMe = p.id === myProfile?.id || (p.nick && p.nick === myProfile?.nick);
          const isSlotAdmin = adminId && p.id === adminId;

          return (
            <div
              key={p.id || idx}
              className={`relative overflow-hidden bg-slate-900/90 border rounded-2xl p-3 flex flex-col justify-between transition-all group ${
                p.ready
                  ? 'border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : 'border-slate-800 hover:border-slate-700'
              } ${isMe ? 'ring-2 ring-amber-500/40 bg-slate-900' : ''}`}
            >
              {/* Ready Indicator Dot */}
              <div
                className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full z-10 ${
                  p.ready ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-700'
                }`}
                title={p.ready ? 'Pronto' : 'Aguardando'}
              />

              {/* Top: Avatar & Player Nick */}
              <div className="flex items-center gap-2.5 mb-2.5 pr-4 min-w-0">
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
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-bold text-xs text-white truncate block" title={p.nick}>
                      {p.nick}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      Slot #{idx + 1}
                    </span>
                    {isMe && (
                      <span className="text-[8px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/25 border border-amber-500/40 px-1 rounded shrink-0">
                        VOCÊ
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle: Badges based on selected ranking */}
              <div className="space-y-1.5 my-1.5 min-w-0">
                {isFaceit ? (
                  <div className="flex items-center justify-between gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80 min-w-0 overflow-hidden">
                    <FaceitBadge level={p.faceitLevel} elo={p.faceitElo} size="sm" showElo={false} />
                    {p.cs2Hours ? (
                      <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold shrink-0 truncate" title={`${p.cs2Hours.toLocaleString('pt-BR')} horas no CS2`}>
                        🕒 {p.cs2Hours.toLocaleString('pt-BR')}h
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-slate-500 truncate">Auto Steam</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80 min-w-0 overflow-hidden">
                    <GCBadge level={p.level} size="sm" />
                    {p.cs2Hours ? (
                      <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold shrink-0 truncate" title={`${p.cs2Hours.toLocaleString('pt-BR')} horas no CS2`}>
                        🕒 {p.cs2Hours.toLocaleString('pt-BR')}h
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-slate-500 truncate">Gamers Club</span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl px-2 py-1 text-[10px] text-slate-400 min-w-0">
                  <span className="text-[9px] font-semibold text-slate-400 shrink-0">Lado:</span>
                  {isAdmin && onAdminChangeSide ? (
                    <div className="grid grid-cols-3 gap-0.5 bg-slate-950 border border-slate-800 rounded-lg p-0.5 flex-1 max-w-[108px] min-w-0">
                      <button
                        type="button"
                        onClick={() => onAdminChangeSide(p.id, 'CT')}
                        className={`py-0.5 rounded text-[9px] font-bold text-center transition-colors cursor-pointer ${
                          p.side === 'CT' ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title="Fixar no lado CT"
                      >
                        CT
                      </button>
                      <button
                        type="button"
                        onClick={() => onAdminChangeSide(p.id, 'TR')}
                        className={`py-0.5 rounded text-[9px] font-bold text-center transition-colors cursor-pointer ${
                          p.side === 'TR' ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title="Fixar no lado TR"
                      >
                        TR
                      </button>
                      <button
                        type="button"
                        onClick={() => onAdminChangeSide(p.id, 'ANY')}
                        className={`py-0.5 rounded text-[9px] font-bold text-center transition-colors cursor-pointer truncate ${
                          !p.side || p.side === 'ANY' ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title="Qualquer lado (Flex / Automático)"
                      >
                        Flex
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`font-bold font-mono px-1.5 py-0.5 rounded text-[9px] shrink-0 ${
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
              </div>

              {/* Bottom: Action buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 mt-1">
                <button
                  onClick={() => {
                    if (soundEnabled) playReadySound();
                    onToggleReady(p.id);
                  }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                    p.ready
                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {p.ready ? 'Pronto ✓' : 'Aguardando'}
                </button>

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
                    className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title={isAdmin && p.id !== myProfile?.id ? 'Expulsar jogador da sala (Admin)' : 'Sair da sala'}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty Slot Placeholders */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="border-2 border-dashed border-slate-800/70 hover:border-slate-700/80 rounded-xl p-3.5 flex flex-col items-center justify-center text-center min-h-[110px] text-slate-600 bg-slate-950/25 transition-all select-none"
          >
            <div className="w-7 h-7 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-1">
              <Users size={13} />
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-400">Slot #{players.length + i + 1}</span>
            <span className="text-[10px] text-slate-600 mt-0.5">Aguardando jogador</span>
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
                : `Pronto para sortear equipes usando ranking ${isFaceit ? 'FACEIT' : 'Gamers Club'}`}
            </p>
          </div>
        </div>

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
      </div>
    </div>
  );
}
