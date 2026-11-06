import React, { useState } from 'react';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import PlayerAvatar from './PlayerAvatar';
import { CS2_MAPS } from '../data/maps';
import { Trophy, Share2, Terminal, RotateCcw, Shield, Flame, Check, History, Zap, Radio } from 'lucide-react';
import { formatDiscordSummary, formatServerCommand } from '../utils/exportText';
import { playClickSound } from '../utils/audio';
import ServerConnectBar from './ServerConnectBar';

export default function FinalSummary({
  room,
  onResetMix,
  onUpdateServerIp,
  onUpdateRconPassword,
  onChangeServerMapRcon,
  onOpenGsiSetup,
  onOpenHistory,
  soundEnabled,
}) {
  const [copiedDiscord, setCopiedDiscord] = useState(false);
  const [copiedRcon, setCopiedRcon] = useState(false);

  const { finalMap, teamA = [], teamB = [], metrics, startingSideTeamB, name: roomName = 'MIX', serverIp = '', rconPassword = '', liveMatch = null, rankingSystem = 'gc' } = room;
  const isFaceit = rankingSystem === 'faceit';
  const fullMap = CS2_MAPS.find((m) => m.id === finalMap?.id) || finalMap;

  const sideTeamB = startingSideTeamB || 'CT';
  const sideTeamA = sideTeamB === 'CT' ? 'TR' : 'CT';

  const handleCopyDiscord = () => {
    if (soundEnabled) playClickSound();
    const text = formatDiscordSummary({
      roomName,
      teamA,
      teamB,
      metrics,
      finalMap: fullMap,
      startingSideTeamB: sideTeamB,
    });
    navigator.clipboard.writeText(text);
    setCopiedDiscord(true);
    setTimeout(() => setCopiedDiscord(false), 2000);
  };

  const handleCopyRcon = () => {
    if (soundEnabled) playClickSound();
    const cmd = formatServerCommand(fullMap);
    navigator.clipboard.writeText(cmd);
    setCopiedRcon(true);
    setTimeout(() => setCopiedRcon(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Decider Map Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-amber-400 bg-slate-900 shadow-2xl p-6 sm:p-10 text-center animate-glow">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{
            backgroundImage: `url(${fullMap?.image || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80'})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />

        <div className="relative z-10 space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg">
            <Trophy size={14} /> Mix Pronto para Iniciar!
          </div>

          <div className="flex items-center justify-center gap-4 my-2">
            {fullMap?.logo && (
              <img
                src={fullMap.logo}
                alt={fullMap.name}
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)] animate-pulse"
              />
            )}
            <h2 className="text-4xl sm:text-6xl font-black font-heading text-white tracking-wider">
              {fullMap?.name?.toUpperCase() || 'MAPA DEFINIDO'}
            </h2>
          </div>

          <p className="text-sm text-slate-300">
            Arquivo de Mapa: <strong className="text-amber-400 font-mono">{fullMap?.file}</strong> • Local: <strong className="text-slate-200">{fullMap?.location || 'CS2'}</strong>
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {onChangeServerMapRcon && serverIp && (
              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  onChangeServerMapRcon(fullMap?.file || 'de_mirage');
                }}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/25 active:scale-95"
                title={`Muda o mapa no servidor FireGames para ${fullMap?.file} automaticamente via RCON`}
              >
                <Zap size={15} />
                <span>Mudar Servidor para {fullMap?.name} (RCON)</span>
              </button>
            )}

            <button
              onClick={handleCopyDiscord}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              {copiedDiscord ? <Check size={16} /> : <Share2 size={16} />}
              <span>{copiedDiscord ? 'Copiado!' : 'Copiar Escalação (Discord)'}</span>
            </button>

            <button
              onClick={handleCopyRcon}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer font-mono active:scale-95"
            >
              {copiedRcon ? <Check size={14} className="text-emerald-400" /> : <Terminal size={14} />}
              <span>{copiedRcon ? 'Copiado!' : 'Copiar RCON'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Valve GSI Live Scorecard (If match is in progress or completed) */}
      {liveMatch?.connected && (
        <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-4 text-center shadow-lg shadow-emerald-950/40 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-2">
            <Radio size={12} className="animate-pulse text-emerald-400" /> Transmissão Valve GSI Ao Vivo
          </div>
          <div className="flex items-center justify-center gap-8 text-3xl font-black font-heading text-white">
            <div className="text-center">
              <span className="text-[11px] text-sky-400 block font-normal font-sans uppercase font-bold">Time CT</span>
              <span className="font-mono text-sky-400">{liveMatch.scoreCT}</span>
            </div>
            <span className="text-slate-600 text-2xl font-light">x</span>
            <div className="text-center">
              <span className="text-[11px] text-amber-400 block font-normal font-sans uppercase font-bold">Time TR</span>
              <span className="font-mono text-amber-400">{liveMatch.scoreTR}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 font-mono">
            Round #{liveMatch.roundNumber} • Mapa: {liveMatch.mapName} • Fase: {liveMatch.phase}
          </p>
        </div>
      )}

      {/* Direct CS2 Server Connect Widget */}
      <ServerConnectBar
        serverIp={serverIp}
        onUpdateServerIp={onUpdateServerIp}
        rconPassword={rconPassword}
        onUpdateRconPassword={onUpdateRconPassword}
        roomId={room.id}
        liveMatch={liveMatch}
        onOpenGsiSetup={onOpenGsiSetup}
        soundEnabled={soundEnabled}
      />

      {/* Starting Teams & Sides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* TIME A */}
        <div
          className={`bg-slate-900/90 border-2 rounded-2xl p-5 shadow-xl backdrop-blur ${
            sideTeamA === 'CT' ? 'border-sky-500/60' : 'border-amber-500/60'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                  sideTeamA === 'CT'
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {sideTeamA === 'CT' ? <Shield size={18} /> : <Flame size={18} />}
              </div>
              <div>
                <h3 className="text-base font-bold font-heading text-white">
                  TIME A • Começa de {sideTeamA}
                </h3>
                <span className="text-xs text-slate-400">
                  {sideTeamA === 'CT' ? 'Defesa (Contra-Terroristas)' : 'Ataque (Terroristas)'}
                </span>
              </div>
            </div>

            <div className="text-right font-mono text-xs">
              <div className="text-slate-500">{isFaceit ? 'MÉDIA FACEIT' : 'MÉDIA GC'}</div>
              <div className="text-amber-400 font-bold">Lvl {metrics?.avgA ?? '-'}</div>
            </div>
          </div>

          <div className="divide-y divide-slate-800/60 mt-3">
            {teamA.map((p) => {
              const pFaceitLevel = p.faceitLevel || (p.level <= 10 ? p.level : Math.round(p.level / 2.1)) || 5;
              return (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar avatar={p.avatar} nick={p.nick} size="sm" />
                    <span className="font-bold text-sm text-white">{p.nick}</span>
                  </div>
                  {isFaceit ? (
                    <FaceitBadge level={pFaceitLevel} elo={p.faceitElo} size="sm" />
                  ) : (
                    <GCBadge level={p.level} size="sm" showTier />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* TIME B */}
        <div
          className={`bg-slate-900/90 border-2 rounded-2xl p-5 shadow-xl backdrop-blur ${
            sideTeamB === 'CT' ? 'border-sky-500/60' : 'border-amber-500/60'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                  sideTeamB === 'CT'
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {sideTeamB === 'CT' ? <Shield size={18} /> : <Flame size={18} />}
              </div>
              <div>
                <h3 className="text-base font-bold font-heading text-white">
                  TIME B • Começa de {sideTeamB}
                </h3>
                <span className="text-xs text-slate-400">
                  {sideTeamB === 'CT' ? 'Defesa (Contra-Terroristas)' : 'Ataque (Terroristas)'}
                </span>
              </div>
            </div>

            <div className="text-right font-mono text-xs">
              <div className="text-slate-500">{isFaceit ? 'MÉDIA FACEIT' : 'MÉDIA GC'}</div>
              <div className="text-amber-400 font-bold">Lvl {metrics?.avgB ?? '-'}</div>
            </div>
          </div>

          <div className="divide-y divide-slate-800/60 mt-3">
            {teamB.map((p) => {
              const pFaceitLevel = p.faceitLevel || (p.level <= 10 ? p.level : Math.round(p.level / 2.1)) || 5;
              return (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar avatar={p.avatar} nick={p.nick} size="sm" />
                    <span className="font-bold text-sm text-white">{p.nick}</span>
                  </div>
                  {isFaceit ? (
                    <FaceitBadge level={pFaceitLevel} elo={p.faceitElo} size="sm" />
                  ) : (
                    <GCBadge level={p.level} size="sm" showTier />
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
        <button
          onClick={() => {
            if (soundEnabled) playClickSound();
            onOpenHistory();
          }}
          className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <History size={16} />
          <span>Registrar / Ver Placar da Partida</span>
        </button>

        <button
          onClick={() => {
            if (soundEnabled) playClickSound();
            onResetMix();
          }}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <RotateCcw size={15} />
          <span>Jogar Novo Mix (Voltar ao Lobby)</span>
        </button>
      </div>
    </div>
  );
}
