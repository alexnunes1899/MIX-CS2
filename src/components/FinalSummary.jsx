import React, { useState } from 'react';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import PlayerAvatar from './PlayerAvatar';
import { CS2_MAPS } from '../data/maps';
import { Trophy, Share2, Terminal, RotateCcw, Shield, Flame, Check, History, Zap, Radio, Sparkles, Bell, Play, Pause, RefreshCw, Send, Image } from 'lucide-react';
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
  soundEnabled,
}) {
  const [copiedDiscord, setCopiedDiscord] = useState(false);
  const [copiedRcon, setCopiedRcon] = useState(false);
  const [discordSending, setDiscordSending] = useState(false);
  const [discordSent, setDiscordSent] = useState(false);
  const [rconExecuting, setRconExecuting] = useState(null);

  const { finalMap, teamA = [], teamB = [], metrics, startingSideTeamB, name: roomName = 'MIX', serverIp = '', rconPassword = '', liveMatch = null, rankingSystem = 'gc', discordWebhook = '' } = room;
  const { labelA, labelB, upperA, upperB } = getTeamNames(room);
  const isFaceit = rankingSystem === 'faceit';
  const fullMap = CS2_MAPS.find((m) => m.id === finalMap?.id) || finalMap;

  const sideTeamB = startingSideTeamB || 'CT';
  const sideTeamA = sideTeamB === 'CT' ? 'TR' : 'CT';

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
              const sideA = item.sideTimeA || 'CT';
              const sideB = sideA === 'CT' ? 'TR' : 'CT';
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
                    <span className="text-sky-400">{labelA}: {sideA}</span>
                    <span className="text-amber-400">{labelB}: {sideB}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                  {upperA} • Começa de {sideTeamA}
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
                  {upperB} • Começa de {sideTeamB}
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
