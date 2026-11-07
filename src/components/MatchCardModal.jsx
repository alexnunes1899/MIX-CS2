import React, { useRef, useEffect, useState } from 'react';
import { X, Download, Copy, Check, Share2, Sparkles, Trophy, Shield, Flame } from 'lucide-react';
import { CS2_MAPS } from '../data/maps';
import { getTeamNames } from '../utils/teamNames';
import { playClickSound } from '../utils/audio';

export default function MatchCardModal({
  isOpen,
  onClose,
  room,
  soundEnabled,
}) {
  const canvasRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  if (!isOpen || !room) return null;

  const { finalMap, teamA = [], teamB = [], metrics, startingSideTeamB, name: roomName = 'MIX', serverIp = '', rankingSystem = 'gc' } = room;
  const { labelA, labelB, upperA, upperB } = getTeamNames(room);
  const fullMap = CS2_MAPS.find((m) => m.id === finalMap?.id) || finalMap || { name: 'Mirage', file: 'de_mirage' };

  const sideTeamB = startingSideTeamB || 'CT';
  const sideTeamA = sideTeamB === 'CT' ? 'TR' : 'CT';
  const isFaceit = rankingSystem === 'faceit';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1200;
    const height = 630;
    canvas.width = width;
    canvas.height = height;

    // Draw background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0a0d17');
    bgGrad.addColorStop(0.5, '#0e1424');
    bgGrad.addColorStop(1, '#070a12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Radial glow in center
    const radial = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, 500);
    radial.addColorStop(0, 'rgba(245, 158, 11, 0.12)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    // Decorative geometric accents
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 100);
    ctx.lineTo(width - 50, 100);
    ctx.moveTo(50, height - 70);
    ctx.lineTo(width - 50, height - 70);
    ctx.stroke();

    // Top Header
    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 14px "Chakra Petch", sans-serif, system-ui';
    ctx.letterSpacing = '3px';
    ctx.fillText('⚡ CS2 MIX HUB • PARTIDA OFICIAL', 60, 55);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText(`SALA: ${roomName.toUpperCase()}`, width - 260, 55);

    // Map Title & Format
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px "Chakra Petch", sans-serif, system-ui';
    ctx.letterSpacing = '1px';
    const mapTitle = (fullMap.name || 'MIRAGE').toUpperCase();
    ctx.fillText(mapTitle, 60, 92);

    ctx.fillStyle = '#f59e0b';
    ctx.font = '700 14px monospace';
    ctx.fillText(`(${fullMap.file || 'de_mirage'})`, 60 + ctx.measureText(mapTitle).width + 12, 90);

    const formatText = `FORMATO: ${room.matchFormat || 'MD1'}`;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 13px monospace';
    ctx.fillText(formatText, width - 260, 90);

    // Left Team (Team A) Card
    drawTeamBox(ctx, {
      x: 60,
      y: 125,
      w: 480,
      h: 415,
      teamName: upperA,
      side: sideTeamA,
      players: teamA,
      metricsAvg: metrics?.avgA,
      isLeft: true,
      isFaceit,
    });

    // Right Team (Team B) Card
    drawTeamBox(ctx, {
      x: width - 540,
      y: 125,
      w: 480,
      h: 415,
      teamName: upperB,
      side: sideTeamB,
      players: teamB,
      metricsAvg: metrics?.avgB,
      isLeft: false,
      isFaceit,
    });

    // VS Center Badge
    drawVsBadge(ctx, width / 2, 330);

    // Footer Info
    ctx.fillStyle = '#64748b';
    ctx.font = '600 12px sans-serif';
    const footerText = serverIp 
      ? `Servidor: ${serverIp} • Organizado via CS2 Mix Hub`
      : 'Partida organizada com balanceamento automático de níveis via CS2 Mix Hub';
    ctx.fillText(footerText, 60, height - 35);

    ctx.fillStyle = '#f59e0b';
    ctx.font = '700 12px monospace';
    ctx.fillText('mix-cs2-production.up.railway.app', width - 290, height - 35);

  }, [room, fullMap, sideTeamA, sideTeamB, upperA, upperB, isFaceit, metrics, serverIp, roomName]);

  function drawTeamBox(ctx, { x, y, w, h, teamName, side, players, metricsAvg, isLeft, isFaceit }) {
    // Card background
    const isCT = side === 'CT';
    const borderColor = isCT ? 'rgba(56, 189, 248, 0.4)' : 'rgba(245, 158, 11, 0.4)';
    const headerBg = isCT ? 'rgba(14, 165, 233, 0.15)' : 'rgba(245, 158, 11, 0.15)';
    const sideColor = isCT ? '#38bdf8' : '#fbbf24';

    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.stroke();

    // Header strip
    ctx.fillStyle = headerBg;
    roundRect(ctx, x, y, w, 60, 16, true);
    ctx.fill();

    // Side Badge (CT / TR)
    ctx.fillStyle = isCT ? '#0284c7' : '#d97706';
    roundRect(ctx, x + 16, y + 14, 52, 32, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 14px "Chakra Petch", sans-serif';
    ctx.fillText(side, x + 30, y + 35);

    // Team Name
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 18px "Chakra Petch", sans-serif';
    ctx.fillText(teamName.slice(0, 18), x + 80, y + 36);

    // Average Level
    ctx.fillStyle = sideColor;
    ctx.font = '700 12px monospace';
    const avgText = `Média: Lvl ${metricsAvg ?? '-'}`;
    ctx.fillText(avgText, x + w - ctx.measureText(avgText).width - 20, y + 36);

    // Players list
    const playerSlots = players.slice(0, 5);
    const rowH = 65;
    const startY = y + 75;

    for (let i = 0; i < 5; i++) {
      const p = playerSlots[i];
      const py = startY + i * rowH;

      // Row separator
      if (i > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.moveTo(x + 16, py - 6);
        ctx.lineTo(x + w - 16, py - 6);
        ctx.stroke();
      }

      if (p) {
        // Index / Captain
        ctx.fillStyle = i === 0 ? '#f59e0b' : '#64748b';
        ctx.font = '800 13px sans-serif';
        ctx.fillText(i === 0 ? '★ 1.' : `  ${i + 1}.`, x + 18, py + 26);

        // Nickname
        ctx.fillStyle = '#f8fafc';
        ctx.font = '700 16px sans-serif';
        const displayNick = p.nick.length > 15 ? p.nick.slice(0, 14) + '…' : p.nick;
        ctx.fillText(displayNick, x + 60, py + 26);

        // Level Badge
        const lvl = isFaceit
          ? `FACEIT ${p.faceitLevel || 5}`
          : `GC ${p.level || 10}`;
        ctx.fillStyle = isCT ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)';
        roundRect(ctx, x + w - 110, py + 8, 90, 26, 6);
        ctx.fill();

        ctx.fillStyle = sideColor;
        ctx.font = '800 12px monospace';
        ctx.fillText(lvl, x + w - 100, py + 25);
      } else {
        // Empty slot
        ctx.fillStyle = '#334155';
        ctx.font = 'italic 14px sans-serif';
        ctx.fillText(`  ${i + 1}. [Vaga Disponível]`, x + 18, py + 26);
      }
    }

    ctx.restore();
  }

  function drawVsBadge(ctx, cx, cy) {
    ctx.save();
    // Glow behind VS
    const rad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 70);
    rad.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
    rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(cx - 70, cy - 70, 140, 140);

    // VS Circle
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 24px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', cx, cy - 2);

    ctx.restore();
  }

  function roundRect(ctx, x, y, width, height, radius, topOnly = false) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    if (topOnly) {
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x, y + height);
    } else {
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    }
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  const handleDownload = () => {
    if (soundEnabled) playClickSound();
    const canvas = canvasRef.current;
    if (!canvas) return;

    setDownloading(true);
    try {
      const link = document.createElement('a');
      link.download = `cs2-mix-${(roomName || 'partida').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Download error:', e);
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  const handleCopyImage = async () => {
    if (soundEnabled) playClickSound();
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch (err) {
          console.warn('Clipboard write image failed, falling back:', err);
          setCopyError(true);
          setTimeout(() => setCopyError(false), 3000);
        }
      });
    } catch (e) {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 3000);
    }
  };

  const handleWhatsAppShare = () => {
    if (soundEnabled) playClickSound();
    const text = `🏆 *PARTIDA DE CS2 DEFINIDA!* 🏆\n\n🗺️ *Mapa:* ${fullMap?.name || 'Mirage'} (${room.matchFormat || 'MD1'})\n🔵 *${upperA}* (${sideTeamA})\n🟠 *${upperB}* (${sideTeamB})\n\n${serverIp ? `⚡ *Connect:* \`${serverIp}\`\n\n` : ''}Acompanhe o mix no CS2 Mix Hub!`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading text-white">Card Visual da Partida (1200x630)</h2>
            <p className="text-xs text-slate-400">Pronto para postar no WhatsApp, Discord ou redes sociais</p>
          </div>
        </div>

        {/* Canvas Preview Container */}
        <div className="bg-slate-950 p-2 sm:p-3 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden shadow-inner">
          <canvas
            ref={canvasRef}
            className="w-full h-auto max-h-[48vh] rounded-xl object-contain shadow-2xl border border-white/5"
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/25 active:scale-95 disabled:opacity-50"
          >
            <Download size={15} />
            <span>{downloading ? 'Gerando...' : 'Baixar Card (PNG)'}</span>
          </button>

          <button
            onClick={handleCopyImage}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            title="Copia a imagem para colar direto no WhatsApp ou Discord com Ctrl+V"
          >
            {copied ? (
              <>
                <Check size={15} className="text-emerald-400" />
                <span className="text-emerald-300">Copiado p/ Colar!</span>
              </>
            ) : (
              <>
                <Copy size={15} />
                <span>Copiar Imagem (Ctrl+V)</span>
              </>
            )}
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="py-3 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Share2 size={15} />
            <span>Enviar no WhatsApp</span>
          </button>
        </div>

        {copyError && (
          <p className="text-[11px] text-amber-400 text-center">
            💡 Dica: Se o navegador bloquear a cópia direta de imagem, use o botão <strong>"Baixar Card (PNG)"</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
