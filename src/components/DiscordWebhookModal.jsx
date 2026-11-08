import React, { useState, useEffect } from 'react';
import { X, Bell, Send, Check, AlertCircle, ExternalLink, ShieldCheck, Zap, Radio, Mic, Users, HelpCircle } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('webhook'); // 'webhook' | 'voicemover'
  const [url, setUrl] = useState(currentWebhook || '');
  const [optLobby, setOptLobby] = useState(autoLobby);
  const [optVeto, setOptVeto] = useState(autoVeto);
  const [optGsiRounds, setOptGsiRounds] = useState(autoGsiRounds);
  const [optGsiBomb, setOptGsiBomb] = useState(autoGsiBomb);
  const [optStats, setOptStats] = useState(autoStats);
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Voice Mover Bot State
  const [botToken, setBotToken] = useState(() => localStorage.getItem('cs2_discord_bot_token') || '');
  const [guildId, setGuildId] = useState(() => localStorage.getItem('cs2_discord_guild_id') || '');
  const [lobbyVoiceId, setLobbyVoiceId] = useState(() => localStorage.getItem('cs2_discord_lobby_voice') || '');
  const [teamAVoiceId, setTeamAVoiceId] = useState(() => localStorage.getItem('cs2_discord_teama_voice') || '');
  const [teamBVoiceId, setTeamBVoiceId] = useState(() => localStorage.getItem('cs2_discord_teamb_voice') || '');
  const [testingVoice, setTestingVoice] = useState(false);

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

  const handleTestVoiceMover = async () => {
    if (!botToken.trim() || !guildId.trim() || !lobbyVoiceId.trim()) {
      setStatusMsg({ type: 'error', text: 'Preencha o Token do Bot, Guild ID e ID do Canal de Voz de Teste.' });
      return;
    }
    setTestingVoice(true);
    setStatusMsg(null);
    if (soundEnabled) playClickSound();

    try {
      const res = await fetch('/api/discord/test-voice-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botToken.trim(),
          guildId: guildId.trim(),
          channelId: lobbyVoiceId.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg({
          type: 'success',
          text: `✅ Bot conectado com sucesso! Canal detectado: #${data.channelName}`,
        });
      } else {
        setStatusMsg({ type: 'error', text: `❌ Erro do Bot Discord: ${data.error}` });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: '❌ Erro ao validar canais de voz com a API do Discord.' });
    } finally {
      setTestingVoice(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (soundEnabled) playClickSound();

    const cleanUrl = url.trim();
    localStorage.setItem('cs2_discord_webhook', cleanUrl);
    localStorage.setItem('cs2_discord_bot_token', botToken.trim());
    localStorage.setItem('cs2_discord_guild_id', guildId.trim());
    localStorage.setItem('cs2_discord_lobby_voice', lobbyVoiceId.trim());
    localStorage.setItem('cs2_discord_teama_voice', teamAVoiceId.trim());
    localStorage.setItem('cs2_discord_teamb_voice', teamBVoiceId.trim());

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

    setStatusMsg({ type: 'success', text: 'Configurações do Discord salvas com sucesso!' });
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 custom-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
            <Bell size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black font-heading text-white">Integração Oficial com o Discord</h2>
            <p className="text-xs text-slate-400">Webhooks em tempo real e movimentador automático de chamadas de voz</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('webhook')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'webhook'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bell size={14} />
            <span>Webhooks de Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('voicemover')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'voicemover'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mic size={14} />
            <span>Mover de Voz (Bot)</span>
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold animate-fadeIn ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        {/* TAB 1: WEBHOOK FORM */}
        {activeTab === 'webhook' && (
          <form onSubmit={handleSave} className="space-y-4 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-heading">
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
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 font-heading">
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
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1 mb-2 font-heading">
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
        )}

        {/* TAB 2: VOICE CHANNEL MOVER BOT FORM */}
        {activeTab === 'voicemover' && (
          <form onSubmit={handleSave} className="space-y-3.5 animate-fadeIn">
            <div className="bg-slate-950/80 p-3 rounded-2xl border border-indigo-500/30 space-y-2">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide flex items-center gap-1.5 font-heading">
                <Mic size={14} className="text-indigo-400" /> Movimentador Automático de Calls de Voz
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Quando a partida iniciar, os jogadores serão movidos automaticamente para as calls do <strong>Time A</strong> e <strong>Time B</strong>. Ao final da partida, voltam para a call do <strong>Lobby</strong>!
              </p>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Token do Bot Discord (com permissão MOVE_MEMBERS)
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="OTM5NDc2..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    ID do Servidor (Guild ID)
                  </label>
                  <input
                    type="text"
                    value={guildId}
                    onChange={(e) => setGuildId(e.target.value)}
                    placeholder="123456789012345678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    ID Canal Lobby Geral
                  </label>
                  <input
                    type="text"
                    value={lobbyVoiceId}
                    onChange={(e) => setLobbyVoiceId(e.target.value)}
                    placeholder="Canal de espera"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-400 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-1">
                    ID Canal Voz Time A
                  </label>
                  <input
                    type="text"
                    value={teamAVoiceId}
                    onChange={(e) => setTeamAVoiceId(e.target.value)}
                    placeholder="Call Time A"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-sky-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                    ID Canal Voz Time B
                  </label>
                  <input
                    type="text"
                    value={teamBVoiceId}
                    onChange={(e) => setTeamBVoiceId(e.target.value)}
                    placeholder="Call Time B"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <button
                type="button"
                disabled={testingVoice || !botToken.trim()}
                onClick={handleTestVoiceMover}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Zap size={13} className={testingVoice ? 'animate-spin' : ''} />
                <span>{testingVoice ? 'Testando...' : 'Testar Permissão do Bot'}</span>
              </button>

              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition-all cursor-pointer active:scale-95"
              >
                Salvar Configurações de Voz
              </button>
            </div>
          </form>
        )}

        {/* Tutorial Card */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <strong className="text-white block font-sans">
            {activeTab === 'webhook' ? 'Como criar um Webhook no Discord:' : 'Como configurar o Bot Voice Mover:'}
          </strong>
          {activeTab === 'webhook' ? (
            <ol className="list-decimal list-inside space-y-0.5 text-slate-400 font-sans">
              <li>Clique com botão direito no canal onde quer receber os avisos.</li>
              <li>Selecione <strong>Editar Canal → Integrações → Webhooks</strong>.</li>
              <li>Clique em <strong>Novo Webhook</strong>, copie a URL e cole acima.</li>
            </ol>
          ) : (
            <p className="text-slate-400 leading-normal">
              Crie um bot no <strong>Discord Developer Portal</strong>, ative a permissão <strong>Mover Membros (Move Members)</strong> e convide-o para o servidor. Copie os IDs dos canais de voz com o Modo Desenvolvedor do Discord ativado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
