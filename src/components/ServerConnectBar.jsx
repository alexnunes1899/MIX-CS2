import React, { useState } from 'react';
import { Server, ExternalLink, Copy, Check, Edit2, Play } from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function ServerConnectBar({
  serverIp,
  onUpdateServerIp,
  soundEnabled,
}) {
  const [editing, setEditing] = useState(false);
  const [ipInput, setIpInput] = useState(serverIp || '');
  const [copied, setCopied] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    if (soundEnabled) playClickSound();
    onUpdateServerIp(ipInput.trim());
    setEditing(false);
  };

  const handleCopy = () => {
    if (soundEnabled) playClickSound();
    navigator.clipboard.writeText(`connect ${serverIp}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steamConnectUrl = serverIp ? `steam://connect/${serverIp.replace('connect ', '').trim()}` : null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 backdrop-blur shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <Server size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>Servidor de CS2</span>
              {!editing && (
                <button
                  onClick={() => {
                    setIpInput(serverIp || '');
                    setEditing(true);
                  }}
                  className="text-slate-500 hover:text-amber-400 transition-colors p-0.5"
                  title="Configurar IP do servidor"
                >
                  <Edit2 size={12} />
                </button>
              )}
            </h4>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              {serverIp ? (
                <strong className="text-amber-400">{serverIp}</strong>
              ) : (
                <span className="italic text-slate-500">Nenhum IP cadastrado (clique no lápis para configurar)</span>
              )}
            </p>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="flex items-center gap-2">
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              placeholder="Ex: 177.54.12.34:27015"
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 font-mono"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-2 py-1.5 rounded-xl bg-slate-800 text-slate-400 text-xs"
            >
              Cancelar
            </button>
          </form>
        ) : (
          serverIp && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
                title="Copiar comando connect"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? 'Copiado!' : 'Copiar Connect'}</span>
              </button>

              {steamConnectUrl && (
                <a
                  href={steamConnectUrl}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs transition-all shadow-md cursor-pointer"
                  title="Abrir o CS2 e conectar automaticamente"
                >
                  <Play size={13} fill="currentColor" />
                  <span>Conectar no CS2</span>
                </a>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
