import React, { useState, useEffect } from 'react';
import { Play, Sparkles, Swords, Dices, Shield, Flame, Users, Layers, Zap, Trophy, ArrowRight, ExternalLink, Hash } from 'lucide-react';
import { ACTIVE_DUTY_MAPS } from '../data/maps';
import PlayerAvatar from './PlayerAvatar';
import { playClickSound } from '../utils/audio';

export default function LandingPage({
  onEnterRoom,
  onOpenQuickVeto,
  onOpenQuickMapRoll,
  onOpenRoomsHub,
  myProfile,
  soundEnabled,
}) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeRooms, setActiveRooms] = useState([]);

  useEffect(() => {
    fetch('/api/rooms')
      .then((res) => res.json())
      .then((data) => setActiveRooms(data))
      .catch(() => {});
  }, []);

  const handleJoinByCode = (e) => {
    e.preventDefault();
    const code = roomCodeInput.trim().toUpperCase() || 'MIX-PRO';
    if (soundEnabled) playClickSound();
    onEnterRoom(code);
  };

  const isSteamLogged = Boolean(myProfile?.steamId);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-300">
      
      {/* Top Navbar */}
      <nav className="border-b border-slate-800/80 bg-[#0c1220]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center font-black text-xl text-black shadow-lg shadow-amber-500/20 tracking-tighter">
              CS2
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-heading tracking-wide text-white">
                  MIX HUB <span className="text-amber-400 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">GC</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Plataforma de Mix & Pick/Ban Oficial</p>
            </div>
          </div>

          {/* Links desktop */}
          <div className="hidden md:flex items-center gap-5 text-xs font-semibold text-slate-300">
            <a href="#mapas" className="hover:text-amber-400 transition-colors">Mapas Oficiais</a>
            <a href="#recursos" className="hover:text-amber-400 transition-colors">Recursos</a>
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onOpenRoomsHub();
              }}
              className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Layers size={14} />
              <span>Salas Ativas ({activeRooms.length})</span>
            </button>
          </div>

          {/* Steam & Direct Action */}
          <div className="flex items-center gap-2.5">
            {isSteamLogged ? (
              <div className="flex items-center gap-2 bg-slate-900 border border-emerald-500/30 rounded-xl px-2.5 py-1">
                <PlayerAvatar avatar={myProfile.avatar} nick={myProfile.nick} size="sm" />
                <span className="text-xs font-bold text-white hidden sm:inline">{myProfile.nick}</span>
              </div>
            ) : (
              <a
                href="/api/auth/steam?room=MIX-PRO"
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#171a21] hover:bg-[#1b2838] border border-[#66c0f4]/30 text-white text-xs font-bold transition-all"
              >
                <svg className="w-3.5 h-3.5 fill-current text-[#66c0f4]" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2m4.8 5.6a2.4 2.4 0 0 0-2.4 2.4c0 .4.1.8.3 1.1l-3 4.3a2.4 2.4 0 0 0-1.7-.2l-2.4-1a2.4 2.4 0 0 0-4.6 1.8 2.4 2.4 0 0 0 3.3 1.3l2.3 1a2.4 2.4 0 0 0 4 .3l3.2-2.2c.5.2 1.1.3 1.7.3a2.4 2.4 0 0 0 2.4-2.4 2.4 2.4 0 0 0-2.4-2.4z"/>
                </svg>
                <span>Login Steam</span>
              </a>
            )}

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onEnterRoom('MIX-PRO');
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
            >
              <Play size={13} fill="currentColor" />
              <span>Abrir Mix</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 px-4 text-center">
        {/* Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[250px] bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-lg">
            <Sparkles size={14} className="text-amber-400" />
            <span>ROTAÇÃO OFICIAL DA VALVE (ACTIVE DUTY CS2)</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black font-heading text-white tracking-wider leading-tight">
            A PLATAFORMA DE MIX <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-amber-300">
              EQUILIBRADA & COMPETITIVA
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Organize partidas 5v5 com seus amigos em tempo real. Balanceie equipes pela soma exata dos níveis da <strong>Gamers Club (1 a 21)</strong> ou pule direto para o <strong>Pick & Ban oficial</strong> de mapas!
          </p>

          {/* Quick Room Code Box */}
          <div className="max-w-lg mx-auto bg-slate-900/90 border-2 border-slate-800 focus-within:border-amber-400/80 rounded-2xl p-2 shadow-2xl backdrop-blur flex flex-col sm:flex-row gap-2 transition-all">
            <div className="flex-1 flex items-center pl-3">
              <Hash size={16} className="text-slate-500 mr-2" />
              <input
                type="text"
                placeholder="Código da sala (ex: MIX-CORUJA)..."
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                className="w-full bg-transparent text-sm font-mono text-white placeholder-slate-500 outline-none"
              />
            </div>
            <button
              onClick={handleJoinByCode}
              className="py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Entrar / Criar Sala</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Fast Action Shortcuts */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onOpenQuickVeto();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Zap size={15} className="text-sky-400" />
              <span>⚡ Veto Rápido (Times Prontos)</span>
            </button>

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onOpenQuickMapRoll();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Dices size={15} className="text-amber-400" />
              <span>🎲 Roleta de Mapa Aleatório</span>
            </button>
          </div>
        </div>
      </section>

      {/* Official Map Pool Section */}
      <section id="mapas" className="max-w-7xl mx-auto px-4 py-16 w-full">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
            Active Duty Oficial CS2
          </div>
          <h2 className="text-3xl font-black font-heading text-white">
            Fotos & Logos Reais do Counter-Strike 2
          </h2>
          <p className="text-xs text-slate-400">
            Capturas em alta definição direto dos arquivos do jogo com as insígnias oficiais de cada mapa.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ACTIVE_DUTY_MAPS.map((map) => (
            <div
              key={map.id}
              className="relative overflow-hidden rounded-2xl border-2 border-slate-800 hover:border-amber-400/80 bg-slate-950 shadow-xl min-h-[220px] flex flex-col justify-between p-4 group transition-all"
            >
              {/* Map Screenshot */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 opacity-70"
                style={{ backgroundImage: `url(${map.image})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

              {/* Header */}
              <div className="relative z-10 flex items-start justify-between">
                <span className="text-[10px] font-mono uppercase bg-slate-900/90 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded shadow">
                  Oficial Valve
                </span>
                <span className="text-xs font-mono text-slate-300 bg-slate-950/90 px-2 py-0.5 rounded border border-slate-800">
                  {map.file}
                </span>
              </div>

              {/* Logo & Name */}
              <div className="relative z-10 flex items-center gap-3">
                <img
                  src={map.logo}
                  alt={map.name}
                  className="w-12 h-12 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] filter brightness-110 group-hover:scale-110 transition-transform"
                />
                <div>
                  <h3 className="text-2xl font-black font-heading text-white tracking-wide">
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
      <section id="recursos" className="max-w-7xl mx-auto px-4 py-16 w-full border-t border-slate-800/80">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <h2 className="text-3xl font-black font-heading text-white">
            Tudo o que Você Precisa para o seu Mix
          </h2>
          <p className="text-xs text-slate-400">
            Desenvolvido sob medida para streamers, amigos e comunidades competitivas de CS2.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Trophy size={24} />
            </div>
            <h3 className="font-bold text-base font-heading text-white">Equilíbrio Gamers Club (1 a 21)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              O algoritmo avalia matematicamente todas as partições possíveis de 5v5 para que os dois times tenham médias de nível praticamente idênticas.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
              <Swords size={24} />
            </div>
            <h3 className="font-bold text-base font-heading text-white">Pick & Ban em Tempo Real</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Veto com turnos alternados entre os capitães, carimbo de ban animado, reveal do mapa decisivo com chuva de confetes e escolha de lados.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Layers size={24} />
            </div>
            <h3 className="font-bold text-base font-heading text-white">Múltiplas Salas Simultâneas</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Crie salas com links únicos para mandar no WhatsApp ou Discord. Vários grupos de amigos podem jogar ao mesmo tempo em salas separadas!
            </p>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/10 border-y border-amber-500/20 py-16 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-3xl font-black font-heading text-white">
            Pronto para Jogar o Mix com os Amigos?
          </h2>
          <p className="text-xs text-slate-300">
            Abra uma sala agora mesmo, mande o link para a galera e decidam quem manda no servidor!
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onEnterRoom('MIX-PRO');
              }}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-amber-500/25 cursor-pointer inline-flex items-center gap-2"
            >
              <Play size={16} fill="currentColor" />
              <span>Entrar no Mix Agora ➔</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-500">
        <p>CS2 Mix Hub • Rotação Oficial Valve (Active Duty) • Todos os direitos reservados aos respectivos criadores do jogo.</p>
      </footer>
    </div>
  );
}
