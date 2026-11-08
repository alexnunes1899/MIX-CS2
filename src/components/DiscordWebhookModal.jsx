import React, { useState, useEffect } from 'react';
import { X, Bell, Send, Check, AlertCircle, ExternalLink, ShieldCheck, Zap, Radio } from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function DiscordWebhookModal({
  isOpen,
  onClose,
  roomId,
  currentWebhook = '',
  autoLobby = true,
  autoVeto = true,
  autoGsiRounds = true,
  autoGsiBomb = false,
  autoStats = true,
  onSaveWebhook,
  soundEnabled,
}) {
  const [url, setUrl] = useState(currentWebhook || '');
  const [optLobby, setOptLobby] = useState(autoLobby);
  const [optVeto, setOptVeto] = useState(autoVeto);
  const [optGsiRounds, setOptGsiRounds] = useState(autoGsiRounds);
  const [optGsiBomb, setOptGsiBomb] = useState(autoGsiBomb);
  const [optStats, setOptStats] = useState(autoStats);
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    setOptGsiRounds(autoGsiRounds);
    setOptGsiBomb(autoGsiBomb);
    setOptStats(autoStats);
  }, [autoGsiRounds, autoGsiBomb, autoStats]);

  useEffect(() => {
    if (currentWebhook) {
      setUrl(currentWebhook);
    } else {
      const saved = localStorage.getItem('cs2_discord_webhook');
      if (saved) setUrl(saved);
    }
  }, [currentWebhook]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!url.trim()) {
      setStatusMsg({ type: 'error', text: 'Cole a URL do Webhook do Discord primeiro.' });
      return;
    }
    setTesting(true);
    setStatusMsg(null);
    if (soundEnabled) playClickSound();

    try {
      const res = await fetch('/api/discord/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: url.trim(),
          eventType: 'test',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg({ type: 'success', text: '✅ Mensagem de teste enviada com sucesso no canal do Discord!' });
      } else {
        setStatusMsg({ type: 'error', text: `❌ Erro do Discord: ${data.error || 'Falha ao enviar'}` });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: '❌ Erro de conexão ao enviar para o Discord.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (soundEnabled) playClickSound();

    const cleanUrl = url.trim();
    localStorage.setItem('cs2_discord_webhook', cleanUrl);

    if (onSaveWebhook) {
      onSaveWebhook({
        webhookUrl: cleanUrl,
        autoLobby: optLobby,
        autoVeto: optVeto,
        autoGsiRounds: optGsiRounds,
        autoGsiBomb: optGsiBomb,
        autoStats: optStats,
      });
    }

    setStatusMsg({ type: 'success', text: 'Configurações de Webhook salvas com sucesso!' });
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Bell size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black font-heading text-white">Notificações no Discord</h2>
            <p className="text-xs text-slate-400">Envie avisos automáticos no canal de texto do seu servidor</p>
          </div>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div className={`p-3 rounded-xl border text-xs font-semibold ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}>
            {statusMsg.text}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              URL do Webhook do Discord
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/123456.../abcdef..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-400 font-mono shadow-inner"
            />
          </div>

          {/* Automations Toggles */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={14} /> Disparos Automáticos
            </h4>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={optLobby}
                onChange={(e) => setOptLobby(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-500 focus:ring-0 bg-slate-900 border-slate-700"
              />
              <span>Avisar no canal quando o lobby bater <strong>10/10 jogadores</strong></span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={optVeto}
                onChange={(e) => setOptVeto(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-500 focus:ring-0 bg-slate-900 border-slate-700"
              />
              <span>Avisar no canal quando o <strong>veto terminar</strong> com mapa, times e connect</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={optStats}
                onChange={(e) => setOptStats(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-500 focus:ring-0 bg-slate-900 border-slate-700"
              />
              <span>Enviar <strong>Estatísticas dos Competidores</strong> (Scoreboard, K/D, MVPs e Top Fragger) no Discord</span>
            </label>

            <div className="pt-2 border-t border-slate-800/60">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                <Radio size={12} className="animate-pulse" /> Valve CS2 Game State Integration (GSI)
              </span>

              <div className="space-y-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={optGsiRounds}
                    onChange={(e) => setOptGsiRounds(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700 mt-0.5"
                  />
                  <div>
                    <span className="block font-bold text-white">Monitoramento de Rounds ao Vivo (GSI)</span>
                    <span className="text-[11px] text-slate-400 block leading-tight">
                      Envia o placar no Discord a cada round finalizado, quem venceu (CT ou TR), defuse/eliminação e virada de lado na 1ª metade.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={optGsiBomb}
                    onChange={(e) => setOptGsiBomb(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700 mt-0.5"
                  />
                  <div>
                    <span className="block font-bold text-white">Alerta de C4 Armada / Defusada</span>
                    <span className="text-[11px] text-slate-400 block leading-tight">
                      Avisa instantaneamente no canal do Discord quando a bomba for plantada ou desarmada.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Test & Save Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={testing || !url.trim()}
              onClick={handleTest}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Send size={13} className={testing ? 'animate-pulse' : ''} />
              <span>{testing ? 'Enviando...' : 'Enviar Teste'}</span>
            </button>

            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition-all cursor-pointer active:scale-95"
            >
              Salvar Configurações
            </button>
          </div>
        </form>

        {/* Tutorial Card */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
          <strong className="text-white block font-sans">Como criar um Webhook no seu Discord:</strong>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-400 font-sans">
            <li>No Discord, clique com botão direito no canal onde quer receber os avisos.</li>
            <li>Selecione <strong>Editar Canal → Integrações → Webhooks</strong>.</li>
            <li>Clique em <strong>Novo Webhook</strong>, dê o nome de "CS2 Mix Hub" e clique em <strong>Copiar URL do Webhook</strong>.</li>
            <li>Cole o link no campo acima e clique em <strong>Enviar Teste</strong>!</li>
          </ol>
        </div>

      </div>
    </div>
  );
}
