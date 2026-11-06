import React from 'react';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import PlayerAvatar from './PlayerAvatar';
import ServerConnectBar from './ServerConnectBar';
import { Users, Trash2, Bot, Scale, Shuffle, Shield, Flame, CheckCircle2, Crown, Check, AlertCircle, Zap, Dices, ArrowLeftRight } from 'lucide-react';
import { playClickSound, playReadySound } from '../utils/audio';

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
  serverIp = '',
  onUpdateServerIp,
  rconPassword = '',
  onUpdateRconPassword,
  roomId = 'MIX-PRO',
  liveMatch = null,
  onOpenGsiSetup,
  soundEnabled,
  isAdmin = false,
  adminId = null,
  onKickPlayer,
  onAdminChangeSide,
}) {
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

  const handleMyReadyToggle = () => {
    if (soundEnabled) playReadySound();
    if (myPlayer) {
      onToggleReady(myPlayer.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Mode Shortcuts Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    ? 'bg-orange-500/15 border-orange-500/40 text-orange-400 hover:bg-orange-500/25'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25'
                }`}
                title="Clique para alternar entre o ranking Gamers Club e FACEIT"
              >
                <span>{isFaceit ? '⚡ Modo: FACEIT' : '🛡️ Modo: GC'}</span>
                <ArrowLeftRight size={10} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {isFaceit ? (
              <>
                <span className="text-[11px] bg-slate-950/80 border border-orange-500/30 px-2.5 py-0.5 rounded-lg text-slate-300 font-mono">
                  Média FACEIT: <strong className="text-orange-400">Lvl {avgFaceit}</strong>
                </span>
                {avgElo && (
                  <span className="text-[11px] bg-slate-950/80 border border-slate-800 px-2.5 py-0.5 rounded-lg text-slate-300 font-mono">
                    Média ELO: <strong className="text-amber-300">{avgElo} pts</strong>
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-[11px] bg-slate-950/80 border border-amber-500/30 px-2.5 py-0.5 rounded-lg text-slate-300 font-mono">
                  Média GC: <strong className="text-amber-400">Lvl {avgLevel}</strong>
                </span>
                <span className="text-[11px] bg-slate-950/80 border border-slate-800 px-2.5 py-0.5 rounded-lg text-slate-300 font-mono">
                  Soma Total: <strong className="text-slate-200">{totalLevel} pts</strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons & My Ready Toggle */}
        <div className="flex items-center flex-wrap gap-2">
          {myPlayer && (
            <button
              onClick={handleMyReadyToggle}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                isMyPlayerReady
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Check size={15} />
              <span>{isMyPlayerReady ? 'Você está Pronto! ✅' : 'Dar Ready (Pronto)'}</span>
            </button>
          )}

          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onFillMockBots();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all shadow-sm cursor-pointer"
            title="Preencher com 10 jogadores profissionais brasileiros para testar o sorteio imediatamente"
          >
            <Bot size={15} />
            <span>⚡ 10 Bots</span>
          </button>

          {players.length > 0 && (
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onClearPlayers();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700/50 hover:border-rose-500/40 text-xs font-semibold transition-all cursor-pointer"
              title="Limpar todos os jogadores da sala"
            >
              <Trash2 size={14} />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* CS2 Server Connect Widget in Lobby */}
      {onUpdateServerIp && (
        <ServerConnectBar
          serverIp={serverIp}
          onUpdateServerIp={onUpdateServerIp}
          rconPassword={rconPassword}
          onUpdateRconPassword={onUpdateRconPassword}
          roomId={roomId}
          liveMatch={liveMatch}
          onOpenGsiSetup={onOpenGsiSetup}
          soundEnabled={soundEnabled}
          title="Servidor de Jogo (FireGames / Dedicado)"
          description="Configure o IP e o RCON do servidor para gerenciar mapa e placar com 1 clique"
        />
      )}

      {/* Players Grid (10 Slots) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {players.map((p) => {
          const pFaceitLevel = p.faceitLevel || (p.level <= 10 ? p.level : Math.round(p.level / 2.1)) || 5;

          return (
            <div
              key={p.id}
              className={`group relative border rounded-xl p-3.5 transition-all shadow-md flex flex-col justify-between hover:border-slate-700 ${
                p.ready
                  ? 'bg-slate-900/95 border-emerald-500/40 shadow-emerald-500/5 ring-1 ring-emerald-500/20'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerAvatar avatar={p.avatar} nick={p.nick} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-sm text-white truncate max-w-[105px] sm:max-w-[85px] lg:max-w-[95px] xl:max-w-[115px]" title={p.nick}>
                        {p.nick}
                      </h3>
                      {p.id === adminId && (
                        <span className="text-[9px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-full flex items-center gap-1 font-mono shadow-sm" title="Criador / Administrador da Sala">
                          <Crown size={9} className="fill-amber-400 text-amber-400" /> Admin
                        </span>
                      )}
                      {p.ready && (
                        <span className="text-emerald-400 font-bold shrink-0 text-xs" title="Jogador pronto">
                          ✓
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 mt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (isAdmin && onAdminChangeSide) {
                            const next = p.side === 'CT' ? 'TR' : p.side === 'TR' ? 'ANY' : 'CT';
                            if (soundEnabled) playClickSound();
                            onAdminChangeSide(p.id, next);
                          }
                        }}
                        className={`transition-all ${isAdmin ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}`}
                        title={isAdmin ? 'Admin: Clique para mudar o lado do jogador (CT / TR / Flex)' : ''}
                      >
                        {p.side === 'CT' && (
                          <span className="flex items-center gap-0.5 text-[9px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                            <Shield size={9} /> CT
                          </span>
                        )}
                        {p.side === 'TR' && (
                          <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                            <Flame size={9} /> TR
                          </span>
                        )}
                        {p.side === 'ANY' && (
                          <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">
                            Flex
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {isFaceit ? (
                    <FaceitBadge level={pFaceitLevel} elo={p.faceitElo} size="md" />
                  ) : (
                    <GCBadge level={p.level} size="md" />
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                <span className={`font-mono text-[10px] tracking-wider uppercase ${p.ready ? 'text-emerald-400 font-bold flex items-center gap-1' : 'text-slate-500 font-medium'}`}>
                  {p.ready ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      PRONTO
                    </>
                  ) : (
                    'AGUARDANDO'
                  )}
                </span>

                {(isAdmin || p.id === myProfile?.id) && (
                  <button
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      if (isAdmin && p.id !== myProfile?.id && onKickPlayer) {
                        onKickPlayer(p.id);
                      } else {
                        onRemovePlayer(p.id);
                      }
                    }}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isAdmin && p.id !== myProfile?.id
                        ? 'text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 border border-rose-500/20'
                        : 'text-slate-500 hover:text-rose-400 hover:bg-slate-800'
                    }`}
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
