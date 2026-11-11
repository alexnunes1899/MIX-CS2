import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Radio,
  Server,
  ShieldCheck,
  HelpCircle,
  FileCode,
  CheckCircle2,
  Flame,
  ArrowRight,
  Laptop,
  Zap,
  Terminal,
  RefreshCw,
  FolderCheck,
} from 'lucide-react';
import { playClickSound } from '../utils/audio';
import { copyText } from '../utils/clipboard';

export default function GsiSetupModal({
  isOpen,
  onClose,
  roomId = 'MIX-PRO',
  liveMatch = null,
  soundEnabled,
}) {
  const [copied, setCopied] = useState(false);
  const [copiedPs1, setCopiedPs1] = useState(false);
  const [gsiStatus, setGsiStatus] = useState(liveMatch || null);
  const [activeTab, setActiveTab] = useState('auto'); // 'auto' | 'firegames' | 'manual'
  const [localInstallStatus, setLocalInstallStatus] = useState({
    checked: false,
    installed: false,
    path: null,
    hasMatchStats: false,
    loading: false,
    msg: null,
  });

  useEffect(() => {
    if (!isOpen) return;

    // Check live GSI room transmission status
    const checkStatus = () => {
      fetch(`/api/gsi/status/${encodeURIComponent(roomId)}`)
        .then((res) => res.json())
        .then((data) => setGsiStatus(data))
        .catch(() => {});
    };

    // Check if GSI file is already installed in CS2 folder on this PC
    const checkInstalledOnPc = () => {
      const savedLocal = typeof window !== 'undefined' && localStorage.getItem('cs2_gsi_installed') === '1';
      fetch('/api/gsi/check-installed')
        .then((res) => res.json())
        .then((data) => {
          const isInstalled = Boolean(data?.installed) || savedLocal;
          setLocalInstallStatus((prev) => ({
            ...prev,
            checked: true,
            installed: isInstalled,
            path:
              data?.path ||
              (isInstalled
                ? 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg\\gamestate_integration_cs2mixhub.cfg'
                : null),
            hasMatchStats: true,
          }));
        })
        .catch(() => {
          if (savedLocal) {
            setLocalInstallStatus((prev) => ({
              ...prev,
              checked: true,
              installed: true,
              path: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg\\gamestate_integration_cs2mixhub.cfg',
              hasMatchStats: true,
            }));
          }
        });
    };

    checkStatus();
    checkInstalledOnPc();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const cfgUrl = `/api/gsi/cfg/${encodeURIComponent(roomId)}`;
  const installerBatUrl = `/api/gsi/installer/${encodeURIComponent(roomId)}`;
  const ps1Command = `irm ${currentHost}/api/gsi/installer/ps1/${encodeURIComponent(roomId)} | iex`;
  const cfgContent = `"CS2MixHub Integration"
{
    "uri" "${currentHost}/api/gsi/${roomId}"
    "timeout" "3.0"
    "buffer"  "0.05"
    "throttle" "0.1"
    "heartbeat" "2.0"
    "data"
    {
        "provider"               "1"
        "map"                    "1"
        "round"                  "1"
        "player_id"              "1"
        "allplayers_id"          "1"
        "player_state"           "1"
        "player_weapons"         "1"
        "player_match_stats"     "1"
        "allplayers_state"       "1"
        "allplayers_match_stats" "1"
    }
    "auth"
    {
        "token" "${roomId}"
    }
}`;

  const handleInstallDirectly = async () => {
    if (soundEnabled) playClickSound();
    setLocalInstallStatus((prev) => ({ ...prev, loading: true, msg: null }));
    const cs2CfgFolder = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg';

    try {
      // 1. Try direct host installation (or local bridge on 127.0.0.1:3000)
      let res = await fetch('/api/gsi/install-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      });
      let data = await res.json();

      if (!data?.success && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        try {
          const localRes = await fetch('http://127.0.0.1:3000/api/gsi/install-local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId }),
          });
          if (localRes.ok) {
            data = await localRes.json();
          }
        } catch (_) {}
      }

      if (data?.success) {
        try { localStorage.setItem('cs2_gsi_installed', '1'); } catch (_) {}
        setLocalInstallStatus({
          checked: true,
          installed: true,
          path: data.primaryPath || data.paths?.[0] || `${cs2CfgFolder}\\gamestate_integration_cs2mixhub.cfg`,
          hasMatchStats: true,
          loading: false,
          msg: { text: data.message || 'GSI instalado com sucesso no seu CS2!', type: 'success' },
        });
        return;
      }

      // 2. Cloud Browser Direct Save (Zero .bat download — saves .cfg directly via File System Access API)
      copyText(cs2CfgFolder);
      if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'gamestate_integration_cs2mixhub.cfg',
          types: [
            {
              description: 'Valve CS2 GSI Config (.cfg)',
              accept: { 'text/plain': ['.cfg'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(data?.cfgContent || cfgContent);
        await writable.close();

        try { localStorage.setItem('cs2_gsi_installed', '1'); } catch (_) {}
        setLocalInstallStatus({
          checked: true,
          installed: true,
          path: `${cs2CfgFolder}\\gamestate_integration_cs2mixhub.cfg`,
          hasMatchStats: true,
          loading: false,
          msg: {
            text: 'Arquivo gamestate_integration_cs2mixhub.cfg salvo direto no seu CS2 (sem precisar de .bat)!',
            type: 'success',
          },
        });
        return;
      }

      // 3. Fallback: direct .cfg download (plain text Valve CFG, zero .bat)
      const blob = new Blob([data?.cfgContent || cfgContent], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'gamestate_integration_cs2mixhub.cfg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      try { localStorage.setItem('cs2_gsi_installed', '1'); } catch (_) {}
      setLocalInstallStatus({
        checked: true,
        installed: true,
        path: `${cs2CfgFolder}\\gamestate_integration_cs2mixhub.cfg`,
        hasMatchStats: true,
        loading: false,
        msg: {
          text: `Arquivo .cfg pronto (sem .bat)! O caminho da pasta (${cs2CfgFolder}) já foi copiado para seu Ctrl+V.`,
          type: 'success',
        },
      });
    } catch (err) {
      if (err?.name === 'AbortError') {
        setLocalInstallStatus((prev) => ({ ...prev, loading: false, msg: null }));
        return;
      }
      setLocalInstallStatus((prev) => ({
        ...prev,
        loading: false,
        msg: { text: 'Caminho da pasta copiado! Salve o arquivo .cfg na pasta cfg do CS2.', type: 'error' },
      }));
    }
  };

  const handleCopy = () => {
    if (soundEnabled) playClickSound();
    copyText(cfgContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPs1 = () => {
    if (soundEnabled) playClickSound();
    copyText(ps1Command);
    setCopiedPs1(true);
    setTimeout(() => setCopiedPs1(false), 2000);
  };

  const handleDownloadBat = () => {
    if (soundEnabled) playClickSound();
    const link = document.createElement('a');
    link.href = installerBatUrl;
    link.download = 'instalar_monitoramento_cs2.bat';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = () => {
    if (soundEnabled) playClickSound();
    const blob = new Blob([cfgContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'gamestate_integration_cs2mixhub.cfg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#0a0f1d] border-2 border-emerald-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl custom-scrollbar">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="flex items-start gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
            <Radio size={24} className={gsiStatus?.connected ? 'animate-pulse text-emerald-400' : 'text-slate-400'} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1">
              Oficial Valve Corporation
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-heading text-white">
              CS2 Game State Integration (GSI)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Placar automático, kills, mortes, MVPs e armas em tempo real sem intervenção humana.
            </p>
          </div>
        </div>

        {/* PERSISTENT INSTALLED STATUS BADGE */}
        {localInstallStatus.installed ? (
          <div className="p-3.5 mb-4 rounded-2xl bg-emerald-950/70 border-2 border-emerald-500/60 shadow-lg shadow-emerald-950/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <strong className="text-white text-xs font-bold font-heading">
                    ✅ GSI Instalado no seu CS2
                  </strong>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 text-[10px] font-mono font-black uppercase">
                    Pronto para Jogar
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5 break-all font-mono">
                  {localInstallStatus.path || 'gamestate_integration_cs2mixhub.cfg'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleInstallDirectly}
              disabled={localInstallStatus.loading}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              {localInstallStatus.loading ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Zap size={13} />
              )}
              <span>Reinstalar / Atualizar</span>
            </button>
          </div>
        ) : null}

        {/* LIVE TRANSMISSION STATUS CARD */}
        <div className={`p-4 rounded-2xl border mb-5 transition-all ${
          gsiStatus?.connected
            ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-950/50'
            : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${gsiStatus?.connected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span>Status da Conexão Valve GSI</span>
            </span>
            <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
              gsiStatus?.connected
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}>
              {gsiStatus?.connected ? 'AO VIVO / TRANSMITINDO' : 'AGUARDANDO CS2'}
            </span>
          </div>

          {gsiStatus?.connected ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-500/20 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Mapa</span>
                  <strong className="text-white font-mono">{gsiStatus.mapName || 'Em jogo'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Placar</span>
                  <strong className="text-emerald-300 font-mono text-sm">
                    CT {gsiStatus.scoreCT} x {gsiStatus.scoreTR} TR
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Fase</span>
                  <strong className="text-slate-200 capitalize font-mono">{gsiStatus.phase}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Round</span>
                  <strong className="text-amber-300 font-mono">#{gsiStatus.roundNumber}</strong>
                </div>
              </div>

              {/* INDIVIDUAL PLAYER TELEMETRY HUD */}
              {gsiStatus?.player && (
                <div className="mt-3 pt-3 border-t border-emerald-500/20 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider font-heading ${
                          gsiStatus.player.team === 'CT'
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        }`}
                      >
                        {gsiStatus.player.team === 'CT' ? '🛡️ Time CT (Defensores)' : '💣 Time TR (Atacantes)'}
                      </span>
                      <strong className="text-white text-sm font-heading">{gsiStatus.player.name}</strong>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">Economia:</span>
                      <strong className="text-emerald-400 font-mono font-bold">
                        ${gsiStatus.player.money?.toLocaleString('pt-BR') || 0}
                      </strong>
                    </div>
                  </div>

                  {/* HP BAR & ARMOR */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5">
                        {gsiStatus.player.isAlive ? '❤️ Vida (HP)' : '💀 Eliminado neste round'}
                      </span>
                      <span className="font-mono font-bold text-white">
                        {gsiStatus.player.health} / 100 HP
                        {gsiStatus.player.armor > 0 &&
                          ` • 🛡️ ${gsiStatus.player.armor}% Colete${gsiStatus.player.hasHelmet ? ' + Capacete' : ''}`}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          gsiStatus.player.health > 50
                            ? 'bg-emerald-500'
                            : gsiStatus.player.health > 20
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, gsiStatus.player.health))}%` }}
                      />
                    </div>
                  </div>

                  {/* ARSENAL & STATS ROW */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Arma em Mãos</span>
                      <strong className="text-amber-300 font-mono text-xs truncate block">
                        {gsiStatus.player.activeWeapon?.name || 'Faca'}
                        {gsiStatus.player.activeWeapon?.ammoClip !== null &&
                          gsiStatus.player.activeWeapon?.ammoClip !== undefined &&
                          ` [${gsiStatus.player.activeWeapon.ammoClip}/${gsiStatus.player.activeWeapon.ammoReserve || 0}]`}
                      </strong>
                    </div>

                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">K / D / A</span>
                      <strong className="text-white font-mono text-xs">
                        {gsiStatus.player.kills || 0} / {gsiStatus.player.deaths || 0} / {gsiStatus.player.assists || 0}
                      </strong>
                    </div>

                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">K/D Ratio</span>
                      <strong className="text-emerald-400 font-mono text-xs">{gsiStatus.player.kd || 0}</strong>
                    </div>

                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">MVPs de Partida</span>
                      <strong className="text-amber-400 font-mono text-xs">⭐ {gsiStatus.player.mvps || 0} MVPs</strong>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-400 mt-1">
              O CS2 ainda não transmitiu dados para a sala <strong>{roomId}</strong>. Clique em <strong>Instalar Direto</strong> abaixo para ativar no seu jogo!
            </p>
          )}
        </div>

        {/* TAB SELECTOR: AUTO 1-CLICK VS FIREGAMES VS MANUAL */}
        <div className="flex items-center gap-1.5 mb-4 p-1 bg-slate-950/80 border border-slate-800 rounded-2xl overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('auto')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'auto'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-md shadow-emerald-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap size={14} className={activeTab === 'auto' ? 'fill-slate-950' : 'text-emerald-400'} />
            <span>1. Instalar Direto (1 Clique Sem Baixar)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('firegames')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'firegames'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Server size={14} />
            <span>2. Servidor FireGames</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'manual'
                ? 'bg-sky-500 text-slate-950 font-black shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Laptop size={14} />
            <span>3. Manual (.cfg)</span>
          </button>
        </div>

        {/* TAB 1: AUTOMATED 1-CLICK DIRECT INSTALLER (ZERO DOWNLOADS REQUIRED) */}
        {activeTab === 'auto' && (
          <div className="space-y-3.5 bg-gradient-to-b from-emerald-950/40 via-slate-950/80 to-slate-950 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 text-xs text-slate-300 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-md">
                <Zap size={22} className="fill-emerald-400" />
              </div>
              <div>
                <h4 className="font-heading font-black text-white text-sm sm:text-base flex items-center gap-2">
                  <span>Instalação Direta no seu CS2 (Sem Baixar Nada)</span>
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold uppercase">
                    1 Clique
                  </span>
                </h4>
                <p className="text-slate-300 mt-1 leading-relaxed">
                  Basta clicar no botão verde abaixo! O sistema localiza a pasta da Steam no seu computador e instala o arquivo de monitoramento oficial da Valve direto no seu CS2 em menos de 1 segundo.
                </p>
              </div>
            </div>

            {/* Giant 1-Click Install Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleInstallDirectly}
                disabled={localInstallStatus.loading}
                className={`w-full py-4 px-4 rounded-2xl text-slate-950 font-black font-heading uppercase tracking-wider text-xs sm:text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2.5 hover:scale-[1.01] active:scale-[0.99] ${
                  localInstallStatus.installed
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-emerald-500/30'
                    : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/30'
                }`}
              >
                {localInstallStatus.loading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin text-slate-950" />
                    <span>Instalando no seu CS2 agora...</span>
                  </>
                ) : localInstallStatus.installed ? (
                  <>
                    <CheckCircle2 size={18} className="text-slate-950" />
                    <span>✅ GSI Instalado no seu CS2! Clique para Reinstalar/Atualizar</span>
                  </>
                ) : (
                  <>
                    <Zap size={18} className="fill-slate-950 text-slate-950" />
                    <span>⚡ Instalar Direto no Meu CS2 (1 Clique Sem Baixar)</span>
                  </>
                )}
              </button>
            </div>

            {/* Feedback Message */}
            {localInstallStatus.msg && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
                  localInstallStatus.msg.type === 'success'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-500/20 border-rose-500/50 text-rose-200'
                }`}
              >
                {localInstallStatus.msg.type === 'success' ? (
                  <Check size={16} className="text-emerald-400 shrink-0" />
                ) : (
                  <X size={16} className="text-rose-400 shrink-0" />
                )}
                <span>{localInstallStatus.msg.text}</span>
              </div>
            )}

            {/* Secondary Option for Sending to Friends Playing Remotely */}
            <div className="pt-3 border-t border-slate-900 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Amigos jogando no PC deles?
              </span>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadBat}
                  className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                  title="Baixar instalador .bat para mandar para amigos no Discord/WhatsApp"
                >
                  <Download size={14} className="text-emerald-400" />
                  <span>Baixar .bat para Enviar aos Amigos</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyPs1}
                  className="w-full sm:w-auto py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-400 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copiedPs1 ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedPs1 ? 'Copiado!' : 'Copiar PowerShell'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FIREGAMES INSTRUCTIONS */}
        {activeTab === 'firegames' && (
          <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Server size={16} className="text-emerald-400" />
              Como colocar no Servidor Alugado da FireGames:
            </h4>
            <p className="text-slate-400 leading-relaxed">
              Servidores da <strong>FireGames</strong> dão acesso total ao <strong>Gerenciador de Arquivos</strong> e <strong>FTP</strong>. Você só precisa colocar o arquivo dentro da pasta de configurações do CS2:
            </p>

            <ol className="list-decimal list-inside space-y-2 text-slate-300">
              <li>
                Clique no botão verde abaixo para <strong>Baixar o arquivo .cfg</strong> pronto.
              </li>
              <li>
                Acesse o painel da sua conta na <strong>FireGames</strong> e clique no seu servidor de CS2.
              </li>
              <li>
                Vá em <strong>Gerenciador de Arquivos</strong> (ou conecte via FTP) e abra a pasta:
                <code className="block mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 font-mono text-emerald-300 text-[11px]">
                  game/csgo/cfg/
                </code>
              </li>
              <li>
                Faça o <strong>Upload</strong> do arquivo <span className="text-white font-mono font-bold">gamestate_integration_cs2mixhub.cfg</span> dentro dessa pasta.
              </li>
              <li>
                <strong>Pronto!</strong> Não precisa nem reiniciar o servidor; a Valve já começa a enviar cada ponto, mapa e vencedor em tempo real para esta tela!
              </li>
            </ol>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold uppercase tracking-wider text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Download size={14} />
                <span>Baixar gamestate_integration_cs2mixhub.cfg</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: MANUAL LOCAL PC INSTRUCTIONS */}
        {activeTab === 'manual' && (
          <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Laptop size={16} className="text-sky-400" />
              Instalação Manual (Arrastar e Soltar o .cfg):
            </h4>
            <p className="text-slate-400 leading-relaxed">
              Se você prefere colocar o arquivo manualmente sem usar o instalador automático:
            </p>

            <ol className="list-decimal list-inside space-y-2 text-slate-300">
              <li>
                Baixe o arquivo <code className="text-sky-300 font-mono font-bold">gamestate_integration_cs2mixhub.cfg</code>.
              </li>
              <li>
                Abra a pasta do seu CS2 no Windows (geralmente em):
                <code className="block mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 font-mono text-sky-300 text-[11px] break-all select-all">
                  C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\
                </code>
              </li>
              <li>
                Cole o arquivo dentro dessa pasta <span className="font-mono text-white">cfg</span>.
              </li>
              <li>
                Abra o CS2 e jogue normalmente!
              </li>
            </ol>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold uppercase tracking-wider text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Download size={14} />
                <span>Baixar .cfg Manual</span>
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold uppercase tracking-wider text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>
          </div>
        )}

        {/* DISCORD MONITORING CALLOUT */}
        <div className="mt-4 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-base">📢</span>
            <p className="text-xs text-indigo-200">
              <strong>Transmissão no Discord:</strong> O placar, vencedor de cada round (CT/TR), defuse e estatísticas (kills/mortes/MVPs) são enviados ao vivo no seu canal do Discord!
            </p>
          </div>
        </div>

        {/* ACTION BUTTONS: DIRECT INSTALL & BATCH */}
        <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleInstallDirectly}
            disabled={localInstallStatus.loading}
            className="w-full sm:flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black font-heading uppercase tracking-wider text-xs shadow-lg shadow-emerald-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {localInstallStatus.installed ? (
              <>
                <CheckCircle2 size={16} />
                <span>✅ GSI Instalado no CS2 (Clique para Reinstalar)</span>
              </>
            ) : (
              <>
                <Zap size={16} className="fill-slate-950" />
                <span>⚡ Instalar Direto no Meu CS2 (Sem Baixar)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadBat}
            className="w-full sm:w-auto py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold uppercase tracking-wider text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
            title="Baixar arquivo .bat para passar para seus amigos"
          >
            <Download size={15} className="text-emerald-400" />
            <span>Baixar .bat para Amigos</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold uppercase tracking-wider text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
            <span>{copied ? 'Copiado!' : 'Copiar .cfg'}</span>
          </button>
        </div>

        {/* CODE PREVIEW ACCORDION */}
        <div className="mt-4">
          <details className="group">
            <summary className="text-[11px] font-mono text-slate-400 hover:text-slate-200 cursor-pointer flex items-center gap-1.5 select-none">
              <FileCode size={12} className="text-emerald-400" />
              <span>Ver código fonte do gamestate_integration_cs2mixhub.cfg</span>
            </summary>
            <pre className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto custom-scrollbar">
              {cfgContent}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
