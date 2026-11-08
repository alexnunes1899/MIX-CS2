import React, { useState } from 'react';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import PlayerAvatar from './PlayerAvatar';
import { CS2_MAPS } from '../data/maps';
import { Trophy, Share2, Terminal, RotateCcw, Shield, Flame, Check, History, Zap, Radio, Sparkles, Bell, Play, Pause, RefreshCw, Send, Image, Copy, Swords } from 'lucide-react';
import { formatDiscordSummary, formatServerCommand } from '../utils/exportText';
import { playClickSound } from '../utils/audio';
import { getTeamNames } from '../utils/teamNames';
import ServerConnectBar from './ServerConnectBar';

export default function FinalSummary({
  room,
  onResetMix,
  onUpdateServerIp,
  onUpdateRconPassword,
  onChangeServerMapRcon,
  onExecRconCommand,
  onOpenMatchCard,
  onOpenDiscordModal,
  onOpenGsiSetup,
  onOpenHistory,
  onOpenServersPage,
  soundEnabled,
}) {
  const [copiedDiscord, setCopiedDiscord] = useState(false);
  const [copiedRcon, setCopiedRcon] = useState(false);
  const [copiedHltv, setCopiedHltv] = useState(false);
  const [discordSending, setDiscordSending] = useState(false);
  const [discordSent, setDiscordSent] = useState(false);
  const [statsSending, setStatsSending] = useState(false);
  const [statsSent, setStatsSent] = useState(false);
  const [rconExecuting, setRconExecuting] = useState(null);

  const { finalMap, teamA = [], teamB = [], metrics, startingSideTeamB, name: roomName = 'MIX', serverIp = '', rconPassword = '', liveMatch = null, rankingSystem = 'gc', discordWebhook = '', vetoLog = [] } = room;
  const { labelA, labelB, upperA, upperB } = getTeamNames(room);
  const isFaceit = rankingSystem === 'faceit';
  const fullMap = CS2_MAPS.find((m) => m.id === finalMap?.id) || finalMap;

  const sideTeamB = startingSideTeamB || 'CT';
  const sideTeamA = sideTeamB === 'KNIFE' ? 'KNIFE' : sideTeamB === 'CT' ? 'TR' : 'CT';

  const handleCopyHltvLog = () => {
    if (soundEnabled) playClickSound();
    const lines = [
      `🏆 Veto Oficial (${room.matchFormat || 'MD1'}) — ${labelA} vs ${labelB}`,
      ...vetoLog.map((log, i) => {
        const tName = log.team === 'teamA' ? labelA : labelB;
        if (log.type === 'ban') return `${i + 1}. ${tName} removeu ${log.mapName}`;
        if (log.type === 'pick') {
          const sideTxt = log.sideTeamA
            ? log.knifeRound
              ? ' (🔪 Round Faca)'
              : ` (${labelA}: ${log.sideTeamA} | ${labelB}: ${log.sideTeamB})`
            : '';
          return `${i + 1}. ${tName} escolheu ${log.mapName}${sideTxt}`;
        }
        const deciderSideTxt = log.sideTeamA
          ? log.knifeRound
            ? ' (🔪 Round Faca)'
            : ` (${labelA}: ${log.sideTeamA} | ${labelB}: ${log.sideTeamB})`
          : '';
        return `${i + 1}. ${log.mapName} sobrou como Mapa Decider${deciderSideTxt}`;
      }),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedHltv(true);
    setTimeout(() => setCopiedHltv(false), 2000);
  };

  const handleSendDiscord = async () => {
    if (soundEnabled) playClickSound();
    if (!discordWebhook) {
      if (onOpenDiscordModal) onOpenDiscordModal();
      return;
    }
    setDiscordSending(true);
    try {
      const res = await fetch('/api/discord/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: discordWebhook,
          eventType: 'mix_ready',
          data: {
            roomName,
            mapName: fullMap?.name,
            mapFile: fullMap?.file,
            mapImage: fullMap?.image,
            mapLogo: fullMap?.logo,
            matchFormat: room.matchFormat || 'MD1',
            nameA: upperA,
            nameB: upperB,
            sideA: sideTeamA,
            sideB: sideTeamB,
            teamA,
            teamB,
            metrics,
            serverIp,
            connectCommand: serverIp ? (serverIp.includes('connect') ? serverIp : `connect ${serverIp}`) : '',
            allPlayersStats: liveMatch?.allPlayersStats || [],
            topFragger: liveMatch?.topFragger || null,
            matchMvp: liveMatch?.matchMvp || null,
            roomUrl: typeof window !== 'undefined' ? window.location.href : '',
          },
        }),
      });
      if (res.ok) {
        setDiscordSent(true);
        setTimeout(() => setDiscordSent(false), 3000);
      }
    } catch (e) {
      console.warn('Erro ao disparar webhook:', e);
    } finally {
      setDiscordSending(false);
    }
  };

  const handleSendStatsDiscord = async () => {
    if (soundEnabled) playClickSound();
    if (!discordWebhook) {
      if (onOpenDiscordModal) onOpenDiscordModal();
      return;
    }
    setStatsSending(true);
    try {
      const winnerName = (liveMatch?.scoreCT || 0) > (liveMatch?.scoreTR || 0)
        ? (upperA || 'Time CT')
        : (liveMatch?.scoreTR || 0) > (liveMatch?.scoreCT || 0)
        ? (upperB || 'Time TR')
        : 'Empate';

      const res = await fetch('/api/discord/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: discordWebhook,
          eventType: 'match_stats',
          data: {
            roomName,
            mapName: fullMap?.name || liveMatch?.mapName || 'CS2 Map',
            winner: winnerName,
            scoreCT: liveMatch?.scoreCT || 0,
            scoreTR: liveMatch?.scoreTR || 0,
            nameA: labelA,
            nameB: labelB,
            allPlayersStats: liveMatch?.allPlayersStats || [],
            topFragger: liveMatch?.topFragger || null,
            matchMvp: liveMatch?.matchMvp || null,
            roomUrl: typeof window !== 'undefined' ? window.location.href : '',
          },
        }),
      });
      if (res.ok) {
        setStatsSent(true);
        setTimeout(() => setStatsSent(false), 3000);
      }
    } catch (e) {
      console.warn('Erro ao enviar estatísticas ao Discord:', e);
    } finally {
      setStatsSending(false);
    }
  };

  const handleCopyDiscord = () => {
    if (soundEnabled) playClickSound();
    const text = formatDiscordSummary({
      roomName,
      teamA,
      teamB,
      metrics,
      finalMap: fullMap,
      startingSideTeamB: sideTeamB,
      matchFormat: room.matchFormat || 'MD1',
      drawnSeries: room.drawnSeries || [],
      nameA: upperA,
      nameB: upperB,
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
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg">
              <Trophy size={14} /> Mix Pronto para Iniciar!
            </div>
            {room.matchFormat && room.matchFormat !== 'MD1' && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/80 border border-amber-400 text-amber-300 font-black text-xs uppercase tracking-wider shadow-lg">
                🏆 Formato {room.matchFormat}
              </div>
            )}
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

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            {/* Generate Visual Match Card (PNG) */}
            {onOpenMatchCard && (
              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  onOpenMatchCard();
                }}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/25 active:scale-95"
                title="Gera e baixa um card visual em alta resolução para WhatsApp ou redes sociais"
              >
                <Sparkles size={15} />
                <span>Gerar Card (PNG)</span>
              </button>
            )}

            {/* Post to Discord Webhook */}
            <button
              onClick={handleSendDiscord}
              disabled={discordSending}
              className={`px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${
                discordSent
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-indigo-600/90 hover:bg-indigo-500 text-white shadow-indigo-500/25'
              }`}
              title={discordWebhook ? 'Enviar notificação formatada para o Discord' : 'Configurar Webhook do Discord'}
            >
              {discordSent ? <Check size={15} /> : <Bell size={15} />}
              <span>{discordSending ? 'Enviando...' : discordSent ? 'Enviado ao Discord!' : 'Avisar no Discord'}</span>
            </button>

            {/* Change Server Map via RCON */}
            {onChangeServerMapRcon && serverIp && (
              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  onChangeServerMapRcon(fullMap?.file || 'de_mirage');
                }}
                className="px-4 py-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/25 active:scale-95"
                title={`Muda o mapa no servidor FireGames para ${fullMap?.file} automaticamente via RCON`}
              >
                <Zap size={15} />
                <span>Mudar Servidor ({fullMap?.name})</span>
              </button>
            )}

            <button
              onClick={handleCopyDiscord}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              {copiedDiscord ? <Check size={15} className="text-emerald-400" /> : <Share2 size={15} />}
              <span>{copiedDiscord ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>

            <button
              onClick={handleCopyRcon}
              className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer font-mono active:scale-95"
              title="Copiar comando de RCON changelevel"
            >
              {copiedRcon ? <Check size={14} className="text-emerald-400" /> : <Terminal size={14} />}
              <span>{copiedRcon ? 'Copiado!' : 'RCON'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Series Breakdown Grid for MD3 / MD5 */}
      {room.drawnSeries && room.drawnSeries.length > 1 && (
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <h3 className="font-heading font-black text-sm text-white uppercase tracking-wider">
                Ordem dos Mapas da Série ({room.matchFormat || 'MD3'})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {room.drawnSeries.length} Mapas Sorteados
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {room.drawnSeries.map((item, idx) => {
              const mapObj = CS2_MAPS.find((m) => m.id === item.map?.id) || item.map;
              const isKnife = Boolean(item.knifeRound) || item.sideTimeA === 'KNIFE' || item.sideTimeA === 'FACA';
              const sideA = isKnife ? 'KNIFE' : (item.sideTimeA || 'CT');
              const sideB = isKnife ? 'KNIFE' : sideA === 'CT' ? 'TR' : 'CT';
              const isFirst = idx === 0;

              return (
                <div
                  key={idx}
                  className={`relative overflow-hidden rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                    isFirst ? 'border-amber-400/80 bg-slate-950/90 shadow-md ring-1 ring-amber-400/30' : 'border-slate-800 bg-slate-950/70'
                  }`}
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-25"
                    style={{ backgroundImage: `url(${mapObj?.image})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />

                  <div className="relative z-10 flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                      #{idx + 1}
                    </span>
                    <span className="text-[9px] font-bold text-slate-300 truncate">
                      {item.role}
                    </span>
                  </div>

                  <div className="relative z-10 my-2">
                    <div className="font-heading font-black text-sm text-white uppercase tracking-wide">
                      {mapObj?.name || 'MAPA'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {mapObj?.file}
                    </div>
                  </div>

                  <div className="relative z-10 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono font-bold">
                    {sideA === 'KNIFE' ? (
                      <span className="text-purple-300 w-full text-center">🔪 Round Faca</span>
                    ) : (
                      <>
                        <span className="text-sky-400">{labelA}: {sideA}</span>
                        <span className="text-amber-400">{labelB}: {sideB}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Official HLTV / Major Pick & Ban Log Summary */}
      {vetoLog && vetoLog.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Swords size={15} className="text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Histórico Oficial do Veto (Padrão HLTV / Major)
              </h4>
            </div>
            <button
              onClick={handleCopyHltvLog}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-semibold transition-all cursor-pointer"
            >
              {copiedHltv ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-emerald-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copiar Log HLTV</span>
                </>
              )}
            </button>
          </div>
          <div className="space-y-1.5">
            {vetoLog.map((log, i) => {
              const teamDisplay = log.team === 'teamA' ? labelA : labelB;
              const isPick = log.type === 'pick';
              const isDecider = log.type === 'decider';
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between text-xs py-1.5 px-3 rounded-lg border ${
                    isDecider
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : isPick
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      #{i + 1}
                    </span>
                    {isDecider ? (
                      <span>
                        <strong className="text-amber-300">{log.mapName}</strong> sobrou como{' '}
                        <strong className="text-amber-400 uppercase">Mapa Decider</strong>
                      </span>
                    ) : isPick ? (
                      <span>
                        <strong className={log.team === 'teamA' ? 'text-sky-400' : 'text-amber-400'}>
                          {teamDisplay}
                        </strong>{' '}
                        escolheu <strong className="text-emerald-300">{log.mapName}</strong>{' '}
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                          Mapa {log.mapNumber}
                        </span>
                      </span>
                    ) : (
                      <span>
                        <strong className={log.team === 'teamA' ? 'text-sky-400' : 'text-amber-400'}>
                          {teamDisplay}
                        </strong>{' '}
                        removeu <strong className="text-rose-400 line-through">{log.mapName}</strong>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(isPick || isDecider) && log.sideTeamA && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200">
                        {log.knifeRound
                          ? '🔪 Round Faca'
                          : `${labelA}: ${log.sideTeamA} | ${labelB}: ${log.sideTeamB}`}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded ${
                        isDecider
                          ? 'bg-amber-500/20 text-amber-300'
                          : isPick
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {isDecider ? 'DECIDER' : isPick ? 'PICK' : 'BAN'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Valve GSI Live Scorecard (If match is in progress or completed) */}
      {liveMatch?.connected && (
        <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-3xl p-5 text-center shadow-2xl shadow-emerald-950/30 animate-fadeIn space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-emerald-500/20">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
              <Radio size={12} className="animate-pulse text-emerald-400" /> Transmissão Valve GSI Ao Vivo
            </div>
            <div className="text-[11px] font-mono text-emerald-300/80">
              Round #{liveMatch.roundNumber} • Mapa: {liveMatch.mapName} • Fase: {liveMatch.phase}
            </div>
          </div>

          <div className="flex items-center justify-center gap-8 text-3xl sm:text-4xl font-black font-heading text-white">
            <div className="text-center">
              <span className="text-[11px] text-sky-400 block font-normal font-sans uppercase font-bold tracking-wider">Time CT</span>
              <span className="font-mono text-sky-400">{liveMatch.scoreCT}</span>
            </div>
            <span className="text-slate-600 text-2xl font-light">x</span>
            <div className="text-center">
              <span className="text-[11px] text-amber-400 block font-normal font-sans uppercase font-bold tracking-wider">Time TR</span>
              <span className="font-mono text-amber-400">{liveMatch.scoreTR}</span>
            </div>
          </div>

          {/* Player Statistics Scoreboard from CS2 GSI */}
          {liveMatch.allPlayersStats && liveMatch.allPlayersStats.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-800 text-left">
              {/* Highlights Ribbon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {liveMatch.matchMvp && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⭐</span>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-amber-400/80 block">MVP da Partida</span>
                        <strong className="text-xs text-white block">{liveMatch.matchMvp.name}</strong>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-amber-300">
                      {liveMatch.matchMvp.mvps} MVPs • K/D {liveMatch.matchMvp.kd}
                    </span>
                  </div>
                )}

                {liveMatch.topFragger && (
                  <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">👑</span>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-sky-400/80 block">Top Fragger</span>
                        <strong className="text-xs text-white block">{liveMatch.topFragger.name}</strong>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-sky-300">
                      {liveMatch.topFragger.kills} Kills ({liveMatch.topFragger.deaths}D)
                    </span>
                  </div>
                )}
              </div>

              {/* Scoreboard Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80 no-scrollbar">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider bg-slate-900/60 font-sans">
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Competidor</th>
                      <th className="py-2 px-2 text-center">Lado</th>
                      <th className="py-2 px-3 text-center">K / D / A</th>
                      <th className="py-2 px-3 text-center">K/D</th>
                      <th className="py-2 px-2 text-center">MVPs</th>
                      <th className="py-2 px-3 text-right">Pontos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {liveMatch.allPlayersStats.map((p, idx) => (
                      <tr key={p.steamId || idx} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-2 px-3 text-slate-500 font-bold">{idx + 1}</td>
                        <td className="py-2 px-3 font-sans font-bold text-white flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {liveMatch.matchMvp?.name === p.name && (
                            <span className="text-amber-400" title="MVP">⭐</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            p.team === 'CT' ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {p.team}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className="text-emerald-400">{p.kills}</span>
                          <span className="text-slate-500"> / </span>
                          <span className="text-rose-400">{p.deaths}</span>
                          <span className="text-slate-500"> / </span>
                          <span className="text-sky-400">{p.assists}</span>
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={p.kd >= 1.0 ? 'text-emerald-400' : 'text-slate-400'}>{p.kd}</span>
                        </td>
                        <td className="py-2 px-2 text-center text-amber-400 font-bold">
                          {p.mvps > 0 ? `${p.mvps}⭐` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-200">
                          {p.score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Button: Send Stats to Discord */}
              <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                <span className="text-[11px] text-slate-400">
                  Transmitindo em tempo real direto da engine do CS2 via Game State Integration.
                </span>
                <button
                  type="button"
                  onClick={handleSendStatsDiscord}
                  disabled={statsSending}
                  className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 ${
                    statsSent
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25'
                  }`}
                  title="Envia o scoreboard completo com K/D e MVPs para o canal do Discord"
                >
                  {statsSent ? <Check size={14} /> : <Send size={14} />}
                  <span>{statsSending ? 'Enviando...' : statsSent ? 'Estatísticas Enviadas!' : 'Mandar Estatísticas ao Discord'}</span>
                </button>
              </div>
            </div>
          )}
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
        onOpenServersPage={onOpenServersPage}
        soundEnabled={soundEnabled}
        finalMap={room.finalMap?.id || 'de_mirage'}
      />

      {/* RCON 1-Click Server Administration Hub */}
      {serverIp && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Terminal size={15} className="text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Controle do Servidor CS2 (1-Clique via RCON)
              </h4>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Host: {serverIp.split(';')[0]}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                if (onChangeServerMapRcon) onChangeServerMapRcon(fullMap?.file || 'de_mirage');
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Carrega o mapa decider no servidor"
            >
              <Zap size={13} />
              <span>Mudar Mapa ({fullMap?.name})</span>
            </button>

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                if (onExecRconCommand) onExecRconCommand('exec gamemode_competitive; mp_restartgame 1; say "[CS2 MIX HUB] PARTIDA INICIADA! LIVE LIVE LIVE!"', 'Iniciar LIVE');
              }}
              className="px-3.5 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Inicia modo competitivo oficial"
            >
              <Play size={13} />
              <span>Iniciar Partida (LIVE)</span>
            </button>

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                if (onExecRconCommand) onExecRconCommand('mp_warmup_start; mp_warmup_pausetimer 1', 'Aquecimento');
              }}
              className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <span>Aquecimento</span>
            </button>

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                if (onExecRconCommand) onExecRconCommand('mp_warmup_end', 'Fim do Aquecimento');
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <span>Fim Aquecimento</span>
            </button>

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                if (onExecRconCommand) onExecRconCommand('mp_pause_match', 'Pausar Partida');
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Pause size={13} />
              <span>Pausar</span>
            </button>

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                if (onExecRconCommand) onExecRconCommand('mp_unpause_match', 'Despausar Partida');
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Play size={13} />
              <span>Despausar</span>
            </button>

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                if (onExecRconCommand) onExecRconCommand('mp_restartgame 1', 'Reiniciar Round');
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw size={13} />
              <span>Reiniciar 1s</span>
            </button>
          </div>
        </div>
      )}

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
                  {upperA} • {sideTeamA === 'KNIFE' ? '🔪 Round Faca' : `Começa de ${sideTeamA}`}
                </h3>
                <span className="text-xs text-slate-400">
                  {sideTeamA === 'KNIFE'
                    ? 'Lado inicial será decidido no Round Faca'
                    : sideTeamA === 'CT'
                    ? 'Defesa (Contra-Terroristas)'
                    : 'Ataque (Terroristas)'}
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
                  {upperB} • {sideTeamB === 'KNIFE' ? '🔪 Round Faca' : `Começa de ${sideTeamB}`}
                </h3>
                <span className="text-xs text-slate-400">
                  {sideTeamB === 'KNIFE'
                    ? 'Lado inicial será decidido no Round Faca'
                    : sideTeamB === 'CT'
                    ? 'Defesa (Contra-Terroristas)'
                    : 'Ataque (Terroristas)'}
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
