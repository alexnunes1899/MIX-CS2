import React, { useState } from 'react';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import PlayerAvatar from './PlayerAvatar';
import { CS2_MAPS } from '../data/maps';
import { Trophy, Share2, Terminal, RotateCcw, Shield, Flame, Check, History, Zap, Radio, Sparkles, Bell, Play, Pause, RefreshCw, Send, Image, Copy, Swords, Smartphone, Download, Award, ThumbsUp, Heart, Star, Crown } from 'lucide-react';
import { formatDiscordSummary, formatServerCommand } from '../utils/exportText';
import { playClickSound, playReadySound } from '../utils/audio';
import { getTeamNames } from '../utils/teamNames';
import ServerConnectBar from './ServerConnectBar';
import { copyText } from '../utils/clipboard';

export default function FinalSummary({
  room,
  onResetMix,
  onRematchSameTeams,
  onUpdateServerIp,
  onUpdateRconPassword,
  onChangeServerMapRcon,
  onExecRconCommand,
  onOpenMatchCard,
  onOpenStoryCard,
  onOpenDiscordModal,
  onOpenGsiSetup,
  onOpenHistory,
  onOpenServersPage,
  soundEnabled,
  onCommendPlayer,
}) {
  const [copiedDiscord, setCopiedDiscord] = useState(false);
  const [copiedRcon, setCopiedRcon] = useState(false);
  const [copiedMatchzy, setCopiedMatchzy] = useState(false);
  const [copiedHltv, setCopiedHltv] = useState(false);
  const [discordSending, setDiscordSending] = useState(false);
  const [discordSent, setDiscordSent] = useState(false);
  const [discordError, setDiscordError] = useState(null);
  const [statsSending, setStatsSending] = useState(false);
  const [statsSent, setStatsSent] = useState(false);
  const [rconExecuting, setRconExecuting] = useState(null);
  const [commendedPlayers, setCommendedPlayers] = useState({});

  const { finalMap, teamA = [], teamB = [], metrics, startingSideTeamB, name: roomName = 'MIX', serverIp = '', rconPassword = '', liveMatch = null, rankingSystem = 'gc', discordWebhook = '', vetoLog = [] } = room;
  const { labelA, labelB, upperA, upperB } = getTeamNames(room);
  const isFaceit = rankingSystem === 'faceit';
  const fullMap =
    CS2_MAPS.find(
      (m) =>
        m.id === finalMap?.id ||
        m.file === finalMap?.file ||
        m.file === finalMap?.id ||
        m.name?.toLowerCase() === finalMap?.name?.toLowerCase()
    ) || finalMap;

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
    copyText(lines.join('\n'));
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
            drawnSeries: room.drawnSeries || [],
            pickedMaps: room.pickedMaps || [],
            vetoLog: room.vetoLog || [],
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
        setDiscordError(null);
        setTimeout(() => setDiscordSent(false), 3000);
      } else {
        const body = await res.json().catch(() => ({}));
        setDiscordError(body.error || `Falha ao enviar (HTTP ${res.status}). Verifique a URL do Webhook.`);
        setTimeout(() => setDiscordError(null), 6000);
      }
    } catch (e) {
      console.warn('Erro ao disparar webhook:', e);
      setDiscordError('Sem conexão com o servidor. Tente novamente.');
      setTimeout(() => setDiscordError(null), 6000);
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
    copyText(text);
    setCopiedDiscord(true);
    setTimeout(() => setCopiedDiscord(false), 2000);
  };

  const handleCopyRcon = () => {
    if (soundEnabled) playClickSound();
    const cmd = formatServerCommand(fullMap);
    copyText(cmd);
    setCopiedRcon(true);
    setTimeout(() => setCopiedRcon(false), 2000);
  };

  const matchzyConfigUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/matchzy/config/${room.id || 'MIX'}`
    : `/api/matchzy/config/${room.id || 'MIX'}`;
  const matchzyRconCommand = `matchzy_loadmatch_url "${matchzyConfigUrl}"`;

  const handleCopyMatchzy = () => {
    if (soundEnabled) playClickSound();
    copyText(matchzyRconCommand);
    setCopiedMatchzy(true);
    setTimeout(() => setCopiedMatchzy(false), 2500);
  };

  const handleDownloadMatchzyJson = () => {
    if (soundEnabled) playClickSound();
    window.open(`/api/matchzy/config/${room.id || 'MIX'}`, '_blank');
  };

  const handleCommend = (playerId, type) => {
    if (soundEnabled) playReadySound();
    setCommendedPlayers((prev) => {
      const p = prev[playerId] || {};
      return { ...prev, [playerId]: { ...p, [type]: (p[type] || 0) + 1 } };
    });
    if (onCommendPlayer) {
      onCommendPlayer(playerId, type);
    }
  };

  return (
    <div className="space-y-6">
      {/* Decider Map Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-amber-500/50 bg-slate-900 shadow-[0_0_50px_rgba(245,158,11,0.15)] p-6 sm:p-10 text-center animate-glow">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35 filter brightness-90"
          style={{
            backgroundImage: `url(${fullMap?.image || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80'})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-slate-950/50" />

        {/* Tactical Corner Accents */}
        <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-amber-400/60 pointer-events-none" />
        <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-amber-400/60 pointer-events-none" />
        <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-amber-400/60 pointer-events-none" />
        <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-amber-400/60 pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-3xl mx-auto">
          {/* Top Badges Bar */}
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 font-black text-xs uppercase tracking-wider shadow-lg backdrop-blur-sm">
              <Trophy size={14} className="text-amber-400" />
              <span>Mix Pronto para Iniciar!</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/90 border border-amber-500/30 text-amber-300 font-black text-xs uppercase tracking-wider shadow-lg font-mono">
              <Flame size={13} className="text-amber-400" />
              <span>Formato {room.matchFormat || 'MD1'}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 font-bold text-xs uppercase tracking-wider shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              <span>Rotação Oficial Valve</span>
            </div>
          </div>

          {/* Centered Map Logo & Balanced Title */}
          <div className="flex flex-col items-center justify-center my-2 text-center">
            {fullMap?.logo && (
              <div className="relative mb-2">
                <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full scale-125 pointer-events-none" />
                <img
                  src={fullMap.logo}
                  alt={fullMap.name}
                  className="relative w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.95)] filter brightness-110"
                />
              </div>
            )}
            <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black font-heading text-white tracking-widest uppercase drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)]">
              {fullMap?.name || 'MAPA DEFINIDO'}
            </h2>
            <div className="inline-flex items-center gap-2 mt-2 px-4 py-1 rounded-full bg-slate-950/85 border border-slate-800 text-xs text-slate-300 font-mono shadow-inner">
              <span className="text-slate-500">ARQUIVO:</span>
              <strong className="text-amber-400 font-bold">{fullMap?.file}</strong>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">LOCAL:</span>
              <span className="text-slate-200">{fullMap?.location || 'CS2 Competitivo'}</span>
            </div>
          </div>

          {/* Action Buttons Unified Dock */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            {/* Generate Visual Match Card (PNG) */}
            {onOpenMatchCard && (
              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  onOpenMatchCard();
                }}
                className="h-11 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider font-heading flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.02] active:scale-95"
                title="Gera e baixa um card visual em alta resolução para WhatsApp ou redes sociais"
              >
                <Sparkles size={16} />
                <span>Gerar Card (PNG)</span>
              </button>
            )}

            {/* Generate 9:16 Story Card for Instagram / WhatsApp */}
            {onOpenStoryCard && (
              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  onOpenStoryCard();
                }}
                className="h-11 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white font-bold text-xs uppercase tracking-wider font-heading flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-600/30 hover:scale-[1.02] active:scale-95"
                title="Gera imagem vertical em formato 9:16 para Stories do Instagram ou Status do WhatsApp"
              >
                <Smartphone size={16} />
                <span>Story (9:16)</span>
              </button>
            )}

            {/* Post to Discord Webhook */}
            <button
              onClick={handleSendDiscord}
              disabled={discordSending}
              className={`h-11 px-4 rounded-xl font-bold text-xs uppercase tracking-wider font-heading flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${
                discordSent
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#5865F2] hover:bg-[#4752c4] text-white shadow-[#5865F2]/30 hover:scale-[1.02]'
              }`}
              title={discordWebhook ? 'Enviar notificação formatada para o Discord' : 'Configurar Webhook do Discord'}
            >
              {discordSent ? <Check size={16} /> : <Bell size={16} />}
              <span>{discordSending ? 'Enviando...' : discordSent ? 'Enviado!' : 'Avisar no Discord'}</span>
            </button>

            {/* MatchZy 1-Click RCON Command */}
            <button
              onClick={handleCopyMatchzy}
              className={`h-11 px-4 rounded-xl font-bold text-xs uppercase tracking-wider font-heading flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${
                copiedMatchzy
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/25'
                  : 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-600/25 hover:scale-[1.02]'
              }`}
              title="Copia o comando matchzy_loadmatch_url para carregar a partida no servidor dedicado automaticamente"
            >
              {copiedMatchzy ? <Check size={16} /> : <Zap size={16} />}
              <span>{copiedMatchzy ? 'Copiado!' : 'MatchZy 1-Click'}</span>
            </button>

            {/* Copy Discord Text */}
            <button
              onClick={handleCopyDiscord}
              className="h-11 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider font-heading flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              {copiedDiscord ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
              <span>{copiedDiscord ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>

            {/* Change Server Map via RCON */}
            {onChangeServerMapRcon && serverIp && (
              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  onChangeServerMapRcon(fullMap?.file || 'de_mirage');
                }}
                className="h-11 px-4 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider font-heading flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/25 active:scale-95"
                title={`Muda o mapa no servidor FireGames para ${fullMap?.file} automaticamente via RCON`}
              >
                <Zap size={16} />
                <span>Mudar Servidor ({fullMap?.name})</span>
              </button>
            )}

            {/* RCON Console Shortcut */}
            <button
              onClick={handleCopyRcon}
              className="h-11 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer font-mono active:scale-95"
              title="Copiar comando de RCON changelevel"
            >
              {copiedRcon ? <Check size={14} className="text-emerald-400" /> : <Terminal size={14} />}
              <span>{copiedRcon ? 'Copiado!' : 'RCON'}</span>
            </button>
          </div>

          {discordError && (
            <p className="text-[11px] font-semibold text-rose-300 bg-rose-950/60 border border-rose-500/40 rounded-lg px-3 py-1.5 inline-block animate-fadeIn">
              ⚠️ Discord: {discordError}
            </p>
          )}
        </div>
      </div>

      {/* Crowned Match MVP Spotlight Card */}
      {(liveMatch?.matchMvp || room.matchMvp) && (() => {
        const mvp = liveMatch?.matchMvp || room.matchMvp;
        const mvpName = mvp.name || mvp.nick || 'Jogador';
        return (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-950/40 border-2 border-amber-500/60 p-5 sm:p-6 shadow-2xl shadow-amber-500/20 animate-glow text-left">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 shadow-lg shadow-amber-500/25 overflow-hidden">
                    {mvp.avatar ? (
                      <img src={mvp.avatar} alt={mvpName} className="w-full h-full object-cover" />
                    ) : (
                      <Crown size={28} className="text-amber-400 animate-pulse" />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-xs font-black shadow-md">
                    👑
                  </div>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-black uppercase tracking-wider mb-1">
                    <Crown size={11} /> MVP DA PARTIDA ELEITO
                  </div>
                  <h3 className="text-lg sm:text-xl font-black font-heading text-white">
                    {mvpName}
                  </h3>
                  <p className="text-xs text-amber-400/80">
                    Eleito automaticamente com o melhor desempenho da partida pelas estatísticas!
                  </p>
                </div>
              </div>

              {/* Stats badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {mvp.kills !== undefined && (
                  <span className="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono font-bold text-white shadow-inner">
                    🎯 <strong className="text-emerald-400">{mvp.kills}</strong> Kills
                  </span>
                )}
                {mvp.deaths !== undefined && (
                  <span className="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono font-bold text-white shadow-inner">
                    💀 <strong className="text-rose-400">{mvp.deaths}</strong> Mortes
                  </span>
                )}
                {mvp.kd !== undefined && (
                  <span className="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-amber-500/40 text-xs font-mono font-bold text-amber-300 shadow-inner">
                    ⚡ <strong>{mvp.kd}</strong> K/D
                  </span>
                )}
                {mvp.mvps !== undefined && mvp.mvps > 0 && (
                  <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/50 text-xs font-mono font-bold text-amber-300 shadow-inner">
                    ⭐ <strong>{mvp.mvps}</strong> MVPs
                  </span>
                )}
                {mvp.rating !== undefined && (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-xs font-mono font-bold text-emerald-300 shadow-inner">
                    📈 <strong>{mvp.rating}</strong> Rating
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
                      <th className="py-2 px-2 text-center">Vida (HP)</th>
                      <th className="py-2 px-2 text-center">Dinheiro</th>
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
                        <td className="py-2 px-3 font-sans font-bold text-white flex items-center gap-1.5 flex-wrap">
                          <span>{p.name}</span>
                          {liveMatch.matchMvp?.name === p.name && (
                            <span className="text-amber-400" title="MVP">⭐</span>
                          )}
                          {p.activeWeapon && (
                            <span className="text-[9px] text-slate-400 font-normal bg-slate-900 border border-slate-800 px-1 py-0.2 rounded">
                              🔫 {p.activeWeapon}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            p.team === 'CT' ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {p.team}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center font-bold">
                          {p.health !== undefined ? (
                            p.isAlive !== false && p.health > 0 ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                                ❤️ {p.health}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400">
                                💀 MORTO
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-bold">
                          {p.money !== undefined ? (
                            <span className="text-amber-400 font-bold">${p.money}</span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
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
                    {(p.source === 'whatsapp' || String(p.id).startsWith('wa_') || Boolean(p.phone)) && (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 shrink-0" title="Conectado pelo WhatsApp">
                        WhatsApp
                      </span>
                    )}
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
                    {(p.source === 'whatsapp' || String(p.id).startsWith('wa_') || Boolean(p.phone)) && (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 shrink-0" title="Conectado pelo WhatsApp">
                        WhatsApp
                      </span>
                    )}
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
            if (onRematchSameTeams) onRematchSameTeams();
          }}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-950/40 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border border-emerald-500/30 active:scale-95"
        >
          <Swords size={16} />
          <span>Jogar Revanche (Mesmos Times)</span>
        </button>

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
