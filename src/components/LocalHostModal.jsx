import React, { useState, useEffect } from 'react';
import { X, Laptop, Network, Globe, Copy, Check, Terminal, Download, Play, ShieldAlert, Sparkles, ArrowRight, ExternalLink, Wifi, Home } from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function LocalHostModal({
  isOpen,
  onClose,
  roomId = 'MIX-PRO',
  currentServerIp = '',
  finalMap = 'de_mirage',
  onUpdateServerIp,
  soundEnabled,
}) {
  const [tab, setTab] = useState('radmin'); // 'radmin' | 'lan' | 'public' | 'console'
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

  // Auto-detect Host Public IP and LAN interfaces
  useEffect(() => {
    if (!isOpen) return;

    if (currentServerIp) {
      const parts = currentServerIp.split(':');
      if (parts[0].startsWith('26.')) {
        setRadminIp(parts[0]);
        setTab('radmin');
      } else if (parts[0].startsWith('192.168.') || parts[0].startsWith('10.') || parts[0].startsWith('172.')) {
        setLanIp(parts[0]);
        setTab('lan');
      } else {
        setPublicIp(parts[0]);
      }
      if (parts[1]) setPort(parts[1]);
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
          setLanIp((prev) => prev === '192.168.1.100' ? data.ips[0].address : prev);
        }
      })
      .catch(() => {})
      .finally(() => setDetectingIp(false));
  }, [isOpen, currentServerIp]);

  if (!isOpen) return null;

  // Active map code (clean de_name)
  const mapCode = (finalMap || 'de_mirage').toLowerCase().replace(/[^a-z0-9_]/g, '');

  // Command the HOST must run in their CS2 console
  const isLanMode = tab === 'lan';
  const hostConsoleCommand = `sv_lan ${isLanMode ? '1' : '0'}; bot_kick; mp_warmup_end 1; exec gamemode_competitive; mp_restartgame 1; map ${mapCode}`;

  // Active IP to apply
  let activeIp = '';
  if (tab === 'radmin') activeIp = radminIp.trim();
  else if (tab === 'lan') activeIp = lanIp.trim();
  else if (tab === 'public') activeIp = publicIp.trim();
  else activeIp = (radminIp || lanIp || publicIp).trim();

  const fullServerAddress = activeIp ? `${activeIp}:${port.trim() || '27015'}` : '';

  // Competitive CFG content for CS2 Mix
  const mixCfgContent = `// CS2 Mix Hub - Configuração Competitiva 5v5 para Servidor Local
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

  const handleApplyAsServer = () => {
    if (!activeIp) return;
    if (soundEnabled) playClickSound();

    if (onUpdateServerIp) {
      onUpdateServerIp(fullServerAddress);
    }

    setAppliedSuccess(true);
    setTimeout(() => {
      setAppliedSuccess(false);
      onClose();
    }, 1500);
  };

  const handleCopyHostCommand = () => {
    if (soundEnabled) playClickSound();
    navigator.clipboard.writeText(hostConsoleCommand);
    setCopiedHostCmd(true);
    setTimeout(() => setCopiedHostCmd(false), 2000);
  };

  const handleCopyConnectCommand = () => {
    if (!fullServerAddress) return;
    if (soundEnabled) playClickSound();
    navigator.clipboard.writeText(`connect ${fullServerAddress}`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#0a0f1d] border-2 border-amber-500/50 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 custom-scrollbar">
        
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
            <Laptop size={24} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-1">
              100% Grátis • Sem Pagar Servidor Dedicado
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-heading text-white">
              Assistente de Host Local (Criar no seu PC)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Rode a partida no seu CS2 e chame os amigos para conectar no seu computador!
            </p>
          </div>
        </div>

        {/* Method Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setTab('radmin')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'radmin'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Network size={14} />
            <span>1. Radmin VPN</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('lan')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
            onClick={() => setTab('public')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'public'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Globe size={14} />
            <span>3. IP Público</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('console')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'console'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Terminal size={14} />
            <span>4. Comandos CS2</span>
          </button>
        </div>

        {/* TAB 1: RADMIN VPN */}
        {tab === 'radmin' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} /> O método mais simples para jogar pela Internet
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
                Clique em <strong>Rede → Criar nova rede</strong> (ex: <span className="font-mono text-white">Mix Alex CS2</span> com uma senha simples).
              </li>
              <li>
                Peça para seus amigos abrirem o Radmin e clicarem em <strong>Entrar em rede existente</strong>.
              </li>
              <li>
                Copie o seu <strong>IP do Radmin</strong> (fica bem grande no topo do programa, começa com <span className="font-mono text-amber-300">26.x.x.x</span>) e cole abaixo:
              </li>
            </ol>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Seu IP do Radmin VPN
                </label>
                <input
                  type="text"
                  value={radminIp}
                  onChange={(e) => setRadminIp(e.target.value)}
                  placeholder="Ex: 26.150.32.11"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Porta CS2
                </label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="27015"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LAN NA MESMA CASA (NOVO!) */}
        {tab === 'lan' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Wifi size={14} /> LAN Party / Corujão Presencial (Ping 0ms - 1ms!)
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                  ZERO LAG
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Se todos os amigos estão na <strong>mesma casa</strong> (conectados no mesmo Wi-Fi ou cabos de rede no mesmo roteador), você <strong>não precisa de Radmin nem de internet externa</strong>! É a experiência mais rápida e sem delay possível.
              </p>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
              <li>
                Todos os computadores devem estar conectados na <strong>mesma rede Wi-Fi ou cabo</strong> do seu roteador.
              </li>
              <li>
                No computador do Host, descubra o seu <strong>IP Local (IPv4)</strong>:
                <div className="mt-1.5 p-2 rounded-lg bg-black/60 border border-slate-800 text-[11px] font-mono text-emerald-400 flex items-center justify-between">
                  <span>Abra o CMD e digite: <strong>ipconfig</strong> (veja o "Endereço IPv4")</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      navigator.clipboard.writeText('ipconfig');
                      setCopiedIpconfigCmd(true);
                      setTimeout(() => setCopiedIpconfigCmd(false), 2000);
                    }}
                    className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 cursor-pointer"
                  >
                    {copiedIpconfigCmd ? 'Copiado!' : 'Copiar comando'}
                  </button>
                </div>
              </li>
              <li>
                Insira o seu <strong>IP Local</strong> abaixo (geralmente começa com <span className="text-emerald-400 font-mono">192.168.x.x</span> ou <span className="text-emerald-400 font-mono">10.0.x.x</span>):
              </li>
            </ol>

            {detectedLanIps.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400">IPs Locais Detectados:</span>
                {detectedLanIps.map((net) => (
                  <button
                    key={net.address}
                    type="button"
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      setLanIp(net.address);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs hover:bg-emerald-500/25 cursor-pointer"
                    title={`Usar IP da interface ${net.name}`}
                  >
                    {net.address} ({net.name})
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Seu IP Local na Rede (IPv4)
                </label>
                <input
                  type="text"
                  value={lanIp}
                  onChange={(e) => setLanIp(e.target.value)}
                  placeholder="Ex: 192.168.1.100 ou 192.168.0.15"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Porta LAN
                </label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="27015"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-400 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PUBLIC IP & PORT FORWARDING */}
        {tab === 'public' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-sky-500/10 border border-sky-500/25 rounded-2xl p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                <Globe size={14} /> Conexão Direta pela Internet (Sem nenhum programa extra)
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Seus amigos conectam diretamente no seu IP público. É necessário ter a porta <strong>27015 UDP</strong> aberta no seu modem/roteador apontada para o IP local do seu computador.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Seu IP Público de Internet
                  </label>
                  {detectingIp && (
                    <span className="text-[10px] text-sky-400 font-mono animate-pulse">Detectando IP...</span>
                  )}
                </div>
                <input
                  type="text"
                  value={publicIp}
                  onChange={(e) => setPublicIp(e.target.value)}
                  placeholder="Ex: 177.136.24.12"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-sky-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Porta Aberta
                </label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="27015"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-sky-400 font-mono"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              💡 <strong>Dica de Roteador:</strong> No seu roteador, vá em <em>Port Forwarding / Redirecionamento de Portas</em> e crie uma regra com Protocolo <strong>UDP</strong>, Porta <strong>27015</strong>, apontando para o IP do seu PC.
            </div>
          </div>
        )}

        {/* TAB 4: CONSOLE COMMANDS FOR HOST */}
        {tab === 'console' && (
          <div className="space-y-4 animate-fadeIn">
            <p className="text-xs text-slate-300">
              Como você é o <strong>Host</strong>, você precisa iniciar o mapa pelo console do seu CS2. Copie o comando abaixo e cole no console do seu jogo:
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">
                  Comando de Inicialização do CS2 (Para o Host)
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Modo: <strong>{isLanMode ? 'LAN (sv_lan 1)' : 'Internet (sv_lan 0)'}</strong> • Mapa: <strong>{mapCode}</strong>
                </span>
              </div>
              <pre className="p-3 bg-black/60 rounded-xl text-xs font-mono text-amber-300 overflow-x-auto whitespace-pre-wrap select-all border border-slate-800/60">
                {hostConsoleCommand}
              </pre>
              <button
                type="button"
                onClick={handleCopyHostCommand}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
              >
                {copiedHostCmd ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedHostCmd ? 'Copiado para a Área de Transferência!' : 'Copiar Comando do Host'}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadCfg}
                className="w-full sm:flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download size={13} />
                <span>Baixar Config de Mix (mix.cfg)</span>
              </button>
            </div>
          </div>
        )}

        {/* BOTTOM ACTION BAR: DEFINE AS ROOM SERVER */}
        <div className="pt-3 border-t border-slate-800/80 space-y-3">
          {fullServerAddress ? (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Comando para os Amigos Conectarem {isLanMode ? '(Na mesma casa)' : '(Pela Internet)'}
                </span>
                <code className="text-xs font-mono font-bold text-emerald-400">
                  connect {fullServerAddress}
                </code>
              </div>
              <button
                type="button"
                onClick={handleCopyConnectCommand}
                className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                {copiedConnectCmd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedConnectCmd ? 'Copiado' : 'Copiar Connect'}</span>
              </button>
            </div>
          ) : (
            <p className="text-xs text-amber-400/90 italic">
              Insira o IP do seu {tab === 'lan' ? 'computador local' : tab === 'radmin' ? 'Radmin' : 'roteador'} acima para gerar o botão de conexão da sala.
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              disabled={!activeIp}
              onClick={handleApplyAsServer}
              className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black font-heading uppercase tracking-wider text-xs shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
            >
              {appliedSuccess ? (
                <>
                  <Check size={16} className="text-slate-950" />
                  <span>Servidor Definido na Sala com Sucesso!</span>
                </>
              ) : (
                <>
                  <Laptop size={16} />
                  <span>Definir Meu PC como Servidor da Sala</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
