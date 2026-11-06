import React, { useState, useEffect } from 'react';
import { Play, Sparkles, Swords, Dices, Shield, Flame, Users, Layers, Zap, Trophy, ArrowRight, ExternalLink, Hash, CheckCircle2, Monitor, RefreshCw, Globe } from 'lucide-react';
import { ACTIVE_DUTY_MAPS, EXTRA_CS2_MAPS } from '../data/maps';
import PlayerAvatar from './PlayerAvatar';
import SteamIcon from './SteamIcon';
import { playClickSound } from '../utils/audio';

export default function LandingPage({
  onEnterRoom,
  onOpenQuickVeto,
  onOpenQuickMapRoll,
  onOpenRoomsHub,
  onRequireSteamLogin,
  onOpenProfile,
  myProfile,
  soundEnabled,
  officialRotation,
  syncingRotation,
  onSyncOfficialRotation,
}) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeRooms, setActiveRooms] = useState([]);
  const [mapTab, setMapTab] = useState('active');

  const activeDutyMaps = officialRotation?.activeDutyMaps && officialRotation.activeDutyMaps.length > 0
    ? officialRotation.activeDutyMaps
    : ACTIVE_DUTY_MAPS;

  const extraMaps = officialRotation?.extraMaps && officialRotation.extraMaps.length > 0
    ? officialRotation.extraMaps
    : EXTRA_CS2_MAPS;

  const currentDisplayMaps = mapTab === 'active' ? activeDutyMaps : extraMaps;

  useEffect(() => {
    fetch('/api/rooms')
      .then((res) => res.json())
      .then((data) => setActiveRooms(data))
      .catch(() => {});
  }, []);

  const isSteamLogged = Boolean(myProfile?.steamId);

  const handleJoinByCode = (e) => {
    e.preventDefault();
    const defaultCode = myProfile?.nick
      ? `TIME-${myProfile.nick.toUpperCase().replace(/[^A-Z0-9]/g, '')}`
      : 'MIX-PRO';
    const code = roomCodeInput.trim().toUpperCase() || defaultCode;
    if (!isSteamLogged) {
      if (onRequireSteamLogin) {
        onRequireSteamLogin('criar ou entrar em uma sala de mix');
      } else {
        window.location.href = `/api/auth/steam?room=${encodeURIComponent(code)}`;
      }
      return;
    }
    if (soundEnabled) playClickSound();
    onEnterRoom(code);
  };

  const handleCreateMix = (code = 'MIX-PRO') => {
    if (!isSteamLogged) {
      if (onRequireSteamLogin) {
        onRequireSteamLogin('criar ou entrar em um mix');
      } else {
        window.location.href = `/api/auth/steam?room=${encodeURIComponent(code)}`;
      }
      return;
    }
    if (soundEnabled) playClickSound();
    onEnterRoom(code);
  };
  const handleOpenMix = handleCreateMix;

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-300">
      
      {/* Top Navbar */}
      <nav className="border-b border-white/[0.08] bg-[#0c1220]/85 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          
          {/* Logo with CS2 Icon */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="relative w-10 h-10 flex items-center justify-center group-hover:scale-105 transition-transform">
              <img src="/favicon.png" alt="CS2 Mix" className="w-10 h-10 object-contain drop-shadow-[0_2px_10px_rgba(245,158,11,0.3)]" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0c1220] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-heading tracking-wider text-white group-hover:text-amber-400 transition-colors">
                  MIX HUB
                </span>
                <span className="text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 font-mono">
                  GC EDITION
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight">PLATAFORMA COMPETITIVA 5V5</p>
            </div>
          </div>

          {/* Links desktop */}
          <div className="hidden md:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <a href="#mapas" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
              <span>Mapas Oficiais</span>
            </a>
            <a href="#recursos" className="hover:text-amber-400 transition-colors">
              <span>Recursos</span>
            </a>
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onOpenRoomsHub();
              }}
              className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 px-3 py-1.5 rounded-lg"
            >
              <Layers size={13} className="text-amber-400" />
              <span>Salas Ativas</span>
              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.2 rounded">
                {activeRooms.length}
              </span>
            </button>
          </div>

          {/* Steam & Direct Action */}
          <div className="flex items-center gap-2.5">
            {isSteamLogged ? (
              <button
                type="button"
                onClick={() => onOpenProfile && onOpenProfile()}
                title="Abrir meu perfil e estatísticas Steam"
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 hover:border-emerald-400 rounded-xl px-2.5 py-1.5 shadow-sm transition-all cursor-pointer group"
              >
                <PlayerAvatar avatar={myProfile.avatar} nick={myProfile.nick} size="sm" />
                <span className="text-xs font-bold text-white hidden sm:inline group-hover:text-amber-400 transition-colors">
                  {myProfile.nick}
                </span>
                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded group-hover:bg-emerald-500/25">
                  Stats
                </span>
              </button>
            ) : (
              <a
                href="/api/auth/steam?room=MIX-PRO"
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-[#171a21] to-[#1b2838] hover:from-[#1b2838] hover:to-[#2a475e] border border-[#66c0f4]/40 hover:border-[#66c0f4] text-white text-xs font-bold transition-all shadow-md group cursor-pointer"
              >
                <SteamIcon className="w-4 h-4 text-[#66c0f4] group-hover:scale-110 transition-transform" />
                <span>Login Steam</span>
              </a>
            )}

            <button
              onClick={() => onOpenRoomsHub()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Play size={13} fill="currentColor" />
              <span>Criar Mix</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 px-4 text-center">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[350px] h-[250px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          
          {/* Tactical Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-widest shadow-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>ROTAÇÃO OFICIAL VALVE 2026 • BALANCEADOR GAMERS CLUB</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black font-heading text-white tracking-wider leading-[1.05]">
            JOGUE MIX COM SEUS AMIGOS <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-yellow-200 drop-shadow-sm">
              COMO UM PROFISSIONAL
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Crie salas de mix com link direto, escolha entre o ranking manual da <strong>Gamers Club (1 a 21)</strong> ou automático da <strong>FACEIT (1 a 10 / ELO)</strong> via Steam, e dispute o <strong>Pick & Ban oficial</strong> de mapas da Valve.
          </p>

          {/* Quick Room Code Box (Tactical Glassmorphism) */}
          <div className="max-w-lg mx-auto glass-panel border-2 border-white/[0.1] focus-within:border-amber-400 rounded-2xl p-2.5 shadow-2xl backdrop-blur-2xl flex flex-col sm:flex-row gap-2 transition-all">
            <div className="flex-1 flex items-center pl-3">
              <Hash size={18} className="text-amber-400 mr-2" />
              <input
                type="text"
                placeholder={myProfile?.nick ? `Código da sala (ex: TIME-${myProfile.nick.toUpperCase()})...` : 'Código da sala (ex: TIME-ALEX)...'}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                className="w-full bg-transparent text-sm font-mono text-white placeholder-slate-500 outline-none font-semibold"
              />
            </div>
            <button
              onClick={handleJoinByCode}
              className="py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>Entrar / Criar Sala</span>
              <ArrowRight size={15} />
            </button>
          </div>

          {/* Fast Action Shortcuts */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onOpenQuickVeto();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-sky-300 border border-sky-500/30 hover:border-sky-400 text-xs font-bold transition-all shadow-md cursor-pointer group"
            >
              <Zap size={15} className="text-sky-400 group-hover:scale-110 transition-transform" />
              <span>⚡ Veto Rápido (Times Prontos)</span>
            </button>

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onOpenQuickMapRoll();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-500/30 hover:border-amber-400 text-xs font-bold transition-all shadow-md cursor-pointer group"
            >
              <Dices size={15} className="text-amber-400 group-hover:rotate-45 transition-transform" />
              <span>🎲 Roleta de Mapa Aleatório</span>
            </button>
          </div>
        </div>
      </section>

      {/* Stats Ribbon */}
      <div className="border-y border-white/[0.08] bg-[#0c1220]/60 backdrop-blur-md py-6">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-black font-heading text-amber-400 tracking-wider">7 MAPAS</div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold mt-0.5">Rotação Active Duty Valve</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-heading text-sky-400 tracking-wider">1 A 21</div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold mt-0.5">Patentes Gamers Club</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-heading text-emerald-400 tracking-wider">TEMPO REAL</div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold mt-0.5">Sincronização sem F5</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-heading text-purple-400 tracking-wider">1-CLIQUE</div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold mt-0.5">Steam Login & Conectar</div>
          </div>
        </div>
      </div>

      {/* Official & Extra Map Pool Section */}
      <section id="mapas" className="max-w-7xl mx-auto px-4 py-20 w-full">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
            Pool Oficial & Reserva CS2
          </div>
          <h2 className="text-3xl sm:text-4xl font-black font-heading text-white tracking-wide">
            Fotos & Logos Reais do Counter-Strike 2
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Capturas reais em alta definição direto dos arquivos do jogo CS2 acompanhadas das insígnias oficiais de cada mapa da Valve.
          </p>

          {/* Live Sync Information Badge & Manual Refresh Button */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Fonte Confiável:</span>
              <strong className="text-amber-300 font-medium">
                {officialRotation?.source || 'Wikipedia / Valve Esports Records'}
              </strong>
            </div>

            {onSyncOfficialRotation && (
              <button
                type="button"
                disabled={syncingRotation}
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  onSyncOfficialRotation();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                title="Buscar e sincronizar rotação oficial mundial em tempo real"
              >
                <RefreshCw size={12} className={syncingRotation ? 'animate-spin text-amber-400' : 'text-amber-400'} />
                <span>{syncingRotation ? 'Sincronizando...' : 'Sincronizar Rotação Oficial'}</span>
              </button>
            )}
          </div>

          {/* Interactive Map Filter Tabs */}
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                setMapTab('active');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-1.5 ${
                mapTab === 'active'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/25'
                  : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              <Trophy size={13} />
              <span>Rotação Oficial ({activeDutyMaps.length} Mapas)</span>
            </button>

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                setMapTab('extra');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-1.5 ${
                mapTab === 'extra'
                  ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-lg shadow-sky-500/25'
                  : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              <Sparkles size={13} />
              <span>Mapas Extras / CS2 ({extraMaps.length} Mapas)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {currentDisplayMaps.map((map) => (
            <div
              key={map.id}
              className="relative overflow-hidden rounded-2xl border-2 border-white/[0.08] hover:border-amber-400/80 bg-slate-950 shadow-2xl min-h-[240px] flex flex-col justify-between p-4 group transition-all duration-300 hover:-translate-y-1"
            >
              {/* Map Screenshot */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 opacity-70"
                style={{ backgroundImage: `url(${map.image})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20" />

              {/* Header */}
              <div className="relative z-10 flex items-start justify-between">
                <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full shadow flex items-center gap-1 border ${
                  map.activeDuty
                    ? 'bg-slate-900/90 text-amber-300 border-amber-500/40'
                    : 'bg-slate-900/90 text-sky-300 border-sky-500/40'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${map.activeDuty ? 'bg-amber-400' : 'bg-sky-400'}`} />
                  {map.activeDuty ? 'Active Duty' : map.category === 'hostage' ? 'Reféns' : 'Reserva CS2'}
                </span>
                <span className="text-xs font-mono font-bold text-slate-200 bg-slate-950/90 px-2 py-0.5 rounded border border-slate-800">
                  {map.file}
                </span>
              </div>

              {/* Logo & Name */}
              <div className="relative z-10 flex items-center gap-3">
                <img
                  src={map.logo}
                  alt={map.name}
                  className="w-14 h-14 object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] filter brightness-110 group-hover:scale-110 transition-transform"
                />
                <div>
                  <h3 className="text-2xl font-black font-heading text-white tracking-wider drop-shadow-md">
                    {map.name}
                  </h3>
                  <span className="text-xs text-slate-300 font-medium">
                    {map.location}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="recursos" className="max-w-7xl mx-auto px-4 py-20 w-full border-t border-white/[0.08]">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 text-xs font-bold uppercase tracking-wider">
            Arquitetura de Alta Performance
          </div>
          <h2 className="text-3xl sm:text-4xl font-black font-heading text-white tracking-wide">
            Diagramação & Recursos de Alto Nível
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Desenvolvido com design responsivo, alta legibilidade e tecnologia em tempo real sem atrasos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Trophy size={24} />
            </div>
            <h3 className="font-bold text-base font-heading text-white tracking-wide">Equilíbrio Gamers Club (1 a 21)</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              O algoritmo avalia matematicamente todas as 126 combinações possíveis de 5v5 para que os dois times tenham médias de nível praticamente idênticas.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
              <Swords size={24} />
            </div>
            <h3 className="font-bold text-base font-heading text-white tracking-wide">Pick & Ban Oficial em Tempo Real</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              Veto com turnos alternados entre os capitães, carimbo de ban animado, reveal do mapa decisivo com chuva de confetes e escolha de lados.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Layers size={24} />
            </div>
            <h3 className="font-bold text-base font-heading text-white tracking-wide">Múltiplas Salas Isoladas</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              Crie salas com links únicos para mandar no WhatsApp ou Discord. Vários grupos de amigos podem jogar ao mesmo tempo em salas separadas!
            </p>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/10 border-y border-amber-500/20 py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-5">
          <h2 className="text-3xl sm:text-5xl font-black font-heading text-white tracking-wide">
            Pronto para Dominar o Servidor?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
            Crie sua sala agora mesmo, convide os amigos pelo link e monte as melhores partidas de Counter-Strike 2.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onOpenRoomsHub()}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-amber-500/30 cursor-pointer inline-flex items-center gap-2 active:scale-95"
            >
              <Play size={16} fill="currentColor" />
              <span>Criar Mix Agora ➔</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#060911] py-8 text-center text-xs text-slate-500">
        <p>CS2 Mix Hub • Rotação Oficial Valve (Active Duty) • Todos os direitos reservados aos criadores do Counter-Strike 2.</p>
      </footer>
    </div>
  );
}
