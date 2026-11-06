import React, { useState } from 'react';
import { Server, Copy, Check, Edit2, Play, Trash2, Key, Radio } from 'lucide-react';
import { playClickSound } from '../utils/audio';
import { parseServerDetails } from '../utils/serverParser';

export default function ServerConnectBar({
  serverIp,
  onUpdateServerIp,
  soundEnabled,
  title = 'Servidor do Mix',
  description = 'Conecte-se diretamente ou copie o comando do console',
}) {
  const [editing, setEditing] = useState(false);
  const [ipInput, setIpInput] = useState(serverIp || '');
  const [copied, setCopied] = useState(false);

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
    navigator.clipboard.writeText(parsed.connectCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

              {!editing && (
                <button
                  onClick={handleStartEditing}
                  className="text-slate-400 hover:text-amber-400 transition-colors p-1 cursor-pointer"
                  title="Editar dados do servidor"
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

        {/* Right: Actions or Edit Form */}
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
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
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
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-95"
                  title="Abrir o Counter-Strike 2 e conectar automaticamente ao servidor"
                >
                  <Play size={13} fill="currentColor" />
                  <span>Conectar no CS2</span>
                </a>
              )}
            </div>
          ) : (
            <button
              onClick={handleStartEditing}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 hover:border-amber-400 text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <Server size={14} />
              <span>Configurar Servidor</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
