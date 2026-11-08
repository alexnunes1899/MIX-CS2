import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Send,
  Check,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Radio,
  Mic,
  Users,
  HelpCircle,
  Bot,
  Power,
  RefreshCw,
  Terminal,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Volume2,
  Cpu,
  Copy,
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('bot'); // 'bot' | 'voicemover' | 'webhook'
  const [showToken, setShowToken] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showCriteria, setShowCriteria] = useState(false);

  // Bot Status State from /api/discord/bot/status
  const [botStatus, setBotStatus] = useState({
    running: false,
    tag: null,
    id: null,
    guildCount: 0,
    ping: null,
    lastError: null,
    activeMixesCount: 0,
  });
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Bot Configuration State
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [guildId, setGuildId] = useState('');
  const [defaultChannelId, setDefaultChannelId] = useState('');
  const [serverConnect, setServerConnect] = useState('');

  // Voice Mover Configuration State
  const [lobbyVoiceId, setLobbyVoiceId] = useState('');
  const [teamAVoiceId, setTeamAVoiceId] = useState('');
  const [teamBVoiceId, setTeamBVoiceId] = useState('');
  const [autoMoveVoice, setAutoMoveVoice] = useState(true);
  const [testingVoice, setTestingVoice] = useState(false);

  // Webhooks State
  const [url, setUrl] = useState(currentWebhook || '');
  const [optLobby, setOptLobby] = useState(autoLobby);
  const [optVeto, setOptVeto] = useState(autoVeto);
  const [optGsiRounds, setOptGsiRounds] = useState(autoGsiRounds);
  const [optGsiBomb, setOptGsiBomb] = useState(autoGsiBomb);
  const [optStats, setOptStats] = useState(autoStats);
  const [testingWebhook, setTestingWebhook] = useState(false);

  // Status / Feedback alerts
  const [statusMsg, setStatusMsg] = useState(null);

  // Fetch bot status and initial configuration from server
  const fetchBotStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch('/api/discord/bot/status');
      if (res.ok) {
        const data = await res.json();
        setBotStatus(data);
        if (data.config) {
          if (data.config.clientId && !clientId) setClientId(data.config.clientId);
          if (data.config.guildId && !guildId) setGuildId(data.config.guildId);
          if (data.config.defaultChannelId && !defaultChannelId) setDefaultChannelId(data.config.defaultChannelId);
          if (data.config.lobbyVoiceId && !lobbyVoiceId) setLobbyVoiceId(data.config.lobbyVoiceId);
          if (data.config.teamAVoiceId && !teamAVoiceId) setTeamAVoiceId(data.config.teamAVoiceId);
          if (data.config.teamBVoiceId && !teamBVoiceId) setTeamBVoiceId(data.config.teamBVoiceId);
          if (data.config.autoMoveVoice !== undefined) setAutoMoveVoice(Boolean(data.config.autoMoveVoice));
          if (data.config.serverConnect && !serverConnect) setServerConnect(data.config.serverConnect);
        }
      }
    } catch (e) {
      console.warn('[DISCORD MODAL] Falha ao consultar status do bot:', e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBotStatus();
      // Load saved values from localStorage as fallback
      const savedToken = localStorage.getItem('cs2_discord_bot_token');
      const savedGuild = localStorage.getItem('cs2_discord_guild_id');
      const savedChannel = localStorage.getItem('cs2_discord_channel_id');
      const savedLobby = localStorage.getItem('cs2_discord_lobby_voice');
      const savedTeamA = localStorage.getItem('cs2_discord_teama_voice');
      const savedTeamB = localStorage.getItem('cs2_discord_teamb_voice');
      const savedServer = localStorage.getItem('cs2_discord_server_connect');

      if (savedToken && !token) setToken(savedToken);
      if (savedGuild && !guildId) setGuildId(savedGuild);
      if (savedChannel && !defaultChannelId) setDefaultChannelId(savedChannel);
      if (savedLobby && !lobbyVoiceId) setLobbyVoiceId(savedLobby);
      if (savedTeamA && !teamAVoiceId) setTeamAVoiceId(savedTeamA);
      if (savedTeamB && !teamBVoiceId) setTeamBVoiceId(savedTeamB);
      if (savedServer && !serverConnect) setServerConnect(savedServer);
    }
  }, [isOpen]);

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

  // Bot Start / Stop Handlers
  const handleStartBot = async () => {
    if (soundEnabled) playClickSound();
    setActionLoading(true);
    setStatusMsg(null);
    try {
      // Save configuration first if fields were filled
      await fetch('/api/discord/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(token.trim() ? { token: token.trim() } : {}),
          clientId: clientId.trim(),
          guildId: guildId.trim(),
          defaultChannelId: defaultChannelId.trim(),
          lobbyVoiceId: lobbyVoiceId.trim(),
          teamAVoiceId: teamAVoiceId.trim(),
          teamBVoiceId: teamBVoiceId.trim(),
          autoMoveVoice,
          serverConnect: serverConnect.trim(),
        }),
      });

      const res = await fetch('/api/discord/bot/start', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({
          type: 'success',
          text: `🚀 Bot conectado com sucesso como @${data.tag}! Slash Commands registrados.`,
        });
        await fetchBotStatus();
      } else {
        setStatusMsg({
          type: 'error',
          text: `❌ Falha ao iniciar bot: ${data.error || 'Verifique o Token no Discord Portal'}`,
        });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: `❌ Erro de conexão com o servidor: ${e.message}` });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopBot = async () => {
    if (soundEnabled) playClickSound();
    setActionLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/discord/bot/stop', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: '⏹️ Bot do Discord desconectado.' });
        await fetchBotStatus();
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: `❌ Erro ao parar bot: ${e.message}` });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveBotConfig = async (e) => {
    if (e) e.preventDefault();
    if (soundEnabled) playClickSound();
    setActionLoading(true);
    setStatusMsg(null);

    // Save locally
    if (token.trim()) localStorage.setItem('cs2_discord_bot_token', token.trim());
    if (guildId.trim()) localStorage.setItem('cs2_discord_guild_id', guildId.trim());
    if (defaultChannelId.trim()) localStorage.setItem('cs2_discord_channel_id', defaultChannelId.trim());
    if (lobbyVoiceId.trim()) localStorage.setItem('cs2_discord_lobby_voice', lobbyVoiceId.trim());
    if (teamAVoiceId.trim()) localStorage.setItem('cs2_discord_teama_voice', teamAVoiceId.trim());
    if (teamBVoiceId.trim()) localStorage.setItem('cs2_discord_teamb_voice', teamBVoiceId.trim());
    if (serverConnect.trim()) localStorage.setItem('cs2_discord_server_connect', serverConnect.trim());

    try {
      const res = await fetch('/api/discord/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(token.trim() ? { token: token.trim() } : {}),
          clientId: clientId.trim(),
          guildId: guildId.trim(),
          defaultChannelId: defaultChannelId.trim(),
          lobbyVoiceId: lobbyVoiceId.trim(),
          teamAVoiceId: teamAVoiceId.trim(),
          teamBVoiceId: teamBVoiceId.trim(),
          autoMoveVoice,
          serverConnect: serverConnect.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({ type: 'success', text: '✅ Configurações do Bot Discord salvas com sucesso!' });
        await fetchBotStatus();
      } else {
        setStatusMsg({ type: 'error', text: `❌ Erro ao salvar: ${data.error || 'Falha desconhecida'}` });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: `❌ Erro ao salvar configurações: ${e.message}` });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendPanel = async () => {
    if (soundEnabled) playClickSound();
    const targetChannel = defaultChannelId.trim();
    if (!targetChannel) {
      setStatusMsg({ type: 'error', text: 'Preencha o ID do Canal de Texto onde o painel será enviado.' });
      return;
    }
    setActionLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/discord/bot/panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: targetChannel }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({
          type: 'success',
          text: `📢 Painel oficial de Mix CS2 enviado com sucesso no canal #${data.channelName || targetChannel}!`,
        });
      } else {
        setStatusMsg({ type: 'error', text: `❌ Erro ao enviar painel: ${data.error || 'Verifique permissões do bot'}` });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: `❌ Falha ao enviar painel: ${e.message}` });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestVoiceMover = async () => {
    if (!token.trim() || !guildId.trim() || !lobbyVoiceId.trim()) {
      setStatusMsg({ type: 'error', text: 'Preencha o Token do Bot, Guild ID e ID do Canal de Voz do Lobby.' });
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
          botToken: token.trim(),
          guildId: guildId.trim(),
          channelId: lobbyVoiceId.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg({
          type: 'success',
          text: `✅ Permissão de voz confirmada! Canal detectado: #${data.channelName}`,
        });
      } else {
        setStatusMsg({ type: 'error', text: `❌ Erro do Bot Discord: ${data.error}` });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: '❌ Erro ao validar canal de voz com o Discord.' });
    } finally {
      setTestingVoice(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!url.trim()) {
      setStatusMsg({ type: 'error', text: 'Cole a URL do Webhook do Discord primeiro.' });
      return;
    }
    setTestingWebhook(true);
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
        setStatusMsg({ type: 'success', text: '✅ Mensagem de teste enviada com sucesso no Discord!' });
      } else {
        setStatusMsg({ type: 'error', text: `❌ Erro do Discord: ${data.error || 'Falha ao enviar'}` });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: '❌ Erro de conexão ao enviar para o Discord.' });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleSaveWebhookForm = (e) => {
    if (e) e.preventDefault();
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

    setStatusMsg({ type: 'success', text: '✅ Notificações e Webhooks salvos com sucesso!' });
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const effectiveClientId = clientId.trim() || botStatus.id || '1569029813518336030';
  const botInviteUrl = `https://discord.com/oauth2/authorize?client_id=${effectiveClientId}&permissions=8&integration_type=0&scope=bot+applications.commands`;

  const handleCopyInvite = () => {
    if (soundEnabled) playClickSound();
    navigator.clipboard.writeText(botInviteUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 custom-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-700/60"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0 shadow-inner">
            <Bot size={26} className="text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black font-heading text-white">Central Discord CS2 Mix Hub</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Oficial v14
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Bot interativo 5v5 com Pick & Ban, fila rápida, comandos slash e integração por voz
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('bot')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'bot'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bot size={15} />
            <span>Bot do Discord</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('voicemover')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'voicemover'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mic size={15} />
            <span>Canais de Voz</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('webhook')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'webhook'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bell size={15} />
            <span>Webhooks & GSI</span>
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div
            className={`p-3 rounded-2xl border text-xs font-semibold animate-fadeIn flex items-center justify-between gap-3 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{statusMsg.text}</span>
            </div>
            <button
              onClick={() => setStatusMsg(null)}
              className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: OFFICIAL DISCORD BOT ENGINE                       */}
        {/* ======================================================== */}
        {activeTab === 'bot' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Live Status Bar */}
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3.5 h-3.5 rounded-full ${
                      botStatus.running
                        ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse'
                        : 'bg-slate-600'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-white">
                        {botStatus.running ? 'Bot Conectado & Operacional' : 'Bot Desconectado (Offline)'}
                      </span>
                      {botStatus.tag && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          @{botStatus.tag}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 block">
                      {botStatus.running
                        ? `Ping: ${botStatus.ping || 0}ms • ${botStatus.guildCount || 0} servidor(es) • ${botStatus.activeMixesCount || 0} mix(es) ativo(s)`
                        : botStatus.lastError || 'Insira o token abaixo e clique em Iniciar Bot para ativar.'}
                    </span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchBotStatus}
                    disabled={loadingStatus}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/60 text-xs transition-colors cursor-pointer"
                    title="Atualizar Status"
                  >
                    <RefreshCw size={14} className={loadingStatus ? 'animate-spin' : ''} />
                  </button>

                  {botStatus.running ? (
                    <button
                      type="button"
                      onClick={handleStopBot}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Power size={13} />
                      <span>Parar Bot</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartBot}
                      disabled={actionLoading || (!token && !botStatus.config?.hasToken)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Power size={13} />
                      <span>Iniciar Bot</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Bot Info Callout */}
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
                Organize partidas 5v5 diretamente no canal de texto do Discord com botões de entrada, sorteio equilibrado de capitães e times, e <strong>Pick & Ban de mapas oficial</strong> com turnos alternados!
              </div>
            </div>

            {/* 1-CLICK DISCORD BOT INVITE & CRITERIA SHOWCASE */}
            <div className="bg-gradient-to-br from-indigo-950/70 via-slate-950 to-purple-950/50 p-4 rounded-2xl border border-indigo-500/30 space-y-3 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h3 className="text-sm font-black font-heading text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Bot size={17} className="text-indigo-400" />
                      Adicione o Bot ao seu Servidor
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Clique no botão para convidar o <strong>CS2 Mix Hub Bot</strong> para o seu servidor Discord e liberar comandos <code>!mix</code>, sorteio por elo e Pick & Ban!
                  </p>
                </div>

                {/* Invite & Copy Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={botInviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => soundEnabled && playClickSound()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                  >
                    <ExternalLink size={14} />
                    <span>Convidar Bot</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-300 border border-slate-700/70 text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Copiar link de convite do Bot"
                  >
                    {copiedInvite ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span className="text-[11px] font-bold">{copiedInvite ? 'Copiado!' : 'Copiar Link'}</span>
                  </button>
                </div>
              </div>

              {/* CRITÉRIOS OBRIGATÓRIOS PARA CONSEGUIR ADICIONAR */}
              <div className="pt-2.5 border-t border-indigo-500/20">
                <button
                  type="button"
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    setShowCriteria(!showCriteria);
                  }}
                  className="w-full flex items-center justify-between text-left text-xs font-bold text-indigo-300 hover:text-indigo-200 cursor-pointer py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={15} className="text-amber-400" />
                    <strong>Critérios obrigatórios para conseguir adicionar o bot ao servidor</strong>
                  </span>
                  <span className="text-[11px] font-mono text-indigo-400 underline">
                    {showCriteria ? 'Ocultar requisitos ▲' : 'Ver requisitos necessários ▼'}
                  </span>
                </button>

                {showCriteria && (
                  <div className="mt-2.5 p-3.5 rounded-xl bg-slate-950/95 border border-indigo-500/30 space-y-3 text-[11px] text-slate-300 leading-relaxed animate-fadeIn">
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        1
                      </div>
                      <div>
                        <strong className="text-white block font-heading text-xs">
                          👑 Permissão de Administrador ou "Gerenciar Servidor" (Manage Server)
                        </strong>
                        <span className="text-slate-400 block mt-0.5">
                          No Discord, apenas o <strong>Dono do Servidor</strong> ou membros que possuam um cargo com a permissão <strong>"Gerenciar Servidor"</strong> ou <strong>"Administrador"</strong> ativa podem autorizar e adicionar novos bots. Se você for membro comum, copie o link de convite e envie para um administrador do seu servidor.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        2
                      </div>
                      <div>
                        <strong className="text-white block font-heading text-xs">
                          📱 Conta do Discord Verificada
                        </strong>
                        <span className="text-slate-400 block mt-0.5">
                          Para autorizar aplicativos externos OAuth2, o Discord exige que a sua conta de usuário tenha um <strong>e-mail ou número de telefone verificado</strong>.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        3
                      </div>
                      <div>
                        <strong className="text-white block font-heading text-xs">
                          🛡️ Hierarquia de Cargos (Para Patentes Automáticas)
                        </strong>
                        <span className="text-slate-400 block mt-0.5">
                          Após o bot entrar no servidor, vá em <em>Configurações do Servidor &gt; Cargos</em> e arraste o cargo do bot (<code>cs hub</code>) para <strong>cima dos membros comuns</strong>. A hierarquia do Discord exige que o bot esteja acima para poder entregar as patentes automáticas (<code>@Competidor</code>, <code>@Veterano</code>, <code>@Major Champion</code> e <code>@Rei do Servidor</code>).
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        4
                      </div>
                      <div>
                        <strong className="text-white block font-heading text-xs">
                          🎙️ Permissão de Voz (Mover Membros) & Texto (Embeds)
                        </strong>
                        <span className="text-slate-400 block mt-0.5">
                          Para que o botão <code>[📞 Mover Calls]</code> funcione puxando os times para as salas CT e TR, o bot precisa da permissão <strong>"Mover Membros"</strong> ativa. No canal de texto, garanta permissão para enviar links e embeds.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bot Configuration Form */}
            <form onSubmit={handleSaveBotConfig} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Bot Token */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-heading">
                      Token do Bot Discord
                    </label>
                    <a
                      href="https://discord.com/developers/applications"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span>Obter no Discord Developer Portal</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder={botStatus.config?.hasToken ? '•••••••••••••••••••••••• (Token já salvo no servidor)' : 'Cole o Bot Token aqui (ex: MTI...)'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Client ID */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 font-heading">
                    ID da Aplicação (Client ID)
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="123456789012345678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Guild ID */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 font-heading">
                    ID do Servidor (Guild ID)
                  </label>
                  <input
                    type="text"
                    value={guildId}
                    onChange={(e) => setGuildId(e.target.value)}
                    placeholder="123456789012345678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Default Text Channel ID */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 font-heading">
                    ID do Canal de Texto do Mix
                  </label>
                  <input
                    type="text"
                    value={defaultChannelId}
                    onChange={(e) => setDefaultChannelId(e.target.value)}
                    placeholder="Ex: #chat-mix (ID do canal)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* CS2 Server IP Connect */}
                <div>
                  <label className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1 font-heading">
                    IP do Servidor CS2 (Connect)
                  </label>
                  <input
                    type="text"
                    value={serverConnect}
                    onChange={(e) => setServerConnect(e.target.value)}
                    placeholder="Ex: 189.1.168.20:27015; password mix"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-300 placeholder-slate-600 outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Bot Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check size={14} />
                  <span>Salvar Configurações</span>
                </button>

                <button
                  type="button"
                  disabled={actionLoading || !botStatus.running || !defaultChannelId.trim()}
                  onClick={handleSendPanel}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                  title="Envia uma mensagem permanente no canal de texto com botão para abrir mix a qualquer hora"
                >
                  <Sparkles size={14} className="text-amber-400" />
                  <span>Publicar Painel no Canal</span>
                </button>
              </div>
            </form>

            {/* Slash Commands Cheatsheet */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 font-heading">
                <Terminal size={14} /> Comandos Disponíveis no Discord
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="font-mono font-bold text-white block">/mix criar</span>
                  <span className="text-slate-400 text-[10px]">Abre uma nova fila 5v5 com botões interativos</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="font-mono font-bold text-white block">/mix veto</span>
                  <span className="text-slate-400 text-[10px]">Inicia o Pick & Ban oficial da Valve com botões</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="font-mono font-bold text-white block">/mix sortear</span>
                  <span className="text-slate-400 text-[10px]">Equilibra os times pelo elo GC/FACEIT</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="font-mono font-bold text-white block">/mix roleta</span>
                  <span className="text-slate-400 text-[10px]">Sorteia um ou mais mapas com roleta CSPRNG</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="font-mono font-bold text-white block">/painel</span>
                  <span className="text-slate-400 text-[10px]">Cria um painel fixo com botão verde Criar Mix</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="font-mono font-bold text-white block">/ranking</span>
                  <span className="text-slate-400 text-[10px]">Exibe o Hall da Fama e os melhores jogadores</span>
                </div>
              </div>
            </div>

            {/* Quick Tutorial */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
              <span className="text-white font-bold block flex items-center gap-1.5">
                <HelpCircle size={13} className="text-indigo-400" /> Como configurar seu Bot no Discord Developer Portal:
              </span>
              <ol className="list-decimal list-inside space-y-1 text-slate-400 font-sans">
                <li>Acesse <strong>discord.com/developers/applications</strong> e crie uma <strong>New Application</strong>.</li>
                <li>Na aba <strong>Bot</strong>, clique em <strong>Reset Token</strong>, copie o Token gerado e cole acima.</li>
                <li>Abaixo em <strong>Privileged Gateway Intents</strong>, ative <strong>Message Content Intent</strong> e <strong>Server Members Intent</strong>.</li>
                <li>Na aba <strong>OAuth2 → URL Generator</strong>, marque <code>bot</code> e <code>applications.commands</code> com permissões de <code>Administrator</code> ou <code>Move Members / Send Messages</code>, e use o link gerado para convidar o bot ao seu servidor!</li>
              </ol>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: VOICE CHANNEL MOVER BOT                           */}
        {/* ======================================================== */}
        {activeTab === 'voicemover' && (
          <form onSubmit={handleSaveBotConfig} className="space-y-4 animate-fadeIn">
            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-indigo-500/30 space-y-2">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide flex items-center gap-1.5 font-heading">
                <Mic size={15} className="text-indigo-400" /> Movimentador Automático de Calls de Voz
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Quando o Pick & Ban terminar ou a partida começar, o bot moverá automaticamente os jogadores para as chamadas de voz do <strong>Time A (CT)</strong> e <strong>Time B (TR)</strong>. Ao fim do jogo, todos retornam para o <strong>Lobby Geral</strong>!
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  checked={autoMoveVoice}
                  onChange={(e) => setAutoMoveVoice(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <div>
                  <span className="font-bold text-white block">Ativar Movimentação Automática</span>
                  <span className="text-[11px] text-slate-400 block">
                    Mover membros conectados ao canal de voz de espera para seus respectivos times
                  </span>
                </div>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    ID Canal Lobby Geral
                  </label>
                  <input
                    type="text"
                    value={lobbyVoiceId}
                    onChange={(e) => setLobbyVoiceId(e.target.value)}
                    placeholder="Ex: 1042..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-1">
                    ID Canal Call Time A
                  </label>
                  <input
                    type="text"
                    value={teamAVoiceId}
                    onChange={(e) => setTeamAVoiceId(e.target.value)}
                    placeholder="Ex: 1043..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-sky-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                    ID Canal Call Time B
                  </label>
                  <input
                    type="text"
                    value={teamBVoiceId}
                    onChange={(e) => setTeamBVoiceId(e.target.value)}
                    placeholder="Ex: 1044..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <button
                type="button"
                disabled={testingVoice || !token.trim() || !guildId.trim() || !lobbyVoiceId.trim()}
                onClick={handleTestVoiceMover}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Zap size={13} className={testingVoice ? 'animate-spin' : ''} />
                <span>{testingVoice ? 'Validando...' : 'Testar Permissão de Mover'}</span>
              </button>

              <button
                type="submit"
                disabled={actionLoading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                Salvar Canais de Voz
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <span className="text-white font-bold block">Como pegar os IDs dos canais de voz:</span>
              <p className="text-slate-400 leading-normal">
                No Discord, vá em <strong>Configurações de Usuário → Avançado → Modo Desenvolvedor (ativar)</strong>. Em seguida, clique com o botão direito sobre o canal de voz e selecione <strong>Copiar ID do canal</strong>.
              </p>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* TAB 3: WEBHOOKS & GSI NOTIFICATIONS                      */}
        {/* ======================================================== */}
        {activeTab === 'webhook' && (
          <form onSubmit={handleSaveWebhookForm} className="space-y-4 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-heading">
                URL do Webhook do Discord (Canal de Notificações)
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
                <Zap size={14} /> Disparos Automáticos no Chat
              </h4>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={optLobby}
                  onChange={(e) => setOptLobby(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Avisar no canal quando a sala atingir <strong>10/10 jogadores</strong></span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={optVeto}
                  onChange={(e) => setOptVeto(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Avisar no canal quando o <strong>Pick & Ban terminar</strong> com mapa, times e connect</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={optStats}
                  onChange={(e) => setOptStats(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Enviar <strong>Estatísticas dos Competidores</strong> (Scoreboard, K/D, MVPs e Top Fragger)</span>
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
                        Envia o placar no Discord a cada round finalizado, quem venceu (CT ou TR) e virada de metade.
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
                        Avisa instantaneamente no canal quando a bomba for plantada ou desarmada.
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
                disabled={testingWebhook || !url.trim()}
                onClick={handleTestWebhook}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Send size={13} className={testingWebhook ? 'animate-pulse' : ''} />
                <span>{testingWebhook ? 'Enviando...' : 'Enviar Teste'}</span>
              </button>

              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition-all cursor-pointer active:scale-95"
              >
                Salvar Configurações de Webhook
              </button>
            </div>

            {/* Tutorial */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <strong className="text-white block font-sans">Como criar um Webhook no Discord:</strong>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-400 font-sans">
                <li>Clique com botão direito no canal onde quer receber os avisos.</li>
                <li>Selecione <strong>Editar Canal → Integrações → Webhooks</strong>.</li>
                <li>Clique em <strong>Novo Webhook</strong>, copie a URL e cole acima.</li>
              </ol>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
