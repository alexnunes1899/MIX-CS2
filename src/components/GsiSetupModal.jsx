import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check, Radio, Server, ShieldCheck, HelpCircle, FileCode, CheckCircle2, Flame, ArrowRight, Laptop } from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function GsiSetupModal({
  isOpen,
  onClose,
  roomId = 'MIX-PRO',
  liveMatch = null,
  soundEnabled,
}) {
  const [copied, setCopied] = useState(false);
  const [gsiStatus, setGsiStatus] = useState(liveMatch || null);
  const [activeTab, setActiveTab] = useState('firegames'); // 'firegames' | 'local'

  useEffect(() => {
    if (!isOpen) return;

    const checkStatus = () => {
      fetch(`/api/gsi/status/${encodeURIComponent(roomId)}`)
        .then((res) => res.json())
        .then((data) => setGsiStatus(data))
        .catch(() => {});
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const cfgUrl = `/api/gsi/cfg/${encodeURIComponent(roomId)}`;
  const cfgContent = `"CS2MixHub Integration"
{
    "uri" "${currentHost}/api/gsi/${roomId}"
    "timeout" "5.0"
    "buffer"  "0.1"
    "throttle" "0.5"
    "heartbeat" "15.0"
    "data"
    {
        "map"                   "1"
        "round"                 "1"
        "player_id"             "1"
        "allplayers_id"         "1"
        "player_state"          "1"
        "allplayers_state"      "1"
        "allplayers_match_stats" "1"
    }
    "auth"
    {
        "token" "${roomId}"
    }
}`;

  const handleCopy = () => {
    if (soundEnabled) playClickSound();
    navigator.clipboard.writeText(cfgContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              Placar automático, detecção de mapa e gravação de histórico sem intervenção humana.
            </p>
          </div>
        </div>

        {/* LIVE STATUS CARD */}
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
          ) : (
            <p className="text-xs text-slate-400 mt-1">
              O CS2 ainda não transmitiu dados para a sala <strong>{roomId}</strong>. Siga os 2 passos rápidos abaixo para ativar no seu servidor da FireGames ou no seu próprio jogo!
            </p>
          )}
        </div>

        {/* TAB SELECTOR: FIREGAMES VS LOCAL PC */}
        <div className="flex items-center gap-2 mb-4 p-1 bg-slate-950/80 border border-slate-800 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('firegames')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'firegames'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Server size={14} />
            <span>1. No Servidor FireGames (Recomendado)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'local'
                ? 'bg-sky-500 text-slate-950 font-black shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Laptop size={14} />
            <span>2. No CS2 do seu PC (Alternativa Rápida)</span>
          </button>
        </div>

        {/* FIREGAMES INSTRUCTIONS */}
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
          </div>
        )}

        {/* LOCAL PC INSTRUCTIONS */}
        {activeTab === 'local' && (
          <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Laptop size={16} className="text-sky-400" />
              Não tem acesso ao painel da FireGames agora? Use no seu próprio CS2:
            </h4>
            <p className="text-slate-400 leading-relaxed">
              Você ou qualquer jogador/espectador do mix pode colocar esse arquivo no próprio computador. O seu jogo enviará o placar ao vivo automaticamente para o site:
            </p>

            <ol className="list-decimal list-inside space-y-2 text-slate-300">
              <li>
                Baixe o arquivo <code className="text-sky-300 font-mono font-bold">gamestate_integration_cs2mixhub.cfg</code>.
              </li>
              <li>
                Abra a pasta do seu CS2 no Windows (geralmente em):
                <code className="block mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 font-mono text-sky-300 text-[11px] break-all">
                  C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\
                </code>
              </li>
              <li>
                Cole o arquivo dentro dessa pasta <span className="font-mono text-white">cfg</span>.
              </li>
              <li>
                Ao jogar o mix ou assistir no servidor, o placar será atualizado no site em tempo real sem delay!
              </li>
            </ol>
          </div>
        )}

        {/* ACTION BUTTONS: DOWNLOAD & COPY */}
        <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black font-heading uppercase tracking-wider text-xs shadow-lg shadow-emerald-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Download size={16} />
            <span>Baixar Arquivo .cfg Pronto</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold uppercase tracking-wider text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            <span>{copied ? 'Copiado!' : 'Copiar Conteúdo'}</span>
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
