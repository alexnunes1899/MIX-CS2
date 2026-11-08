import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Copy, Check, Sparkles, Smartphone, Share2, Trophy } from 'lucide-react';
import { playClickSound } from '../utils/audio';
import { copyText } from '../utils/clipboard';

export default function PlayerStoryCardModal({
  isOpen,
  onClose,
  room,
  soundEnabled = true,
  initialPlayer = null,
}) {
  const canvasRef = useRef(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(initialPlayer?.id || null);
  const [generating, setGenerating] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [dataUrl, setDataUrl] = useState(null);

  const teamA = room?.teamA || [];
  const teamB = room?.teamB || [];
  const allPlayers = [...teamA, ...teamB];

  // Set default selected player if none
  useEffect(() => {
    if (initialPlayer?.id) {
      setSelectedPlayerId(initialPlayer.id);
    } else if (allPlayers.length > 0 && !selectedPlayerId) {
      setSelectedPlayerId(allPlayers[0].id);
    }
  }, [initialPlayer, allPlayers.length]);

  // Handle ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (soundEnabled) playClickSound();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, soundEnabled]);

  const selectedPlayer = allPlayers.find((p) => p.id === selectedPlayerId) || allPlayers[0] || { nick: 'Jogador', level: 15 };

  // Draw 1080x1920 Story Card
  const drawStoryCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setGenerating(true);

    const width = 1080;
    const height = 1920;
    canvas.width = width;
    canvas.height = height;

    // 1. Dark Cyber Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#060a12');
    bgGrad.addColorStop(0.3, '#0b1325');
    bgGrad.addColorStop(0.7, '#070c18');
    bgGrad.addColorStop(1, '#03050a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative geometric accents
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(35, 35, width - 70, height - 70);

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 4;
    // Corners
    ctx.beginPath();
    ctx.moveTo(35, 95); ctx.lineTo(35, 35); ctx.lineTo(95, 35);
    ctx.moveTo(width - 95, 35); ctx.lineTo(width - 35, 35); ctx.lineTo(width - 35, 95);
    ctx.moveTo(35, height - 95); ctx.lineTo(35, height - 35); ctx.lineTo(95, height - 35);
    ctx.moveTo(width - 95, height - 35); ctx.lineTo(width - 35, height - 35); ctx.lineTo(width - 35, height - 95);
    ctx.stroke();

    // 2. Top Header Branding
    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CS2 MIX HUB', width / 2, 140);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 24px sans-serif';
    ctx.fillText('COMPETITIVE MATCH REPORT • 9:16 STORY', width / 2, 185);

    // 3. Match Status Banner
    const finalMapName = room?.finalMap?.name || 'CS2 MAP';
    const liveMatch = room?.liveMatch;
    const scoreCT = liveMatch?.scoreCT ?? 13;
    const scoreTR = liveMatch?.scoreTR ?? 9;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(100, 240, width - 200, 150, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = '800 26px sans-serif';
    ctx.fillText(`🏆 MAPA: ${finalMapName.toUpperCase()}`, width / 2, 295);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px monospace';
    ctx.fillText(`${scoreCT}  :  ${scoreTR}`, width / 2, 355);

    // 4. Player Focus Section
    const avatarY = 560;
    // Glow behind avatar
    const glow = ctx.createRadialGradient(width / 2, avatarY, 30, width / 2, avatarY, 180);
    glow.addColorStop(0, 'rgba(245, 158, 11, 0.3)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(width / 2, avatarY, 180, 0, Math.PI * 2);
    ctx.fill();

    // Circular Avatar Base
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(width / 2, avatarY, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Nickname
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(selectedPlayer.nick || 'Jogador', width / 2, 760);

    // Rank & Hours Subtitle
    const isFaceit = room?.rankingSystem === 'faceit';
    const rankText = isFaceit
      ? `FACEIT NÍVEL ${selectedPlayer.faceitLevel || 5} • ${selectedPlayer.faceitElo || 1200} ELO`
      : `GAMERS CLUB NÍVEL ${selectedPlayer.level || 12}`;

    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 28px monospace';
    ctx.fillText(rankText, width / 2, 815);

    if (selectedPlayer.cs2Hours) {
      ctx.fillStyle = '#10b981';
      ctx.font = '700 24px sans-serif';
      ctx.fillText(`⏱️ ${selectedPlayer.cs2Hours.toLocaleString('pt-BR')} HORAS NO CS2`, width / 2, 855);
    }

    // 5. Match Statistics KPI Grid
    const statStats = liveMatch?.allPlayersStats?.find((p) => p.name === selectedPlayer.nick) || {
      kills: 22,
      deaths: 11,
      assists: 5,
      kd: '2.00',
      mvps: 4,
      score: 58,
    };

    const kpiBoxes = [
      { label: 'KILLS', val: statStats.kills, col: '#10b981' },
      { label: 'DEATHS', val: statStats.deaths, col: '#f43f5e' },
      { label: 'ASSISTS', val: statStats.assists, col: '#38bdf8' },
      { label: 'K/D RATIO', val: statStats.kd, col: '#fbbf24' },
      { label: 'MVPs', val: `${statStats.mvps}⭐`, col: '#eab308' },
      { label: 'PONTUAÇÃO', val: statStats.score, col: '#a855f7' },
    ];

    const startY = 930;
    const boxW = 260;
    const boxH = 150;
    const gapX = 35;
    const gapY = 30;

    kpiBoxes.forEach((kpi, idx) => {
      const colIdx = idx % 3;
      const rowIdx = Math.floor(idx / 3);
      const x = 115 + colIdx * (boxW + gapX);
      const y = startY + rowIdx * (boxH + gapY);

      // Card BG
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(x, y, boxW, boxH, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(kpi.label, x + boxW / 2, y + 45);

      // Value
      ctx.fillStyle = kpi.col;
      ctx.font = '900 44px monospace';
      ctx.fillText(String(kpi.val), x + boxW / 2, y + 110);
    });

    // 6. Highlight Badge Box
    const highlightY = 1350;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.beginPath();
    ctx.roundRect(100, highlightY, width - 200, 160, 24);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 36px sans-serif';
    ctx.fillText('👑 DESTAQUE DO CONFRONTO', width / 2, highlightY + 65);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 24px sans-serif';
    ctx.fillText('Desempenho de alto impacto registrado no Mix Hub.', width / 2, highlightY + 115);

    // 7. Footer Watermark
    ctx.fillStyle = '#64748b';
    ctx.font = '600 22px monospace';
    ctx.fillText('CS2 MIX HUB • instagram.com/cs2mixhub • cs2mixhub.gg', width / 2, 1780);

    ctx.fillStyle = '#475569';
    ctx.font = '500 18px sans-serif';
    ctx.fillText(new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), width / 2, 1820);

    setGenerating(false);
    try {
      setDataUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      console.warn('Erro ao gerar dataURL do story canvas:', e);
    }
  }, [room, selectedPlayer]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        drawStoryCard();
      }, 100);
    }
  }, [isOpen, selectedPlayerId, drawStoryCard]);

  const handleDownload = () => {
    if (soundEnabled) playClickSound();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `cs2_story_${selectedPlayer?.nick || 'card'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyImage = async () => {
    if (soundEnabled) playClickSound();
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (navigator?.clipboard?.write && window.ClipboardItem) {
      try {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          await navigator.clipboard.write([
            new window.ClipboardItem({ 'image/png': blob }),
          ]);
          setCopiedImage(true);
          setTimeout(() => setCopiedImage(false), 2500);
        });
        return;
      } catch (err) {
        console.warn('Falha ao copiar imagem diretamente para a área de transferência:', err);
      }
    }

    // Fallback: copy link text
    copyText(`CS2 Mix Hub Story Card de ${selectedPlayer?.nick || 'Jogador'}: ${window.location.href}`);
    setCopiedImage(true);
    setTimeout(() => setCopiedImage(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-amber-500 text-white flex items-center justify-center shadow-md">
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-heading text-white flex items-center gap-2">
                <span>Card para Stories (Instagram / WhatsApp 9:16)</span>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase">
                  1080x1920 HD
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Formato vertical perfeito para postar nos Stories do Instagram, Status do WhatsApp ou TikTok.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Player Selection Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
            Escolher Jogador:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {allPlayers.map((p) => {
              const isSelected = p.id === selectedPlayer.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    setSelectedPlayerId(p.id);
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 scale-105'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  {p.nick}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body: Preview & Actions */}
        <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar flex flex-col md:flex-row items-center justify-center gap-6">
          {/* Canvas container with scaled down aspect preview */}
          <div className="relative border-4 border-slate-800 rounded-3xl overflow-hidden shadow-2xl bg-black w-[270px] h-[480px] shrink-0">
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Action Details & Buttons */}
          <div className="space-y-4 max-w-md w-full">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block">
                Especificações do Story Card
              </span>
              <h3 className="font-heading font-black text-lg text-white">
                {selectedPlayer.nick} • {room?.finalMap?.name || 'CS2 Mix'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Card gerado em altíssima definição (1080x1920 px) pronto para ser compartilhado no Instagram Stories, WhatsApp Status, Twitter/X ou Discord.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleDownload}
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
              >
                <Download size={16} />
                <span>Baixar Story Card (1080x1920 PNG)</span>
              </button>

              <button
                onClick={handleCopyImage}
                className="w-full py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                {copiedImage ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                <span>{copiedImage ? 'Imagem Copiada para Área de Transferência!' : 'Copiar Imagem'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-400" />
            <span>Resolução oficial 9:16 sem bordas pretas nos smartphones.</span>
          </span>
          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
