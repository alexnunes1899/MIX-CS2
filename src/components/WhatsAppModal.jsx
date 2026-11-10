import React, { useState, useEffect } from 'react';
import {
  X,
  MessageCircle,
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Users,
  ExternalLink,
  ShieldCheck,
  Copy,
  Check,
  Power,
  Bell,
  Sparkles,
  Info,
  Search,
  Link2,
  CheckCheck,
} from 'lucide-react';
import { playClickSound } from '../utils/audio';
import { copyText } from '../utils/clipboard';

export default function WhatsAppModal({ isOpen, onClose, soundEnabled = true }) {
  const [statusData, setStatusData] = useState({
    status: 'disconnected', // 'disconnected' | 'connecting' | 'qrcode' | 'connected'
    qrCode: null,
    pairingCode: null,
    user: null,
    config: {
      enabled: true,
      targetGroupId: '',
      targetGroupName: '',
      notifyOnCreate: true,
      notifyOnMissingSlots: true,
      notifyOnReady: true,
      notifyOnResult: true,
      prefix: '!mix',
      autoReconnect: true,
    },
    groupsCount: 0,
  });

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingCodeDisplay, setPairingCodeDisplay] = useState(null);
  const [activeTab, setActiveTab] = useState('qr'); // 'qr' | 'pairing' | 'commands' | 'config'
  const [copiedCommand, setCopiedCommand] = useState(null);

  // Group selection & configuration state
  const [groupSearch, setGroupSearch] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [resolvingManual, setResolvingManual] = useState(false);
  const [manualError, setManualError] = useState(null);
  const [groupSuccess, setGroupSuccess] = useState(false);
  const [refreshingGroups, setRefreshingGroups] = useState(false);

  // Poll status while modal is open
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
        if (data.config && data.config.targetGroupId !== undefined) {
          setSelectedGroupId(data.config.targetGroupId || '');
        }
      }
    } catch (_) {}
  };

  const fetchGroups = async () => {
    setRefreshingGroups(true);
    try {
      const res = await fetch('/api/whatsapp/groups');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : data?.groups && Array.isArray(data.groups)
          ? data.groups
          : [];
        setGroups(list);
      }
    } catch (_) {
    } finally {
      setRefreshingGroups(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchStatus();
    fetchGroups();
    const interval = setInterval(fetchStatus, 3500);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchGroups();
    }
  }, [isOpen, activeTab, statusData.status]);

  if (!isOpen) return null;

  const handleStartConnect = async () => {
    if (soundEnabled) playClickSound();
    setConnecting(true);
    try {
      await fetch('/api/whatsapp/connect', { method: 'POST' });
      await fetchStatus();
      await fetchGroups();
    } catch (_) {}
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    if (soundEnabled) playClickSound();
    setLoading(true);
    try {
      await fetch('/api/whatsapp/logout', { method: 'POST' });
      await fetchStatus();
    } catch (_) {}
    setLoading(false);
  };

  const handleRequestPairingCode = async () => {
    if (!phoneNumber.trim()) return;
    if (soundEnabled) playClickSound();
    setPairingLoading(true);
    try {
      const res = await fetch('/api/whatsapp/pair-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      const data = await res.json();
      if (data.code) {
        setPairingCodeDisplay(data.code);
      }
    } catch (_) {}
    setPairingLoading(false);
  };

  const handleSaveGroup = async (groupId, customName = null) => {
    if (!groupId) return;
    if (soundEnabled) playClickSound();
    const group = groups.find((g) => g.id === groupId);
    const groupName = customName || group?.subject || groupId;
    try {
      await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetGroupId: groupId,
          targetGroupName: groupName,
        }),
      });
      setSelectedGroupId(groupId);
      setGroupSuccess(true);
      setTimeout(() => setGroupSuccess(false), 3500);
      await fetchStatus();
    } catch (_) {}
  };

  const handleUnlinkGroup = async () => {
    if (soundEnabled) playClickSound();
    try {
      await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetGroupId: '',
          targetGroupName: '',
        }),
      });
      setSelectedGroupId('');
      setGroupSuccess(true);
      setTimeout(() => setGroupSuccess(false), 3000);
      await fetchStatus();
    } catch (_) {}
  };

  const handleManualGroupSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!manualInput.trim()) return;
    if (soundEnabled) playClickSound();
    setResolvingManual(true);
    setManualError(null);
    try {
      const res = await fetch('/api/whatsapp/resolve-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: manualInput.trim() }),
      });
      const data = await res.json();
      if (data.success && data.group?.id) {
        await handleSaveGroup(data.group.id, data.group.subject);
        setManualInput('');
        await fetchGroups();
      } else {
        // Fallback: save direct input as groupId
        await handleSaveGroup(manualInput.trim(), 'Grupo WhatsApp');
        setManualInput('');
      }
    } catch (err) {
      await handleSaveGroup(manualInput.trim(), 'Grupo WhatsApp');
      setManualInput('');
    } finally {
      setResolvingManual(false);
    }
  };

  const handleToggleNotify = async (key) => {
    if (soundEnabled) playClickSound();
    const currentVal = statusData.config ? statusData.config[key] : true;
    try {
      await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [key]: !currentVal,
        }),
      });
      await fetchStatus();
    } catch (_) {}
  };

  const handleSendTestMessage = async () => {
    if (soundEnabled) playClickSound();
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '🎮 *CS2 Mix Hub • Teste Oficial*\n\nConexão com o WhatsApp funcionando 100%! O bot está pronto para enviar avisos de mix e comandos no grupo.',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ type: 'success', text: 'Mensagem de teste enviada com sucesso no grupo!' });
      } else {
        setTestResult({ type: 'error', text: data.error || 'Erro ao enviar mensagem de teste.' });
      }
    } catch (e) {
      setTestResult({ type: 'error', text: 'Falha na comunicação com o servidor.' });
    }
    setTestSending(false);
    setTimeout(() => setTestResult(null), 5000);
  };

  const copyCmd = (cmd) => {
    if (soundEnabled) playClickSound();
    copyText(cmd);
    setCopiedCommand(cmd);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const isConnected = statusData.status === 'connected';
  const isQr = statusData.status === 'qrcode';
  const isConnecting = statusData.status === 'connecting' || connecting;

  const commandsList = [
    {
      cmd: '!mix',
      desc: 'Cria uma nova fila 5v5 no grupo ou exibe o lobby e jogadores da partida ativa.',
      badge: 'Criar / Lobby',
    },
    {
      cmd: '!entrar',
      desc: 'Entra diretamente na fila do mix ativo via chat do WhatsApp.',
      badge: 'Fila 5v5',
    },
    {
      cmd: '!sair',
      desc: 'Remove sua vaga da fila do mix ativo.',
      badge: 'Liberar Vaga',
    },
    {
      cmd: '!sortear',
      desc: 'Sorteia os times A (CT) e B (TR) pelo Snake-Draft GC com capitães automáticos.',
      badge: 'Snake Draft',
    },
    {
      cmd: '!ip',
      desc: 'Envia o IP do servidor CS2 com link de 1 clique via Steam Connect.',
      badge: 'Steam 1-Click',
    },
    {
      cmd: '!lvl 15',
      desc: 'Salva seu nível GC (1 a 21) de forma permanente para todos os mixes.',
      badge: 'Perfil GC',
    },
    {
      cmd: '!cancelar',
      desc: 'Cancela o mix ativo para liberar o grupo para uma nova partida.',
      badge: 'Resetar',
    },
    {
      cmd: '!ajuda',
      desc: 'Exibe o guia completo de comandos oficiais do bot no grupo.',
      badge: 'Ajuda',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#0a101d] border border-emerald-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 custom-scrollbar text-slate-100">
        {/* Glow Highlights */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            if (soundEnabled) playClickSound();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Fechar (Esc)"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
            <MessageCircle size={26} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1 font-mono">
              <Sparkles size={11} /> Baileys Multi-Device Bot
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-heading text-white tracking-wide">
              Integração WhatsApp para Grupos
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Notificações de mix, IP do servidor, lista de 10 jogadores e comandos de nível GC direto no grupo do seu time.
            </p>
          </div>
        </div>

        {/* Live Status Pill Card */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            isConnected
              ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-950/40'
              : isQr
              ? 'bg-amber-950/30 border-amber-500/50'
              : isConnecting
              ? 'bg-sky-950/30 border-sky-500/50'
              : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                {isConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
                  </>
                ) : isQr ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500" />
                  </>
                ) : isConnecting ? (
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-sky-400 animate-pulse" />
                ) : (
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-slate-500" />
                )}
              </span>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black font-heading uppercase tracking-wider text-white">
                    {isConnected
                      ? 'Conectado ao WhatsApp'
                      : isQr
                      ? 'Aguardando Escaneamento (QR Code)'
                      : isConnecting
                      ? 'Conectando...'
                      : 'Desconectado'}
                  </span>
                  {isConnected && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                      Online 24/7
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  {isConnected
                    ? `Número: ${statusData.user?.phone || 'Conectado'} • ${statusData.user?.name || 'Bot'}`
                    : isQr
                    ? 'Aponte a câmera do seu WhatsApp para o QR Code abaixo'
                    : isConnecting
                    ? 'Estabelecendo handshake criptografado...'
                    : 'Clique no botão abaixo para gerar o QR Code de pareamento'}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {isConnected ? (
                <>
                  <button
                    type="button"
                    onClick={handleSendTestMessage}
                    disabled={testSending}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    title="Enviar mensagem de teste no grupo configurado"
                  >
                    {testSending ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                    <span>{testSending ? 'Enviando...' : 'Testar Mensagem'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={loading}
                    className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                    title="Desconectar conta do WhatsApp"
                  >
                    <Power size={15} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleStartConnect}
                  disabled={isConnecting}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {isConnecting ? <RefreshCw size={13} className="animate-spin" /> : <Smartphone size={13} />}
                  <span>{isConnecting ? 'Conectando...' : 'Conectar Bot'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Test message alert feedback */}
          {testResult && (
            <div
              className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 border animate-fadeIn ${
                testResult.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-500 text-rose-200'
              }`}
            >
              {testResult.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{testResult.text}</span>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => {
              if (soundEnabled) playClickSound();
              setActiveTab('qr');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'qr'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <QrCode size={14} />
            <span>Conexão QR Code</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (soundEnabled) playClickSound();
              setActiveTab('commands');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'commands'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles size={14} />
            <span>Comandos no Grupo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (soundEnabled) playClickSound();
              setActiveTab('config');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Bell size={14} />
            <span>Grupo & Notificações</span>
          </button>
        </div>

        {/* TAB 1: QR CODE / PAIRING */}
        {activeTab === 'qr' && (
          <div className="space-y-4">
            {isConnected ? (
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-emerald-500/30 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-lg font-bold font-heading text-white">Bot Conectado e Operacional!</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  O bot está ativo e conectado à sua conta do WhatsApp. Ele monitora mensagens no grupo configurado e envia atualizações automáticas de mix.
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('commands')}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Ver Comandos Disponíveis
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('config')}
                    className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Escolher Grupo do Mix
                  </button>
                </div>
              </div>
            ) : isQr && statusData.qrCode ? (
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/40 flex flex-col items-center text-center space-y-4">
                <div className="bg-white p-3 rounded-2xl shadow-2xl border-4 border-emerald-500/50">
                  <img
                    src={statusData.qrCode}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
                  />
                </div>

                <div className="max-w-md space-y-1.5">
                  <h4 className="text-sm font-bold text-white font-heading">Como Conectar:</h4>
                  <ol className="text-xs text-slate-300 space-y-1 text-left list-decimal list-inside font-sans">
                    <li>Abra o <strong>WhatsApp</strong> no celular</li>
                    <li>Toque em <strong>Configurações</strong> ou <strong>Menu (⋮)</strong></li>
                    <li>Selecione <strong>Aparelhos conectados</strong> e depois <strong>Conectar um aparelho</strong></li>
                    <li>Aponte a câmera para o QR Code acima</li>
                  </ol>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <RefreshCw size={12} className="animate-spin text-emerald-400" />
                  <span>O QR Code atualiza automaticamente para manter a segurança.</span>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto border border-slate-700">
                  <Smartphone size={32} />
                </div>
                <div>
                  <h3 className="text-base font-bold font-heading text-white">Pronto para Conectar</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Inicie a sessão para gerar o QR Code de pareamento do WhatsApp Web.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartConnect}
                  disabled={isConnecting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 cursor-pointer inline-flex items-center gap-2"
                >
                  {isConnecting ? <RefreshCw size={14} className="animate-spin" /> : <QrCode size={14} />}
                  <span>{isConnecting ? 'Iniciando Baileys...' : 'Gerar QR Code de Conexão'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COMANDOS NO GRUPO */}
        {activeTab === 'commands' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
              <Info size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Estes comandos podem ser digitados por qualquer membro no grupo do WhatsApp configurado. O bot responde imediatamente no próprio grupo!
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {commandsList.map((c) => {
                const isCopied = copiedCommand === c.cmd;
                return (
                  <div
                    key={c.cmd}
                    className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-emerald-500/40 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-emerald-300 font-black text-sm bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                          {c.cmd}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded-full">
                          {c.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{c.desc}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyCmd(c.cmd)}
                      className="mt-3 w-full py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{isCopied ? 'Comando Copiado!' : 'Copiar Comando'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: CONFIGURAÇÃO DE GRUPO E ALERTAS */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            {/* Feedback alert on save */}
            {groupSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span>Configuração de grupo salva com sucesso no sistema!</span>
              </div>
            )}

            {/* Currently Active Group Badge */}
            {statusData.config?.targetGroupId ? (
              <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md shadow-emerald-950/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCheck size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                        Grupo Oficial Vinculado
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-200">
                        Ativo
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {statusData.config.targetGroupName || statusData.config.targetGroupId}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-sm">
                      ID: {statusData.config.targetGroupId}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUnlinkGroup}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition cursor-pointer self-end sm:self-center"
                >
                  Trocar / Desvincular
                </button>
              </div>
            ) : null}

            {/* Group Selector */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Users size={14} className="text-emerald-400" />
                  <span>Escolher Grupo da Lista ({groups.length} disponíveis)</span>
                </label>
                <button
                  type="button"
                  onClick={fetchGroups}
                  disabled={refreshingGroups}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer font-bold transition disabled:opacity-50"
                >
                  <RefreshCw size={11} className={refreshingGroups ? 'animate-spin' : ''} />
                  <span>{refreshingGroups ? 'Buscando...' : 'Atualizar Lista'}</span>
                </button>
              </div>

              {groups.length > 4 && (
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder="Pesquisar grupo por nome..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {groups.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={selectedGroupId}
                    onChange={(e) => handleSaveGroup(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">Selecione o grupo onde o bot enviará as mensagens...</option>
                    {groups
                      .filter((g) => {
                        if (!groupSearch.trim()) return true;
                        const term = groupSearch.toLowerCase();
                        return (
                          (g.subject && g.subject.toLowerCase().includes(term)) ||
                          (g.id && g.id.toLowerCase().includes(term))
                        );
                      })
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.subject || g.id} ({g.size || 0} membros)
                        </option>
                      ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    O bot lista todos os grupos onde ele é membro no WhatsApp. Selecione o grupo desejado acima.
                  </p>
                </div>
              ) : (
                <div className="text-xs text-slate-400 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold">
                    <AlertCircle size={14} />
                    <span>Nenhum grupo detectado automaticamente ainda</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    1. Certifique-se de que o número do bot foi adicionado como membro no seu grupo do WhatsApp.<br />
                    2. Clique em <strong>"Atualizar Lista"</strong> acima, ou veja as opções de vinculação rápida abaixo!
                  </p>
                </div>
              )}

              {/* Manual Link or ID Input */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <Link2 size={13} className="text-teal-400" />
                  <span>Ou vincular por Link de Convite ou ID:</span>
                </div>
                <form onSubmit={handleManualGroupSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Ex: https://chat.whatsapp.com/... ou 1203630...@g.us"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={resolvingManual || !manualInput.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    {resolvingManual ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                    <span>Vincular</span>
                  </button>
                </form>
              </div>

              {/* Pro Tip Card */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/30 to-teal-950/30 border border-emerald-500/30 flex items-start gap-2.5">
                <Sparkles size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-emerald-300">Dica Prática:</strong> Você também pode abrir o grupo no WhatsApp pelo celular e enviar a mensagem <code className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 font-mono font-bold">!ativar</code>. O bot vinculará aquele grupo no mesmo instante!
                </div>
              </div>
            </div>

            {/* Notification Checkboxes */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Bell size={14} className="text-emerald-400" />
                <span>Alertas Automáticos no Grupo</span>
              </h4>

              <div className="space-y-2.5">
                {[
                  {
                    key: 'notifyOnCreate',
                    label: 'Avisar quando novo Mix for criado',
                    desc: 'Envia mensagem convocando os jogadores assim que a sala é aberta no site.',
                  },
                  {
                    key: 'notifyOnMissingSlots',
                    label: 'Alerta de vagas restantes (8/10 e 9/10)',
                    desc: 'Avisa no grupo quando faltar apenas 1 ou 2 jogadores para completar.',
                  },
                  {
                    key: 'notifyOnReady',
                    label: 'Partida Pronta (Times, Capitães, Mapa e IP)',
                    desc: 'Envia escalação completa com botão de conexão direta ao CS2.',
                  },
                  {
                    key: 'notifyOnResult',
                    label: 'Resultado Final da Partida & MVP',
                    desc: 'Publica o placar final e o destaque da partida automaticamente.',
                  },
                ].map((item) => {
                  const checked = statusData.config ? statusData.config[item.key] !== false : true;
                  return (
                    <label
                      key={item.key}
                      onClick={() => handleToggleNotify(item.key)}
                      className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">{item.label}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <a
            href="/whatsapp"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (soundEnabled) playClickSound();
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink size={13} />
            <span>Abrir Painel Avançado em Nova Aba</span>
          </a>

          <button
            type="button"
            onClick={() => {
              if (soundEnabled) playClickSound();
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}
