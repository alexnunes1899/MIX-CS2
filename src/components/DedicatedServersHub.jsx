import React, { useState, useEffect } from 'react';
import MainNavigationMenu from './MainNavigationMenu';
import {
  Server,
  Laptop,
  Home,
  Network,
  Globe,
  Terminal,
  Download,
  Play,
  Copy,
  Check,
  Key,
  RefreshCw,
  Zap,
  ArrowLeft,
  ExternalLink,
  Wifi,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileCode,
  Layers,
  HelpCircle,
  PlayCircle,
  Info,
  Sliders,
  Flame,
  Trophy,
  Dices,
  Bell,
} from 'lucide-react';
import { playClickSound } from '../utils/audio';
import { parseServerDetails } from '../utils/serverParser';
import { ACTIVE_DUTY_MAPS } from '../data/maps';
import { copyText } from '../utils/clipboard';

export default function DedicatedServersHub({
  roomId = '',
  currentServerIp = '',
  rconPassword = '',
  finalMap = 'de_mirage',
  onUpdateServerIp,
  onUpdateRconPassword,
  onGoHome,
  onGoToRoom,
  onOpenQuickVeto,
  onOpenQuickMapRoll,
  onOpenRoomsHub,
  onOpenLeaderboard,
  onOpenDiscordModal,
  onOpenProfile,
  soundEnabled,
  myProfile,
}) {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const t = p.get('tab');
      if (['online', 'lan', 'radmin', 'public', 'cfg'].includes(t)) return t;
    } catch (e) {}
    return 'online';
  });

  const changeTab = (t) => {
    if (soundEnabled) playClickSound();
    setActiveTab(t);
    try {
      const u = new URL(window.location);
      u.searchParams.set('tab', t);
      window.history.replaceState({}, '', u);
    } catch (e) {}
  };
  
  // Online Dedicated Server state
  const [onlineIpInput, setOnlineIpInput] = useState(currentServerIp || '');
  const [rconPassInput, setRconPassInput] = useState(rconPassword || '');
  const [rconTesting, setRconTesting] = useState(false);
  const [rconStatusMsg, setRconStatusMsg] = useState(null);
  const [pingTesting, setPingTesting] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  // Local Host states
  const [radminIp, setRadminIp] = useState('');
  const [lanIp, setLanIp] = useState('192.168.1.100');
  const [publicIp, setPublicIp] = useState('');
  const [detectedLanIps, setDetectedLanIps] = useState([]);
  const [detectingIp, setDetectingIp] = useState(false);
  const [port, setPort] = useState('27015');
  const [selectedMap, setSelectedMap] = useState(finalMap || 'de_mirage');

  // Port reachability state
  const [checkingPort, setCheckingPort] = useState(false);
  const [portCheckResult, setPortCheckResult] = useState(null);

  // Copy feedback states
  const [copiedConnect, setCopiedConnect] = useState(false);
  const [copiedHostCmd, setCopiedHostCmd] = useState(false);
  const [appliedToast, setAppliedToast] = useState(false);

  // Auto-detect IPs on mount
  useEffect(() => {
    if (currentServerIp) {
      setOnlineIpInput(currentServerIp);
      const parts = currentServerIp.split(':');
      if (parts[0].startsWith('26.')) {
        setRadminIp(parts[0]);
        setActiveTab('radmin');
      } else if (parts[0].startsWith('192.168.') || parts[0].startsWith('10.') || parts[0].startsWith('172.')) {
        setLanIp(parts[0]);
        setActiveTab('lan');
      }
      if (parts[1]) setPort(parts[1]);
    }

    if (rconPassword) {
      setRconPassInput(rconPassword);
    }

    setDetectingIp(true);
    fetch('/api/my-ip')
      .then((res) => res.json())
      .then((data) => {
        if (data?.ip) setPublicIp(data.ip);
      })
      .catch(() => {});

    fetch('/api/lan-ip')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.ips) && data.ips.length > 0) {
          setDetectedLanIps(data.ips);
          const radminNet = data.ips.find((it) => it.address.startsWith('26.'));
          if (radminNet) setRadminIp(radminNet.address);
          const localNet = data.ips.find((it) => !it.address.startsWith('26.'));
          if (localNet) setLanIp(localNet.address);
        }
      })
      .catch(() => {})
      .finally(() => setDetectingIp(false));
  }, [currentServerIp, rconPassword]);

  // Clean map code
  const cleanMap = (selectedMap || 'de_mirage').toLowerCase().replace(/[^a-z0-9_]/g, '');

  // Active address computation
  let activeCalculatedIp = '';
  if (activeTab === 'online') activeCalculatedIp = onlineIpInput.trim();
  else if (activeTab === 'lan') activeCalculatedIp = `${lanIp.trim()}:${port.trim() || '27015'}`;
  else if (activeTab === 'radmin') activeCalculatedIp = `${radminIp.trim() || '26.x.x.x'}:${port.trim() || '27015'}`;
  else if (activeTab === 'public') activeCalculatedIp = `${publicIp.trim()}:${port.trim() || '27015'}`;
  else activeCalculatedIp = currentServerIp || '';

  const parsedActive = parseServerDetails(activeCalculatedIp);

  // Host console command
  const isLan = activeTab === 'lan';
  const hostConsoleCmd = `sv_lan ${isLan ? '1' : '0'}; bot_kick; mp_warmup_end 1; exec gamemode_competitive; mp_restartgame 1; map ${cleanMap}`;

  // Mix CFG
  const mixCfgContent = `// CS2 Mix Hub - Configuracao Competitiva Oficial 5v5
sv_lan ${isLan ? '1' : '0'}
bot_kick
mp_autoteambalance 0
mp_limitteams 0
mp_roundtime 1.92
mp_roundtime_defuse 1.92
mp_maxrounds 24
mp_halftime 1
mp_halftime_duration 10
mp_overtime_enable 1
mp_overtime_maxrounds 6
mp_overtime_startmoney 10000
mp_startmoney 800
mp_freezetime 15
mp_c4timer 40
mp_warmup_end 1
mp_restartgame 1
echo "========================================="
echo " CS2 MIX HUB - CONFIG COMPETITIVA ATIVA! "
echo "========================================="
`;

  // Automated Batch File Generator
  const generateBatScript = (mode) => {
    let targetIp = lanIp;
    if (mode === 'radmin') targetIp = radminIp || '26.x.x.x';
    if (mode === 'public') targetIp = publicIp || 'IP_PUBLICO';

    return `@echo off
chcp 65001 >nul
cls
echo ======================================================================
echo           CS2 MIX HUB - INICIANDO SERVIDOR LOCAL AUTOMATICO
echo ======================================================================
echo.
echo Modo: ${mode.toUpperCase()}
echo Mapa: ${cleanMap}
echo Porta: ${port}
echo IP do Servidor: ${targetIp}:${port}
echo.
echo Pressione qualquer tecla para abrir o CS2 direto no mapa com config 5v5...
pause >nul
echo.
echo Abrindo Counter-Strike 2...
start steam://run/730//+sv_lan ${mode === 'lan' ? '1' : '0'} +map ${cleanMap} +exec gamemode_competitive +bot_kick +port ${port}
echo.
echo [SUCESSO] CS2 iniciado! Mande o comando connect para seus amigos:
echo connect ${targetIp}:${port}
echo.
pause
`;
  };

  const handleDownloadBat = (mode) => {
    if (soundEnabled) playClickSound();
    const content = generateBatScript(mode);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `INICIAR-CS2-${mode.toUpperCase()}.bat`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCfg = () => {
    if (soundEnabled) playClickSound();
    const blob = new Blob([mixCfgContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'gamemode_competitive_mix.cfg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Test Server Ping (UDP A2S_INFO & TCP)
  const handleTestPing = async () => {
    const raw = activeTab === 'online' ? onlineIpInput : activeCalculatedIp;
    const parsed = parseServerDetails(raw);
    if (!parsed.isValid) {
      setPingResult({ online: false, error: 'Digite um IP e porta válidos (ex: 189.1.168.10:27015)' });
      return;
    }
    setPingTesting(true);
    setPingResult(null);
    if (soundEnabled) playClickSound();

    try {
      const parts = parsed.ip.split(':');
      const res = await fetch('/api/server/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: parts[0], port: parts[1] || 27015 }),
      });
      const data = await res.json();
      setPingResult(data);
    } catch (e) {
      setPingResult({ online: false, error: 'Erro ao comunicar com a verificação de ping.' });
    } finally {
      setPingTesting(false);
    }
  };

  // Test Port Reachability
  const handleCheckPort = async () => {
    setCheckingPort(true);
    setPortCheckResult(null);
    if (soundEnabled) playClickSound();

    try {
      const res = await fetch(`/api/server/check-port?port=${port || 27015}`);
      const data = await res.json();
      setPortCheckResult(data);
    } catch (e) {
      setPortCheckResult({ reachable: false, error: 'Erro ao verificar a porta.' });
    } finally {
      setCheckingPort(false);
    }
  };

  // RCON Test & Exec
  const handleTestRcon = async () => {
    if (!parsedActive.isValid || !rconPassInput) {
      setRconStatusMsg({ text: 'Informe o IP do servidor e a senha RCON.', type: 'error' });
      return;
    }
    setRconTesting(true);
    setRconStatusMsg(null);
    if (soundEnabled) playClickSound();

    try {
      const parts = parsedActive.ip.split(':');
      const res = await fetch('/api/rcon/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: parts[0],
          port: parts[1] || 27015,
          password: rconPassInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRconStatusMsg({ text: '✓ Conexão RCON bem-sucedida! Servidor respondendo.', type: 'success' });
        if (onUpdateRconPassword) onUpdateRconPassword(rconPassInput.trim());
      } else {
        setRconStatusMsg({ text: data.error || 'Falha na autenticação RCON.', type: 'error' });
      }
    } catch (e) {
      setRconStatusMsg({ text: 'Erro ao conectar no RCON.', type: 'error' });
    } finally {
      setRconTesting(false);
    }
  };

  const handleExecRcon = async (cmd, label) => {
    if (!parsedActive.isValid || !rconPassInput) {
      setRconStatusMsg({ text: 'Configure a senha RCON primeiro.', type: 'error' });
      return;
    }
    setRconTesting(true);
    if (soundEnabled) playClickSound();

    try {
      const parts = parsedActive.ip.split(':');
      const res = await fetch('/api/rcon/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: parts[0],
          port: parts[1] || 27015,
          password: rconPassInput.trim(),
          command: cmd,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRconStatusMsg({ text: `✓ Comando "${label}" executado com sucesso!`, type: 'success' });
        setTimeout(() => setRconStatusMsg(null), 4000);
      } else {
        setRconStatusMsg({ text: data.error || 'Falha ao executar comando.', type: 'error' });
      }
    } catch (e) {
      setRconStatusMsg({ text: 'Erro ao enviar comando.', type: 'error' });
    } finally {
      setRconTesting(false);
    }
  };

  // Apply to Mix Room
  const handleApplyToRoom = () => {
    if (!parsedActive.isValid) return;
    if (soundEnabled) playClickSound();
    if (onUpdateServerIp) {
      onUpdateServerIp(parsedActive.ip);
    }
    if (onUpdateRconPassword && rconPassInput) {
      onUpdateRconPassword(rconPassInput.trim());
    }
    setAppliedToast(true);
    setTimeout(() => setAppliedToast(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      
      {/* Top Navbar — Menu de Início Sempre Visível */}
      <header className="border-b border-slate-800 bg-[#0c1220]/95 backdrop-blur-xl sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2.5 sm:py-3 space-y-2.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            
            {/* Left: Logo & Back */}
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2.5 cursor-pointer group"
                onClick={onGoHome}
              >
                <img src="/favicon.png" alt="CS2 Mix" className="w-9 h-9 object-contain drop-shadow-[0_2px_10px_rgba(245,158,11,0.3)] group-hover:scale-105 transition-transform" />
                <div>
                  <span className="text-base font-bold font-heading tracking-wider text-white group-hover:text-amber-400 transition-colors">
                    MIX HUB
                  </span>
                </div>
              </div>

              {roomId && onGoToRoom && (
                <button
                  type="button"
                  onClick={() => onGoToRoom(roomId)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <ArrowLeft size={14} />
                  <span>Voltar para o Mix ({roomId})</span>
                </button>
              )}
            </div>

            {/* Center: Title Pill */}
            <div className="hidden md:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 font-mono">
                Central Oficial de Servidores CS2
              </span>
            </div>

            {/* Right: Active Room Server Badge */}
            <div className="flex items-center gap-2">
              {currentServerIp ? (
                <div className="flex items-center gap-2 bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-1 text-xs font-mono">
                  <span className="text-slate-500 text-[10px]">SERVIDOR ATUAL:</span>
                  <strong className="text-emerald-400">{currentServerIp}</strong>
                </div>
              ) : (
                <div className="text-[11px] font-mono text-slate-500 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                  Nenhum servidor vinculado à sala
                </div>
              )}
            </div>
          </div>

          {/* ROW 2: MENU DE INÍCIO — CENTRALIZADO E COM DESIGN ESPORTS UNIFICADO */}
          <MainNavigationMenu
            activeTab="servers"
            onGoHome={onGoHome}
            onOpenLeaderboard={onOpenLeaderboard}
            onOpenDiscordModal={onOpenDiscordModal}
            onOpenQuickMapRoll={onOpenQuickMapRoll}
            onOpenQuickVeto={onOpenQuickVeto}
            onOpenServersPage={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            onOpenRoomsHub={onOpenRoomsHub}
            soundEnabled={soundEnabled}
          />
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 py-8 flex-1 space-y-8">
        
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-emerald-500/30 p-6 sm:p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider font-mono">
              <Sparkles size={13} />
              Hub Completo com Automação de Inicialização & Diagnóstico
            </div>
            <h1 className="text-2xl sm:text-4xl font-black font-heading text-white tracking-wide">
              Central de Servidores: Dedicado Online ou Host no seu PC
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Tudo o que você precisa para rodar o mix com os amigos. Escolha entre conectar a um <strong>servidor online dedicado</strong> (FireGames/Dathost) com suporte a RCON e GSI, ou jogar <strong>100% de graça no seu próprio computador</strong> via rede local (LAN com 0ms de ping) ou via Radmin VPN sem abrir portas no roteador!
            </p>
          </div>
        </div>

        {/* Applied Toast Alert */}
        {appliedToast && (
          <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold text-xs flex items-center justify-between shadow-2xl animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} />
              <span>Servidor aplicado à sala {roomId} com sucesso! Todos os 10 jogadores já receberam o botão connect.</span>
            </div>
            {onGoToRoom && (
              <button
                type="button"
                onClick={() => onGoToRoom(roomId)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Ir para o Mix
              </button>
            )}
          </div>
        )}

        {/* Server Type Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-slate-950/90 p-2 rounded-2xl border border-slate-800 shadow-xl">
          <button
            type="button"
            onClick={() => changeTab('online')}
            className={`p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'online'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20 scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Server size={16} />
            <span>1. Online Dedicado</span>
          </button>

          <button
            type="button"
            onClick={() => changeTab('lan')}
            className={`p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'lan'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20 scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Home size={16} />
            <span>2. LAN (Mesma Casa)</span>
          </button>

          <button
            type="button"
            onClick={() => changeTab('radmin')}
            className={`p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'radmin'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Network size={16} />
            <span>3. Radmin VPN</span>
          </button>

          <button
            type="button"
            onClick={() => changeTab('public')}
            className={`p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'public'
                ? 'bg-sky-500 text-slate-950 font-black shadow-lg shadow-sky-500/20 scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Globe size={16} />
            <span>4. IP Público / Portas</span>
          </button>

          <button
            type="button"
            onClick={() => changeTab('cfg')}
            className={`p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer col-span-2 md:col-span-1 ${
              activeTab === 'cfg'
                ? 'bg-indigo-500 text-slate-950 font-black shadow-lg shadow-indigo-500/20 scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Terminal size={16} />
            <span>5. CFG & Console CS2</span>
          </button>
        </div>

        {/* TAB 1: ONLINE DEDICADO */}
        {activeTab === 'online' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Form & Actions */}
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold font-heading text-white flex items-center gap-2">
                      <Server size={18} className="text-emerald-400" />
                      Configurar Servidor Online Dedicado
                    </h3>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      Dathost / FireGames / VPS
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Cole o endereço IP:Porta do seu servidor de CS2 (ou comando completo com senha). Se você tiver a senha RCON, ative o controle remoto para iniciar a partida e mudar mapas diretamente pelo site.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Endereço IP e Porta do Servidor:
                      </label>
                      <input
                        type="text"
                        value={onlineIpInput}
                        onChange={(e) => setOnlineIpInput(e.target.value)}
                        placeholder="Ex: 189.1.168.20:27015 ou 189.1.168.20:27015; password mix"
                        className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-xs text-white font-mono placeholder-slate-600 focus:border-emerald-400 focus:outline-none shadow-inner"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Key size={13} className="text-amber-400" /> Senha RCON (Administração Remota):
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">rcon_password</span>
                      </label>
                      <input
                        type="password"
                        value={rconPassInput}
                        onChange={(e) => setRconPassInput(e.target.value)}
                        placeholder="Senha RCON do servidor (deixe vazio se não tiver)"
                        className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-xs text-white font-mono placeholder-slate-600 focus:border-amber-400 focus:outline-none shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={handleApplyToRoom}
                      disabled={!parsedActive.isValid}
                      className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-40 flex items-center gap-2 active:scale-95"
                    >
                      <CheckCircle2 size={16} />
                      <span>Definir como Servidor Oficial da Sala</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTestPing}
                      disabled={pingTesting || !parsedActive.isValid}
                      className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <RefreshCw size={14} className={pingTesting ? 'animate-spin text-emerald-400' : ''} />
                      <span>{pingTesting ? 'Testando Ping...' : 'Testar Ping do Servidor'}</span>
                    </button>
                  </div>

                  {/* Ping Result Feedback */}
                  {pingResult && (
                    <div className={`p-3.5 rounded-2xl border text-xs font-mono flex items-center justify-between animate-fadeIn ${
                      pingResult.online
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${pingResult.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                        <span>{pingResult.online ? '✓ SERVIDOR ONLINE E RESPONDENDO' : '✕ SERVIDOR INACESSÍVEL OU OFF-LINE'}</span>
                      </div>
                      {pingResult.online ? (
                        <div className="flex items-center gap-3">
                          <span className="font-bold">Ping: {pingResult.pingMs}ms</span>
                          <span className="text-[10px] text-slate-400">({pingResult.protocol})</span>
                        </div>
                      ) : (
                        <span className="text-[11px]">{pingResult.error}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Remote RCON Management Panel */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Sliders size={16} className="text-amber-400" />
                      Painel de Controle Remoto RCON (1-Clique)
                    </h4>
                    {rconStatusMsg && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border ${
                        rconStatusMsg.type === 'success'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                          : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                      }`}>
                        {rconStatusMsg.text}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400">
                    Controle o jogo sem precisar abrir o console do CS2. Comandos automatizados para o capitão ou admin da sala:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      disabled={rconTesting || !rconPassInput || !parsedActive.isValid}
                      onClick={() => handleExecRcon('mp_warmup_end 1', 'Iniciar Partida')}
                      className="p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex flex-col items-center gap-1 shadow-sm"
                    >
                      <PlayCircle size={18} />
                      <span>▶ Iniciar Partida</span>
                      <span className="text-[9px] font-mono text-emerald-400/80">mp_warmup_end 1</span>
                    </button>

                    <button
                      type="button"
                      disabled={rconTesting || !rconPassInput || !parsedActive.isValid}
                      onClick={() => handleExecRcon('mp_restartgame 1', 'Reiniciar Round')}
                      className="p-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex flex-col items-center gap-1 shadow-sm"
                    >
                      <RefreshCw size={18} />
                      <span>↺ Reiniciar Round</span>
                      <span className="text-[9px] font-mono text-amber-400/80">mp_restartgame 1</span>
                    </button>

                    <button
                      type="button"
                      disabled={rconTesting || !rconPassInput || !parsedActive.isValid}
                      onClick={() => handleExecRcon(`changelevel ${cleanMap}`, `Trocar para ${cleanMap}`)}
                      className="p-3 rounded-2xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex flex-col items-center gap-1 shadow-sm"
                    >
                      <Globe size={18} />
                      <span>🗺️ Trocar Mapa</span>
                      <span className="text-[9px] font-mono text-sky-400/80">changelevel {cleanMap}</span>
                    </button>

                    <button
                      type="button"
                      disabled={rconTesting || !rconPassInput || !parsedActive.isValid}
                      onClick={() => handleExecRcon('bot_kick', 'Kickar Bots')}
                      className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 flex flex-col items-center gap-1"
                    >
                      <span>🤖 Kickar Bots</span>
                      <span className="text-[9px] font-mono text-slate-500">bot_kick</span>
                    </button>

                    <button
                      type="button"
                      disabled={rconTesting || !rconPassInput || !parsedActive.isValid}
                      onClick={() => handleExecRcon('mp_pause_match', 'Pausar Jogo')}
                      className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 flex flex-col items-center gap-1"
                    >
                      <span>⏸️ Pausar Jogo</span>
                      <span className="text-[9px] font-mono text-slate-500">mp_pause_match</span>
                    </button>

                    <button
                      type="button"
                      disabled={rconTesting || !rconPassInput || !parsedActive.isValid}
                      onClick={() => handleExecRcon('mp_unpause_match', 'Despausar')}
                      className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 flex flex-col items-center gap-1"
                    >
                      <span>▶️ Despausar</span>
                      <span className="text-[9px] font-mono text-slate-500">mp_unpause_match</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Connection Details & Providers Guide */}
              <div className="lg:col-span-5 space-y-5">
                {/* Connection Box */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Radio size={16} className="text-emerald-400 animate-pulse" />
                    Conexão Direta dos 10 Jogadores
                  </h4>

                  {parsedActive.isValid ? (
                    <div className="space-y-3">
                      <div className="p-3.5 bg-slate-950 rounded-2xl border border-emerald-500/30 space-y-1.5 font-mono">
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Comando de Conexão CS2:</span>
                        <div className="text-emerald-400 font-bold text-xs break-all select-all">
                          {parsedActive.connectCommand}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (soundEnabled) playClickSound();
                            copyText(parsedActive.connectCommand);
                            setCopiedConnect(true);
                            setTimeout(() => setCopiedConnect(false), 2000);
                          }}
                          className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
                        >
                          {copiedConnect ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          <span>{copiedConnect ? 'Copiado!' : 'Copiar Connect'}</span>
                        </button>

                        {parsedActive.steamUrl && (
                          <a
                            href={parsedActive.steamUrl}
                            className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-colors cursor-pointer"
                          >
                            <Play size={13} fill="currentColor" />
                            <span>Abrir no CS2</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-950/70 border border-dashed border-slate-800 rounded-2xl text-center space-y-2">
                      <Server size={32} className="mx-auto text-slate-600" />
                      <p className="text-xs text-slate-400">
                        Digite o IP e porta do servidor ao lado para gerar o comando connect e o link direto de 1-clique no CS2.
                      </p>
                    </div>
                  )}
                </div>

                {/* Where to Rent Servers in Brazil */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-3.5 shadow-xl">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-heading">
                    <Info size={14} className="text-sky-400" /> Onde alugar servidores com ping baixo no Brasil?
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                      <strong className="text-white block font-heading">FireGames / Dathost:</strong>
                      Servidores CS2 com painel web pronto, plugins de 5v5 automáticos, ping de 5ms a 25ms em São Paulo.
                    </li>
                    <li className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                      <strong className="text-white block font-heading">VPS Linux (Oracle / Hetzner / Hostinger):</strong>
                      Instalação via SteamCMD (`cs2-dedicated-server`). Máxima performance com controle total por SSH.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LAN PARTY (MESMA CASA) */}
        {activeTab === 'lan' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                  <Home size={18} /> Modo LAN Party • 0ms de Ping Real
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                  Sem Consumo de Internet
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Jogue com amigos que estão na <strong>mesma casa, república, apartamento ou LAN house</strong> conectados no mesmo roteador (via Wi-Fi ou cabo Ethernet). Não requer abrir portas, não sofre com oscilações de internet e tem latência zero!
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Network IP Selector & Auto Script */}
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                  <h3 className="text-base font-bold font-heading text-white flex items-center gap-2">
                    <Wifi size={18} className="text-emerald-400" />
                    Seu IP de Rede Local (Detectado Automaticamente)
                  </h3>

                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5">
                    <span className="text-xs text-slate-400 font-semibold block">Placas de rede encontradas no seu PC:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {detectedLanIps.map((net) => (
                        <button
                          key={net.address}
                          type="button"
                          onClick={() => {
                            if (soundEnabled) playClickSound();
                            setLanIp(net.address);
                          }}
                          className={`text-xs font-mono font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                            lanIp === net.address
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-md shadow-emerald-500/10'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {net.address} <span className="opacity-60 text-[10px]">({net.name})</span>
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 font-mono block mb-1">IP do Host:</label>
                        <input
                          type="text"
                          value={lanIp}
                          onChange={(e) => setLanIp(e.target.value)}
                          placeholder="Ex: 192.168.1.100"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div className="w-28">
                        <label className="text-[10px] text-slate-500 font-mono block mb-1">Porta CS2:</label>
                        <input
                          type="text"
                          value={port}
                          onChange={(e) => setPort(e.target.value)}
                          placeholder="27015"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono text-center"
                        />
                      </div>
                    </div>
                  </div>

                  {/* AUTOMATION 1: One-Click Batch Script Generator */}
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap size={14} /> Automação com 1-Clique: Script de Inicialização (.bat)
                      </h4>
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">Recomendado</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Baixe o script pronto para Windows. Basta dar <strong>dois cliques</strong> nele para abrir o CS2 automaticamente no mapa <code className="text-amber-300 font-mono">{cleanMap}</code> com modo LAN, bots kickados e regras competitivas ativas!
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownloadBat('lan')}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Download size={15} />
                      <span>Baixar INICIAR-CS2-LAN.bat (Pronto para Executar)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Connection Box & Console Commands */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Radio size={16} className="text-emerald-400 animate-pulse" />
                    Comando Connect para os Amigos
                  </h4>

                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-emerald-500/30 space-y-1.5 font-mono">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Mande no WhatsApp / Discord:</span>
                    <div className="text-emerald-400 font-bold text-xs select-all">
                      connect {lanIp}:{port}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (soundEnabled) playClickSound();
                        copyText(`connect ${lanIp}:${port}`);
                        setCopiedConnect(true);
                        setTimeout(() => setCopiedConnect(false), 2000);
                      }}
                      className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
                    >
                      {copiedConnect ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedConnect ? 'Comando Copiado!' : `Copiar connect ${lanIp}:${port}`}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleApplyToRoom}
                      className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                    >
                      <CheckCircle2 size={16} />
                      <span>Definir LAN como Servidor da Sala</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Terminal size={14} className="text-sky-400" /> Caso prefira colar manualmente no Console:
                  </h4>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 break-all select-all">
                    {hostConsoleCmd}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      copyText(hostConsoleCmd);
                      setCopiedHostCmd(true);
                      setTimeout(() => setCopiedHostCmd(false), 2000);
                    }}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedHostCmd ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedHostCmd ? 'Comando do Host Copiado!' : 'Copiar Comando do Host'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RADMIN VPN */}
        {activeTab === 'radmin' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Network size={18} /> Radmin VPN • Jogue pela Internet sem Abrir Portas no Roteador
                </span>
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                  100% Gratuito
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                O método mais prático para jogar com amigos que moram em outras casas ou cidades sem precisar mexer nas configurações do modem. O Radmin cria uma rede virtual segura onde todos os computadores se enxergam como se estivessem na mesma casa.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                  <h3 className="text-base font-bold font-heading text-white flex items-center gap-2">
                    <Sparkles size={18} className="text-amber-400" /> Passo a Passo Ilustrado (3 Minutos)
                  </h3>

                  <ol className="list-decimal list-inside space-y-3 text-xs text-slate-300 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <li className="leading-relaxed">
                      Baixe e instale o <strong>Radmin VPN</strong> no seu computador e peça para os 9 amigos baixarem também (grátis em <span className="text-amber-400 font-mono">radmin-vpn.com</span>).
                    </li>
                    <li className="leading-relaxed">
                      No Radmin, clique no botão <strong>Rede &gt; Criar Nova Rede</strong>. Digite um nome para a sala (ex: <code className="text-amber-300 font-mono">MIX-CS2-PRO</code>) e uma senha simples.
                    </li>
                    <li className="leading-relaxed">
                      Mande o nome e a senha da rede para seus amigos entrarem clicando em <strong>Rede &gt; Entrar em Rede Existente</strong>.
                    </li>
                    <li className="leading-relaxed">
                      Copie o seu <strong>IP do Radmin VPN</strong> (sempre começa com <strong className="text-amber-400 font-mono">26.x.x.x</strong>) e cole no campo abaixo:
                    </li>
                  </ol>

                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">Seu IP do Radmin VPN (Host):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={radminIp}
                        onChange={(e) => setRadminIp(e.target.value)}
                        placeholder="Ex: 26.142.88.19"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:border-amber-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        placeholder="27015"
                        className="w-28 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono text-center focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* AUTOMATION 2: One-Click Batch Script Generator for Radmin */}
                  <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap size={14} /> Automação: Script Pronto de Inicialização Radmin (.bat)
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300">
                      Baixe o inicializador automático. Ele inicia o CS2 diretamente vinculado à placa de rede do Radmin VPN com mapa e configurações 5v5 prontas!
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownloadBat('radmin')}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Download size={15} />
                      <span>Baixar INICIAR-CS2-RADMIN.bat</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Links & Room Apply */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Radio size={16} className="text-amber-400 animate-pulse" />
                    Comando Connect Radmin
                  </h4>

                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-amber-500/30 space-y-1.5 font-mono">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Mande para quem estiver na sua rede Radmin:</span>
                    <div className="text-amber-400 font-bold text-xs select-all">
                      connect {radminIp || '26.x.x.x'}:{port}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (soundEnabled) playClickSound();
                        copyText(`connect ${radminIp || '26.x.x.x'}:${port}`);
                        setCopiedConnect(true);
                        setTimeout(() => setCopiedConnect(false), 2000);
                      }}
                      className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
                    >
                      {copiedConnect ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedConnect ? 'Comando Copiado!' : 'Copiar connect Radmin'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleApplyToRoom}
                      disabled={!radminIp}
                      className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95"
                    >
                      <CheckCircle2 size={16} />
                      <span>Definir Radmin como Servidor da Sala</span>
                    </button>

                    <a
                      href="https://www.radmin-vpn.com/br/"
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-900 text-sky-400 font-semibold text-xs border border-slate-800 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Download Oficial do Radmin VPN</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: IP PUBLICO / PORTAS */}
        {activeTab === 'public' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-sky-500/10 border border-sky-500/30 rounded-3xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-2">
                  <Globe size={18} /> Conexão Direta pela Internet • Port Forwarding 27015 UDP
                </span>
                <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-500/20 px-2.5 py-0.5 rounded-full border border-sky-500/40">
                  Sem Programas Extras
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Permite que qualquer pessoa conecte diretamente no seu computador sem precisar do Radmin VPN. Exige que a porta <strong>27015 UDP</strong> esteja aberta e redirecionada para o seu PC nas configurações do seu roteador/modem.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                  <h3 className="text-base font-bold font-heading text-white flex items-center gap-2">
                    <ShieldCheck size={18} className="text-sky-400" /> Seu IP Público de Internet
                  </h3>

                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">IP Público detectado pelo Hub:</span>
                      <span className="text-[10px] text-sky-400 font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                        {detectingIp ? 'Detectando...' : 'Auto-detectado'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={publicIp}
                        onChange={(e) => setPublicIp(e.target.value)}
                        placeholder="Ex: 187.54.120.33"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:border-sky-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        placeholder="27015"
                        className="w-28 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono text-center focus:border-sky-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* AUTOMATION 3: Real-Time Port Reachability Tester */}
                  <div className="p-4 bg-sky-950/30 border border-sky-500/30 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Verificador Automático de Porta 27015
                      </h4>
                      <span className="text-[9px] font-mono text-sky-400 bg-sky-500/20 px-2 py-0.5 rounded">Diagnóstico ao Vivo</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Não tem certeza se a sua porta está aberta no modem? Clique no botão abaixo para o nosso servidor testar a comunicação direta com o seu PC agora mesmo!
                    </p>
                    <button
                      type="button"
                      onClick={handleCheckPort}
                      disabled={checkingPort}
                      className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={checkingPort ? 'animate-spin' : ''} />
                      <span>{checkingPort ? 'Testando Porta 27015 no seu Modem...' : 'Verificar se a Porta 27015 está Aberta'}</span>
                    </button>

                    {portCheckResult && (
                      <div className={`p-3 rounded-xl border text-xs font-mono space-y-1 animate-fadeIn ${
                        portCheckResult.reachable
                          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                          : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                      }`}>
                        <div className="font-bold flex items-center gap-1.5">
                          <span>{portCheckResult.reachable ? '✓ PORTA 27015 ABERTA COM SUCESSO!' : '⚠️ PORTA 27015 FECHADA OU NÃO RESPONDENDO'}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                          {portCheckResult.reachable
                            ? 'Seu modem está configurado perfeitamente! Amigos podem se conectar diretamente pelo seu IP.'
                            : 'Seus amigos não conseguirão conectar diretamente ainda. Abra a porta 27015 UDP no roteador ou use o Radmin VPN / LAN (opções 2 e 3).'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-5">
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Radio size={16} className="text-sky-400 animate-pulse" />
                    Comando Connect IP Público
                  </h4>

                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-sky-500/30 space-y-1.5 font-mono">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Comando para os Amigos:</span>
                    <div className="text-sky-400 font-bold text-xs select-all">
                      connect {publicIp}:{port}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (soundEnabled) playClickSound();
                        copyText(`connect ${publicIp}:${port}`);
                        setCopiedConnect(true);
                        setTimeout(() => setCopiedConnect(false), 2000);
                      }}
                      className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
                    >
                      {copiedConnect ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedConnect ? 'Copiado!' : `Copiar connect ${publicIp}:${port}`}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleApplyToRoom}
                      disabled={!publicIp}
                      className="w-full py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-sky-500/25 cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95"
                    >
                      <CheckCircle2 size={16} />
                      <span>Definir IP Público como Servidor da Sala</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CFG & CONSOLE DO CS2 */}
        {activeTab === 'cfg' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-3xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                  <Terminal size={18} /> Central de CFG Competitiva Oficial & Comandos de Console
                </span>
                <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/40">
                  Valve 5v5 Competitive
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Baixe o arquivo de configuração oficial das partidas profissionais da Valve ou copie os comandos para executar no console de desenvolvedor do Counter-Strike 2.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold font-heading text-white flex items-center gap-2">
                      <FileCode size={18} className="text-indigo-400" />
                      Conteúdo de gamemode_competitive_mix.cfg
                    </h3>
                    <button
                      type="button"
                      onClick={handleDownloadCfg}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Baixar .cfg</span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-400">
                    Salve este arquivo na pasta de instalação do seu CS2: <code className="text-amber-300 font-mono">Counter-Strike Global Offensive/game/csgo/cfg/</code>.
                  </p>

                  <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-72 leading-relaxed">
                    {mixCfgContent}
                  </pre>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-5">
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <HelpCircle size={16} className="text-amber-400" />
                    Como Ativar o Console no CS2
                  </h4>
                  <ol className="list-decimal list-inside space-y-2.5 text-xs text-slate-300">
                    <li>Abra o Counter-Strike 2.</li>
                    <li>Vá em <strong>Configurações (ícone de engrenagem) &gt; Jogo</strong>.</li>
                    <li>Em <strong>Ativar Console de Desenvolvedor</strong>, selecione <strong className="text-emerald-400">SIM</strong>.</li>
                    <li>Pressione a tecla <strong className="text-amber-400 font-mono font-bold">'</strong> (apóstrofo) ou <strong className="text-amber-400 font-mono font-bold">~</strong> (til) para abrir o console a qualquer momento!</li>
                  </ol>
                </div>

                {/* MatchZy / PugSharp Plugin Automation Box */}
                <div className="bg-slate-900/90 border border-teal-500/40 rounded-3xl p-6 space-y-3.5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Zap size={16} className="text-teal-400" />
                      Automação MatchZy / PugSharp
                    </h4>
                    <span className="text-[10px] font-mono text-teal-300 bg-teal-500/15 px-2 py-0.5 rounded-full border border-teal-500/30">
                      1-Click Match Load
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    O Mix Hub gera arquivos JSON oficiais para o plugin <strong className="text-teal-300">MatchZy</strong> ou <strong className="text-teal-300">PugSharp</strong>. Execute no console RCON do servidor dedicado:
                  </p>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                    <code className="text-xs font-mono text-teal-300 truncate">
                      matchzy_loadmatch_url "{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/matchzy/config/{roomId || 'MIX'}"
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        if (soundEnabled) playClickSound();
                        copyText(`matchzy_loadmatch_url "${window.location.origin}/api/matchzy/config/${roomId || 'MIX'}"`);
                      }}
                      className="p-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 cursor-pointer shrink-0"
                      title="Copiar comando"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-5 text-center text-xs text-slate-500">
        <p>CS2 Mix Hub • Central Oficial de Servidores Dedicados, LAN Party & Radmin VPN</p>
      </footer>
    </div>
  );
}
