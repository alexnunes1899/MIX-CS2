import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Laptop,
  Network,
  Globe,
  Copy,
  Check,
  Terminal,
  Download,
  Play,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Wifi,
  Home,
  Key,
  RefreshCw,
  Zap,
  Radio,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { playClickSound } from '../utils/audio';
import { parseServerDetails } from '../utils/serverParser';

export default function LocalHostModal({
  isOpen,
  onClose,
  roomId = 'MIX-PRO',
  currentServerIp = '',
  finalMap = 'de_mirage',
  onUpdateServerIp,
  rconPassword = '',
  onUpdateRconPassword,
  soundEnabled,
  initialTab = null,
}) {
  const [tab, setTab] = useState('online'); // 'online' | 'lan' | 'radmin' | 'public' | 'console'

  // Online Dedicated Server state
  const [onlineIpInput, setOnlineIpInput] = useState(currentServerIp || '');
  const [rconPassInput, setRconPassInput] = useState(rconPassword || '');
  const [rconTesting, setRconTesting] = useState(false);
  const [rconStatusMsg, setRconStatusMsg] = useState(null);
  const [copiedOnlineConnect, setCopiedOnlineConnect] = useState(false);

  // Local Host states
  const [radminIp, setRadminIp] = useState('');
  const [lanIp, setLanIp] = useState('192.168.1.100');
  const [publicIp, setPublicIp] = useState('');
  const [detectedLanIps, setDetectedLanIps] = useState([]);
  const [detectingIp, setDetectingIp] = useState(false);
  const [port, setPort] = useState('27015');
  const [copiedHostCmd, setCopiedHostCmd] = useState(false);
  const [copiedConnectCmd, setCopiedConnectCmd] = useState(false);
  const [copiedIpconfigCmd, setCopiedIpconfigCmd] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Parse current online server
  const parsedOnline = parseServerDetails(onlineIpInput || currentServerIp);

  // Auto-detect Host Public IP and LAN interfaces & decide default tab
  useEffect(() => {
    if (!isOpen) return;

    if (currentServerIp) {
      setOnlineIpInput(currentServerIp);
      const parts = currentServerIp.split(':');
      if (parts[0].startsWith('26.')) {
        setRadminIp(parts[0]);
        if (!initialTab) setTab('radmin');
      } else if (parts[0].startsWith('192.168.') || parts[0].startsWith('10.') || parts[0].startsWith('172.')) {
        setLanIp(parts[0]);
        if (!initialTab) setTab('lan');
      } else {
        setPublicIp(parts[0]);
        if (!initialTab) setTab('online');
      }
      if (parts[1]) setPort(parts[1]);
    } else if (initialTab) {
      setTab(initialTab);
    }

    if (rconPassword) {
      setRconPassInput(rconPassword);
    }

    setDetectingIp(true);
    // Public IP
    fetch('/api/my-ip')
      .then((res) => res.json())
      .then((data) => {
        if (data?.ip) setPublicIp((prev) => prev || data.ip);
      })
      .catch(() => {});

    // LAN IP
    fetch('/api/lan-ip')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.ips) && data.ips.length > 0) {
          setDetectedLanIps(data.ips);
          setLanIp((prev) => (prev === '192.168.1.100' ? data.ips[0].address : prev));
        }
      })
      .catch(() => {})
      .finally(() => setDetectingIp(false));
  }, [isOpen, currentServerIp, rconPassword, initialTab]);

  if (!isOpen) return null;

  // Active map code (clean de_name)
  const mapCode = (finalMap || 'de_mirage').toLowerCase().replace(/[^a-z0-9_]/g, '');

  // Command the HOST must run in their CS2 console
  const isLanMode = tab === 'lan';
  const hostConsoleCommand = `sv_lan ${isLanMode ? '1' : '0'}; bot_kick; mp_warmup_end 1; exec gamemode_competitive; mp_restartgame 1; map ${mapCode}`;

  // Active IP to apply for local host
  let activeIp = '';
  if (tab === 'radmin') activeIp = radminIp.trim();
  else if (tab === 'lan') activeIp = lanIp.trim();
  else if (tab === 'public') activeIp = publicIp.trim();
  else activeIp = (radminIp || lanIp || publicIp).trim();

  const fullLocalAddress = activeIp ? `${activeIp}:${port.trim() || '27015'}` : '';

  // Competitive CFG content for CS2 Mix
  const mixCfgContent = `// CS2 Mix Hub - Configuracao Competitiva 5v5 para Servidor Local
sv_lan ${isLanMode ? '1' : '0'}
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
echo "CS2 Mix Hub Config Carregada com Sucesso!"
`;

  // Apply online server IP
  const handleApplyOnlineServer = (e) => {
    if (e) e.preventDefault();
    if (soundEnabled) playClickSound();
    const clean = onlineIpInput.trim();
    if (onUpdateServerIp) onUpdateServerIp(clean);
    if (onUpdateRconPassword && rconPassInput) onUpdateRconPassword(rconPassInput.trim());
    setAppliedSuccess(true);
    setTimeout(() => {
      setAppliedSuccess(false);
      onClose();
    }, 1500);
  };

  // Apply local server IP
  const handleApplyLocalServer = () => {
    if (!activeIp) return;
    if (soundEnabled) playClickSound();
    if (onUpdateServerIp) {
      onUpdateServerIp(fullLocalAddress);
    }
    setAppliedSuccess(true);
    setTimeout(() => {
      setAppliedSuccess(false);
      onClose();
    }, 1500);
  };

  // Test RCON
  const handleTestRcon = async () => {
    if (!parsedOnline.isValid || !rconPassInput) {
      setRconStatusMsg({ text: 'Informe o IP do servidor e a senha RCON.', type: 'error' });
      return;
    }
    setRconTesting(true);
    setRconStatusMsg(null);
    try {
      const res = await fetch('/api/rcon/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: parsedOnline.ip.split(':')[0],
          port: parsedOnline.port || 27015,
          password: rconPassInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRconStatusMsg({ text: '✓ Conectado ao RCON do servidor com sucesso!', type: 'success' });
        if (onUpdateRconPassword) onUpdateRconPassword(rconPassInput.trim());
      } else {
        setRconStatusMsg({ text: data.error || 'Falha na autenticação RCON.', type: 'error' });
      }
    } catch (e) {
      setRconStatusMsg({ text: 'Erro ao comunicar com o servidor RCON.', type: 'error' });
    } finally {
      setRconTesting(false);
    }
  };

  // Exec RCON
  const handleExecRcon = async (cmd, label) => {
    if (!parsedOnline.isValid || !rconPassInput) {
      setRconStatusMsg({ text: 'Configure a senha RCON primeiro.', type: 'error' });
      return;
    }
    setRconTesting(true);
    try {
      const res = await fetch('/api/rcon/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: parsedOnline.ip.split(':')[0],
          port: parsedOnline.port || 27015,
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
      setRconStatusMsg({ text: 'Erro ao enviar comando RCON.', type: 'error' });
    } finally {
      setRconTesting(false);
    }
  };

  const handleCopyHostCommand = () => {
    if (soundEnabled) playClickSound();
    navigator.clipboard.writeText(hostConsoleCommand);
    setCopiedHostCmd(true);
    setTimeout(() => setCopiedHostCmd(false), 2000);
  };

  const handleCopyConnectCommand = () => {
    if (!fullLocalAddress) return;
    if (soundEnabled) playClickSound();
    navigator.clipboard.writeText(`connect ${fullLocalAddress}`);
    setCopiedConnectCmd(true);
    setTimeout(() => setCopiedConnectCmd(false), 2000);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-[#090d16] border border-slate-700/80 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 my-8">
        
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
            <Server size={24} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1">
              Central Oficial de Servidores CS2
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-heading text-white">
              Servidores: Dedicado Online ou Host no seu PC
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Escolha como seus amigos vão jogar: Servidor Online na Nuvem (FireGames / Dathost) ou Servidor Local no seu computador (LAN na mesma casa ou Radmin VPN sem abrir portas).
            </p>
          </div>
        </div>

        {/* Method Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setTab('online')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer col-span-2 sm:col-span-1 ${
              tab === 'online'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Server size={14} />
            <span>1. Online Dedicado</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('lan')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'lan'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Home size={14} />
            <span>2. LAN (Mesma Casa)</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('radmin')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'radmin'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Network size={14} />
            <span>3. Radmin VPN</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('public')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'public'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Globe size={14} />
            <span>4. IP Público</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('console')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'console'
                ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Terminal size={14} />
            <span>5. Console & CFG</span>
          </button>
        </div>

        {/* TAB 1: SERVIDOR ONLINE DEDICADO */}
        {tab === 'online' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} /> Servidor Dedicado na Nuvem (FireGames, Dathost, VPS, Comunidade)
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Ideal para jogar partidas competitivas oficiais com ping baixo em servidores dedicados brasileiros. Cole o IP do seu servidor abaixo e os 10 jogadores se conectam com 1 clique!
              </p>
            </div>

            {/* IP Input Form */}
            <form onSubmit={handleApplyOnlineServer} className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-inner">
              <label className="block text-xs font-bold text-slate-300">
                Endereço IP & Porta do Servidor Dedicado:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={onlineIpInput}
                  onChange={(e) => setOnlineIpInput(e.target.value)}
                  placeholder="Ex: 189.1.168.10:27015 ou connect 189.1.168.10:27015; password mix"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:border-emerald-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer shrink-0"
                >
                  Salvar Servidor
                </button>
              </div>

              {/* RCON Configuration Row */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <Key size={13} className="text-amber-400" />
                    Senha RCON de Administração (Opcional):
                  </span>
                  {rconStatusMsg && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      rconStatusMsg.type === 'success'
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                        : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                    }`}>
                      {rconStatusMsg.text}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={rconPassInput}
                    onChange={(e) => setRconPassInput(e.target.value)}
                    placeholder="Senha rcon_password do servidor"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={rconTesting || !rconPassInput || !parsedOnline.isValid}
                    onClick={handleTestRcon}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {rconTesting ? 'Testando...' : 'Testar RCON'}
                  </button>
                </div>

                {/* RCON Quick Controls */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-500 font-mono">Comandos rápidos:</span>
                  <button
                    type="button"
                    disabled={rconTesting || !rconPassInput || !parsedOnline.isValid}
                    onClick={() => handleExecRcon('mp_warmup_end', 'Iniciar Jogo')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-40"
                  >
                    ▶ Iniciar Jogo (mp_warmup_end)
                  </button>
                  <button
                    type="button"
                    disabled={rconTesting || !rconPassInput || !parsedOnline.isValid}
                    onClick={() => handleExecRcon('mp_restartgame 1', 'Reiniciar Partida')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-40"
                  >
                    ↺ Reiniciar Round (mp_restartgame 1)
                  </button>
                  <button
                    type="button"
                    disabled={rconTesting || !rconPassInput || !parsedOnline.isValid}
                    onClick={() => handleExecRcon(`changelevel ${mapCode}`, `Trocar para ${mapCode}`)}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-40"
                  >
                    🗺️ Mudar para {mapCode}
                  </button>
                </div>
              </div>
            </form>

            {/* Quick Connect & Steam Launch Buttons */}
            {parsedOnline.isValid && (
              <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Servidor Pronto para Conectar:</span>
                    <strong className="text-emerald-400 font-mono text-sm">{parsedOnline.ip}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      navigator.clipboard.writeText(parsedOnline.connectCommand);
                      setCopiedOnlineConnect(true);
                      setTimeout(() => setCopiedOnlineConnect(false), 2000);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedOnlineConnect ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedOnlineConnect ? 'Copiado!' : 'Copiar Connect'}</span>
                  </button>
                  {parsedOnline.steamUrl && (
                    <a
                      href={parsedOnline.steamUrl}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                    >
                      <Play size={13} fill="currentColor" />
                      <span>Abrir no CS2</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LAN PARTY (MESMA CASA) */}
        {tab === 'lan' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <Home size={14} /> 0ms de Ping • Todos os Computadores no Mesmo Wi-Fi ou Cabo de Rede
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Perfeito para jogar com amigos na mesma casa, lan house ou república. Não precisa de internet rápida, não gasta dados e não exige abrir nenhuma porta!
              </p>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
              <li>
                Conecte todos os computadores na <strong>mesma rede Wi-Fi</strong> ou cabo no mesmo roteador.
              </li>
              <li>
                O Host (você) abre o CS2 e cola o comando do console abaixo para iniciar o mapa em modo LAN.
              </li>
              <li>
                Os amigos abrem o CS2 e colam o comando connect com o seu <strong>IP Local</strong> (detectado abaixo).
              </li>
            </ol>

            {/* Detected Local IPs */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Wifi size={14} className="text-emerald-400" />
                  Seu IP Local na Rede de Casa:
                </span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {detectingIp ? 'Detectando...' : `${detectedLanIps.length} placa(s) encontrada(s)`}
                </span>
              </div>

              {detectedLanIps.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 font-mono">IPs detectados no seu PC:</span>
                  {detectedLanIps.map((net) => (
                    <button
                      key={net.address}
                      type="button"
                      onClick={() => setLanIp(net.address)}
                      className={`text-xs font-mono font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                        lanIp === net.address
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {net.address} ({net.name})
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={lanIp}
                  onChange={(e) => setLanIp(e.target.value)}
                  placeholder="Ex: 192.168.1.100 ou 10.0.0.15"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:border-emerald-400 focus:outline-none"
                />
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="27015"
                  className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono text-center focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Action Bar for LAN */}
            <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleCopyConnectCommand}
                disabled={!fullLocalAddress}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedConnectCmd ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedConnectCmd ? 'Copiado!' : `Copiar connect ${fullLocalAddress}`}</span>
              </button>

              <button
                type="button"
                onClick={handleApplyLocalServer}
                disabled={!activeIp}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <CheckCircle2 size={15} />
                <span>Definir LAN como Servidor da Sala</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: RADMIN VPN */}
        {tab === 'radmin' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} /> O método mais simples para jogar pela Internet sem abrir portas
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Não precisa mexer no roteador ou abrir portas. Basta você e seus 9 amigos estarem na mesma sala do Radmin VPN.
              </p>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
              <li>
                Baixe e instale o <strong>Radmin VPN</strong> (grátis em <span className="text-amber-400 font-mono">radmin-vpn.com</span>).
              </li>
              <li>
                Clique em <strong>Rede &gt; Criar Nova Rede</strong> e defina um Nome e Senha para os seus amigos entrarem.
              </li>
              <li>
                Copie o seu <strong>IP do Radmin</strong> (começa com <span className="text-amber-400 font-mono font-bold">26.x.x.x</span>) e cole abaixo:
              </li>
            </ol>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <label className="block text-xs font-bold text-slate-300">
                Seu IP do Radmin VPN (Host):
              </label>
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
                  className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono text-center focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
              <a
                href="https://www.radmin-vpn.com/br/"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download size={13} />
                <span>Baixar Radmin VPN</span>
                <ExternalLink size={12} />
              </a>

              <button
                type="button"
                onClick={handleApplyLocalServer}
                disabled={!activeIp}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <CheckCircle2 size={15} />
                <span>Definir Radmin como Servidor da Sala</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: IP PUBLICO */}
        {tab === 'public' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-sky-500/10 border border-sky-500/25 rounded-2xl p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                <Globe size={14} /> Conexão Direta pela Internet (Port Forwarding 27015 UDP)
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Para quem tem portas liberadas no roteador. Não exige nenhum programa instalado para os seus amigos!
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Seu IP Público de Internet:</span>
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
                  className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono text-center focus:border-sky-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={handleApplyLocalServer}
                disabled={!activeIp}
                className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-sky-500/20 cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <CheckCircle2 size={15} />
                <span>Definir IP Público como Servidor da Sala</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: COMANDOS DO CONSOLE & CFG */}
        {tab === 'console' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Terminal size={14} className="text-sky-400" />
                Comando que o Host deve colar no Console do CS2:
              </h4>
              <p className="text-[11px] text-slate-400">
                Abra o console com a tecla <span className="text-amber-400 font-mono font-bold">~</span> ou <span className="text-amber-400 font-mono font-bold">'</span> no CS2 e cole o comando abaixo:
              </p>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-400 break-all select-all flex items-center justify-between gap-2">
                <code>{hostConsoleCommand}</code>
                <button
                  type="button"
                  onClick={handleCopyHostCommand}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shrink-0 cursor-pointer transition-colors"
                >
                  {copiedHostCmd ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* CFG Download */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h5 className="text-xs font-bold text-white">Arquivo CFG Competitiva 5v5 (Oficial Valve)</h5>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Baixe e salve na pasta <code className="text-amber-400 font-mono">game/csgo/cfg/</code> do seu CS2.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadCfg}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download size={13} />
                <span>Baixar gamemode_competitive_mix.cfg</span>
              </button>
            </div>
          </div>
        )}

        {/* Applied Success Toast */}
        {appliedSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 animate-fadeIn">
            <Check size={16} />
            <span>Servidor aplicado com sucesso! A barra de conexão foi atualizada para os 10 jogadores.</span>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span>Sala: <strong className="text-white font-mono">{roomId}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            Fechar Janela
          </button>
        </div>

      </div>
    </div>
  );
}
