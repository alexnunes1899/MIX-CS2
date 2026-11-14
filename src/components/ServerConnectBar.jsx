import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Server, Copy, Check, Edit2, Play, Trash2, Key, Radio, Terminal, RefreshCw, Zap, ShieldCheck, Laptop, CheckCircle2 } from 'lucide-react';
import { playClickSound } from '../utils/audio';
import { parseServerDetails } from '../utils/serverParser';
import { copyText } from '../utils/clipboard';

const LocalHostModal = lazy(() => import('./LocalHostModal'));

export default function ServerConnectBar({
  serverIp,
  onUpdateServerIp,
  rconPassword = '',
  onUpdateRconPassword,
  roomId,
  liveMatch = null,
  onOpenGsiSetup,
  onOpenServersPage,
  soundEnabled,
  title = 'Servidor do Mix (FireGames / Dedicado / Host)',
  description = 'Conecte-se diretamente, crie um host local no seu PC ou envie comandos RCON',
  finalMap = 'de_mirage',
}) {
  const [editing, setEditing] = useState(false);
  const [ipInput, setIpInput] = useState(serverIp || '');
  const [copied, setCopied] = useState(false);
  const [localHostOpen, setLocalHostOpen] = useState(false);
  const [gsiInstalled, setGsiInstalled] = useState(false);

  useEffect(() => {
    fetch('/api/gsi/check-installed')
      .then((res) => res.json())
      .then((data) => setGsiInstalled(Boolean(data?.installed)))
      .catch(() => {});
  }, []);

  // RCON Drawer state
  const [showRcon, setShowRcon] = useState(false);
  const [rconPassInput, setRconPassInput] = useState(rconPassword || '');
  const [rconTesting, setRconTesting] = useState(false);
  const [rconStatusMsg, setRconStatusMsg] = useState(null);

  const parsed = parseServerDetails(serverIp);

  const handleStartEditing = () => {
    if (soundEnabled) playClickSound();
    setIpInput(serverIp || '');
    setEditing(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (soundEnabled) playClickSound();
    onUpdateServerIp(ipInput.trim());
    setEditing(false);
  };

  const handleClear = () => {
    if (soundEnabled) playClickSound();
    onUpdateServerIp('');
    setIpInput('');
    setEditing(false);
  };

  const handleCopy = () => {
    if (!parsed.isValid) return;
    if (soundEnabled) playClickSound();
    copyText(parsed.connectCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveRcon = (e) => {
    e.preventDefault();
    if (soundEnabled) playClickSound();
    if (onUpdateRconPassword) {
      onUpdateRconPassword(rconPassInput.trim());
    }
    setRconStatusMsg({ text: 'Senha RCON salva!', type: 'success' });
    setTimeout(() => setRconStatusMsg(null), 3000);
  };

  const handleTestRcon = async () => {
    if (!parsed.isValid || !rconPassInput) {
      setRconStatusMsg({ text: 'Preencha o IP do servidor e a senha RCON.', type: 'error' });
      return;
    }
    setRconTesting(true);
    setRconStatusMsg(null);
    try {
      const res = await fetch('/api/rcon/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: parsed.host || parsed.ip.split(':')[0],
          port: parsed.port || 27015,
          password: rconPassInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRconStatusMsg({ text: 'Conectado com sucesso ao RCON do servidor!', type: 'success' });
        if (onUpdateRconPassword) onUpdateRconPassword(rconPassInput.trim());
      } else {
        setRconStatusMsg({ text: data.error || 'Falha ao autenticar no RCON.', type: 'error' });
      }
    } catch (e) {
      setRconStatusMsg({ text: 'Erro ao comunicar com o servidor RCON.', type: 'error' });
    } finally {
      setRconTesting(false);
    }
  };

  const handleExecRcon = async (cmd, label) => {
    if (!parsed.isValid || !rconPassInput) {
      setRconStatusMsg({ text: 'Configure a senha RCON primeiro.', type: 'error' });
      return;
    }
    setRconTesting(true);
    try {
      const res = await fetch('/api/rcon/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: parsed.host || parsed.ip.split(':')[0],
          port: parsed.port || 27015,
          password: rconPassInput.trim(),
          command: cmd,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRconStatusMsg({ text: `${label}: executado com sucesso no servidor!`, type: 'success' });
      } else {
        setRconStatusMsg({ text: data.error || 'Erro ao executar comando.', type: 'error' });
      }
    } catch (e) {
      setRconStatusMsg({ text: 'Erro na requisição RCON.', type: 'error' });
    } finally {
      setRconTesting(false);
      setTimeout(() => setRconStatusMsg(null), 4000);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-4.5 backdrop-blur shadow-xl transition-all relative overflow-hidden">
      {/* Background Accent Glow */}
      <div className={`absolute top-0 right-0 w-48 h-32 rounded-full blur-3xl pointer-events-none ${
        parsed.isValid ? 'bg-emerald-500/10' : 'bg-amber-500/5'
      }`} />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Left: Server Status & Address */}
        <div className="flex items-start sm:items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
            parsed.isValid
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/10'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            <Server size={20} />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <span>{title}</span>
              </h4>

              {parsed.isValid ? (
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  ONLINE
                </span>
              ) : (
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 flex items-center gap-1">
                  <Radio size={10} /> NÃO CONFIGURADO
                </span>
              )}

              {/* GSI Live Match Badge */}
              {liveMatch?.connected && (
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping"></span>
                  GSI AO VIVO: CT {liveMatch.scoreCT} x {liveMatch.scoreTR} TR
                </span>
              )}

              {!editing && (
                <button
                  onClick={handleStartEditing}
                  className="text-slate-400 hover:text-amber-400 transition-colors p-1 cursor-pointer"
                  title="Editar IP e Porta do servidor"
                >
                  <Edit2 size={13} />
                </button>
              )}

              {!editing && parsed.isValid && (
                <button
                  onClick={handleClear}
                  className="text-slate-500 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                  title="Remover servidor da sala"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {parsed.isValid ? (
                <>
                  <code className="text-xs font-mono font-bold text-amber-300 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800">
                    {parsed.ip}
                  </code>

                  {parsed.password && (
                    <span className="text-[11px] text-slate-300 font-mono flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800">
                      <Key size={11} className="text-amber-400" />
                      <span>senha: <strong>{parsed.password}</strong></span>
                    </span>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions (Connect, RCON, GSI) */}
        <div className="w-full md:w-auto">
          {editing ? (
            <form onSubmit={handleSave} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                placeholder="Ex: 177.54.12.34:27015 ou connect ip; password mix"
                autoFocus
                className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 font-mono w-full sm:w-72 shadow-inner"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : parsed.isValid ? (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Copy Connect Button */}
              <button
                onClick={handleCopy}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
                title={`Copiar para área de transferência: ${parsed.connectCommand}`}
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-emerald-400" />
                    <span className="text-emerald-300">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copiar Connect</span>
                  </>
                )}
              </button>

              {/* Automatic Connect Link (steam://connect/...) */}
              {parsed.steamUrl && (
                <a
                  href={parsed.steamUrl}
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-95"
                  title="Abrir o Counter-Strike 2 e conectar automaticamente ao servidor"
                >
                  <Play size={13} fill="currentColor" />
                  <span>Conectar CS2</span>
                </a>
              )}

              {/* RCON Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  setShowRcon(!showRcon);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  showRcon
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
                }`}
                title="Administrar servidor via RCON (FireGames)"
              >
                <Terminal size={13} className="text-amber-400" />
                <span>RCON</span>
              </button>

              {/* Central de Servidores / Host Guide */}
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  if (onOpenServersPage) onOpenServersPage();
                  else setLocalHostOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                title="Central Completa de Servidores (Dedicado Online, LAN Party, Radmin VPN e Testador de Portas)"
              >
                <Server size={13} className="text-amber-400" />
                <span>Central Servidores</span>
              </button>

              {/* GSI Setup Button */}
              {onOpenGsiSetup && (
                <button
                  type="button"
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    onOpenGsiSetup();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    gsiInstalled
                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300'
                      : 'bg-teal-500/15 hover:bg-teal-500/25 border-teal-500/40 text-teal-300'
                  }`}
                  title={gsiInstalled ? "GSI Valve instalado no seu CS2! Clique para abrir detalhes." : "Configurar Placar Automático Oficial Valve (GSI)"}
                >
                  {gsiInstalled ? (
                    <CheckCircle2 size={13} className="text-emerald-400" />
                  ) : (
                    <Radio size={13} className={liveMatch?.connected ? 'text-teal-400 animate-pulse' : 'text-slate-400'} />
                  )}
                  <span>{gsiInstalled ? 'GSI Instalado' : 'Placar GSI'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Central de Servidores / Host on My PC Button */}
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  if (onOpenServersPage) onOpenServersPage();
                  else setLocalHostOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-400 text-amber-300 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                title="Abrir Central Completa de Servidores (Dedicado, Host PC, LAN Party e Radmin VPN)"
              >
                <Server size={14} className="text-amber-400" />
                <span>Central de Servidores</span>
              </button>

              <button
                onClick={handleStartEditing}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 hover:border-amber-400 text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
              >
                <Server size={14} />
                <span>Configurar Servidor</span>
              </button>

              {onOpenGsiSetup && (
                <button
                  type="button"
                  onClick={onOpenGsiSetup}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    gsiInstalled
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-teal-500/15 border-teal-500/30 hover:border-teal-400 text-teal-300'
                  }`}
                  title={gsiInstalled ? "GSI Valve instalado no seu CS2! Clique para abrir detalhes." : "Configurar Placar Automático Oficial Valve (GSI)"}
                >
                  {gsiInstalled ? (
                    <CheckCircle2 size={13} className="text-emerald-400" />
                  ) : (
                    <Radio size={13} />
                  )}
                  <span>{gsiInstalled ? 'GSI Instalado' : 'GSI Valve'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RCON CONTROL DRAWER */}
      {showRcon && (
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Terminal size={13} className="text-amber-400" />
                <span>Controle Remoto Valve RCON (FireGames)</span>
              </h5>
              <p className="text-[11px] text-slate-400">
                Envie comandos de administração diretamente para o servidor da FireGames sem abrir o console.
              </p>
            </div>

            {/* RCON Status Feedback */}
            {rconStatusMsg && (
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-lg border ${
                rconStatusMsg.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
              }`}>
                {rconStatusMsg.text}
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Key size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={rconPassInput}
                onChange={(e) => setRconPassInput(e.target.value)}
                placeholder="Senha RCON do servidor FireGames (rcon_password)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 font-mono shadow-inner"
              />
            </div>

            <button
              type="button"
              disabled={rconTesting || !rconPassInput}
              onClick={handleTestRcon}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {rconTesting ? 'Conectando...' : 'Testar Conexão RCON'}
            </button>

            <button
              type="button"
              disabled={rconTesting || !rconPassInput}
              onClick={() => handleExecRcon('mp_restartgame 1', 'Reiniciar Jogo')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Executa mp_restartgame 1"
            >
              Reiniciar Partida
            </button>

            <button
              type="button"
              disabled={rconTesting || !rconPassInput}
              onClick={() => handleExecRcon('mp_warmup_end', 'Iniciar Jogo')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Executa mp_warmup_end"
            >
              Fim Aquecimento
            </button>
          </div>
        </div>
      )}

      {/* Local Host Guide & Setup Modal */}
      {localHostOpen && (
        <Suspense fallback={null}>
          <LocalHostModal
            isOpen={localHostOpen}
            onClose={() => setLocalHostOpen(false)}
            roomId={roomId}
            currentServerIp={serverIp}
            finalMap={finalMap}
            onUpdateServerIp={onUpdateServerIp}
            soundEnabled={soundEnabled}
          />
        </Suspense>
      )}
    </div>
  );
}
