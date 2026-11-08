import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Download, Copy, Check, Share2, Sparkles, Loader2 } from 'lucide-react';
import { CS2_MAPS } from '../data/maps';
import { getTeamNames } from '../utils/teamNames';
import { playClickSound } from '../utils/audio';

const CARD_W = 1200;
const CARD_H = 630;

/** Loads an image with CORS so the canvas stays exportable. Resolves null on failure/timeout. */
function loadImage(src, timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      resolve(val);
    };
    const t = setTimeout(() => finish(null), timeoutMs);
    img.onload = () => {
      clearTimeout(t);
      finish(img);
    };
    img.onerror = () => {
      clearTimeout(t);
      finish(null);
    };
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r, topOnly = false) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  if (topOnly) {
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
  } else {
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  }
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(ctx, text, maxWidth) {
  const str = String(text ?? '');
  if (ctx.measureText(str).width <= maxWidth) return str;
  let s = str;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawTeamBox(ctx, { x, y, w, h, teamName, side, players, avg, isFaceit }) {
  const isCT = side === 'CT';
  const isKnife = side === 'KNIFE' || side === 'FACA';
  const sideColor = isKnife ? '#c084fc' : isCT ? '#38bdf8' : '#fbbf24';
  const border = isKnife ? 'rgba(192,132,252,0.45)' : isCT ? 'rgba(56,189,248,0.45)' : 'rgba(245,158,11,0.45)';
  const headerBg = isKnife ? 'rgba(168,85,247,0.16)' : isCT ? 'rgba(14,165,233,0.16)' : 'rgba(245,158,11,0.16)';
  const badgeBg = isKnife ? '#7e22ce' : isCT ? '#0284c7' : '#d97706';

  ctx.save();
  ctx.fillStyle = 'rgba(15,23,42,0.92)';
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();

  const headerH = 56;
  ctx.fillStyle = headerBg;
  roundRect(ctx, x, y, w, headerH, 16, true);
  ctx.fill();

  // Side badge
  const sideLabel = isKnife ? 'FACA' : side;
  ctx.font = '900 14px "Chakra Petch", system-ui, sans-serif';
  const badgeW = Math.max(52, ctx.measureText(sideLabel).width + 24);
  ctx.fillStyle = badgeBg;
  roundRect(ctx, x + 16, y + 12, badgeW, 32, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sideLabel, x + 16 + badgeW / 2, y + 28);

  // Average (right)
  ctx.textAlign = 'right';
  ctx.fillStyle = sideColor;
  ctx.font = '700 13px "JetBrains Mono", ui-monospace, monospace';
  const avgText = `Média: Lvl ${avg ?? '-'}`;
  ctx.fillText(avgText, x + w - 18, y + 28);
  const avgW = ctx.measureText(avgText).width;

  // Team name (between badge and average)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 19px "Chakra Petch", system-ui, sans-serif';
  const nameX = x + 16 + badgeW + 12;
  ctx.fillText(truncate(ctx, teamName, x + w - 18 - avgW - 14 - nameX), nameX, y + 29);

  // Players
  const rowsTop = y + headerH + 8;
  const rowH = (h - headerH - 14) / 5;
  for (let i = 0; i < 5; i++) {
    const p = players[i];
    const cy = rowsTop + i * rowH + rowH / 2;
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 16, rowsTop + i * rowH);
      ctx.lineTo(x + w - 16, rowsTop + i * rowH);
      ctx.stroke();
    }
    ctx.textBaseline = 'middle';
    if (p) {
      ctx.textAlign = 'left';
      ctx.fillStyle = i === 0 ? '#f59e0b' : '#64748b';
      ctx.font = '800 14px system-ui, sans-serif';
      ctx.fillText(i === 0 ? '★' : `${i + 1}.`, x + 22, cy);

      // Level pill
      const lvl = isFaceit ? `FACEIT ${p.faceitLevel || 5}` : `GC ${p.level || 10}`;
      ctx.font = '800 12px "JetBrains Mono", ui-monospace, monospace';
      const pillW = ctx.measureText(lvl).width + 20;
      const pillX = x + w - 18 - pillW;
      ctx.fillStyle = isKnife ? 'rgba(192,132,252,0.15)' : isCT ? 'rgba(56,189,248,0.15)' : 'rgba(245,158,11,0.15)';
      roundRect(ctx, pillX, cy - 13, pillW, 26, 6);
      ctx.fill();
      ctx.fillStyle = sideColor;
      ctx.textAlign = 'center';
      ctx.fillText(lvl, pillX + pillW / 2, cy + 1);

      // Nick
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.fillText(truncate(ctx, p.nick || 'Jogador', pillX - 12 - (x + 52)), x + 52, cy + 1);
    } else {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#334155';
      ctx.font = 'italic 15px system-ui, sans-serif';
      ctx.fillText(`${i + 1}.  Vaga disponível`, x + 22, cy);
    }
  }
  ctx.restore();
}

function drawVsBadge(ctx, cx, cy) {
  ctx.save();
  const rad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 70);
  rad.addColorStop(0, 'rgba(245,158,11,0.35)');
  rad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rad;
  ctx.fillRect(cx - 70, cy - 70, 140, 140);
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.font = '900 24px "Chakra Petch", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VS', cx, cy + 1);
  ctx.restore();
}

function drawSeriesStrip(ctx, { x, y, w, h, series, labelA, labelB }) {
  const n = series.length;
  const gap = 10;
  const cardW = (w - gap * (n - 1)) / n;
  series.forEach((item, idx) => {
    const cx = x + idx * (cardW + gap);
    const map = CS2_MAPS.find((m) => m.id === item.map?.id) || item.map || {};
    const isKnife = Boolean(item.knifeRound) || item.sideTimeA === 'KNIFE' || item.sideTimeA === 'FACA';
    const sA = isKnife ? 'FACA' : item.sideTimeA || 'CT';
    const sB = isKnife ? 'FACA' : item.sideTimeB || (sA === 'CT' ? 'TR' : 'CT');
    const isDecider = item.pickedBy === 'decider' || idx === n - 1;
    const pickTxt = isDecider
      ? 'DECIDER'
      : item.pickedBy === 'teamA'
      ? `PICK ${labelA}`
      : item.pickedBy === 'teamB'
      ? `PICK ${labelB}`
      : `MAPA ${idx + 1}`;

    ctx.save();
    ctx.fillStyle = idx === 0 ? 'rgba(245,158,11,0.12)' : 'rgba(15,23,42,0.92)';
    ctx.strokeStyle = idx === 0 ? 'rgba(245,158,11,0.7)' : 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, cx, y, cardW, h, 12);
    ctx.fill();
    ctx.stroke();

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f59e0b';
    ctx.font = '800 12px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText(`#${idx + 1}`, cx + 12, y + 22);
    ctx.fillStyle = isDecider ? '#fbbf24' : '#94a3b8';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(truncate(ctx, pickTxt.toUpperCase(), cardW - 50), cx + cardW - 12, y + 22);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 20px "Chakra Petch", system-ui, sans-serif';
    ctx.fillText(truncate(ctx, (map.name || 'Mapa').toUpperCase(), cardW - 24), cx + 12, y + 50);

    ctx.font = '700 12px "JetBrains Mono", ui-monospace, monospace';
    if (isKnife) {
      ctx.fillStyle = '#c084fc';
      ctx.fillText('Round Faca', cx + 12, y + h - 14);
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`A: ${sA}`, cx + 12, y + h - 14);
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'right';
      ctx.fillText(`B: ${sB}`, cx + cardW - 12, y + h - 14);
    }
    ctx.restore();
  });
}

export default function MatchCardModal({ isOpen, onClose, room, soundEnabled }) {
  // IMPORTANT: every hook is declared before any conditional return (Rules of Hooks).
  const canvasRef = useRef(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const safeRoom = room || {};
  const { labelA, labelB, upperA, upperB } = getTeamNames(safeRoom);
  const finalMap = safeRoom.finalMap;
  const fullMap = CS2_MAPS.find((m) => m.id === finalMap?.id) || finalMap || { name: 'Mirage', file: 'de_mirage' };
  const sideTeamB = safeRoom.startingSideTeamB || 'CT';
  const sideTeamA =
    safeRoom.startingSideTeamA ||
    (sideTeamB === 'KNIFE' || sideTeamB === 'FACA' ? 'KNIFE' : sideTeamB === 'CT' ? 'TR' : 'CT');
  const roomName = safeRoom.name || 'MIX';
  const serverIp = safeRoom.serverIp || '';
  const matchFormat = safeRoom.matchFormat || 'MD1';
  const series = Array.isArray(safeRoom.drawnSeries) ? safeRoom.drawnSeries : [];

  const drawCard = useCallback(
    async (withImage = true) => {
      const canvas = canvasRef.current;
      if (!canvas || !room) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = CARD_W;
      canvas.height = CARD_H;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

      try {
        if (document.fonts?.ready) await document.fonts.ready;
      } catch (e) {}

      const bgImg = withImage ? await loadImage(fullMap?.image) : null;

      // Background
      const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
      bg.addColorStop(0, '#0a0d17');
      bg.addColorStop(0.5, '#0e1424');
      bg.addColorStop(1, '#070a12');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CARD_W, CARD_H);

      if (bgImg) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        drawCover(ctx, bgImg, 0, 0, CARD_W, CARD_H);
        ctx.restore();
        const ov = ctx.createLinearGradient(0, 0, 0, CARD_H);
        ov.addColorStop(0, 'rgba(7,10,18,0.55)');
        ov.addColorStop(1, 'rgba(7,10,18,0.92)');
        ctx.fillStyle = ov;
        ctx.fillRect(0, 0, CARD_W, CARD_H);
      }

      const radial = ctx.createRadialGradient(CARD_W / 2, CARD_H / 2, 50, CARD_W / 2, CARD_H / 2, 520);
      radial.addColorStop(0, 'rgba(245,158,11,0.12)');
      radial.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, CARD_W, CARD_H);

      // Gold frame
      ctx.strokeStyle = 'rgba(245,158,11,0.55)';
      ctx.lineWidth = 3;
      roundRect(ctx, 6, 6, CARD_W - 12, CARD_H - 12, 22);
      ctx.stroke();

      // Header
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f59e0b';
      ctx.font = '900 14px "Chakra Petch", system-ui, sans-serif';
      ctx.fillText('CS2 MIX HUB  •  PARTIDA OFICIAL', 60, 52);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText(truncate(ctx, `SALA: ${roomName.toUpperCase()}`, 360), CARD_W - 60, 52);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 40px "Chakra Petch", system-ui, sans-serif';
      const mapTitle = (fullMap?.name || 'MIRAGE').toUpperCase();
      ctx.fillText(mapTitle, 60, 96);
      const titleW = ctx.measureText(mapTitle).width;
      ctx.fillStyle = '#f59e0b';
      ctx.font = '700 15px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillText(fullMap?.file || 'de_mirage', 60 + titleW + 14, 93);

      // Format pill
      const fmtTxt = `FORMATO ${matchFormat}`;
      ctx.font = '800 13px "JetBrains Mono", ui-monospace, monospace';
      const fmtW = ctx.measureText(fmtTxt).width + 24;
      ctx.fillStyle = 'rgba(245,158,11,0.15)';
      ctx.strokeStyle = 'rgba(245,158,11,0.6)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, CARD_W - 60 - fmtW, 72, fmtW, 30, 15);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fcd34d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmtTxt, CARD_W - 60 - fmtW / 2, 88);

      // Teams
      const hasSeries = series.length > 1;
      const boxY = 122;
      const boxH = hasSeries ? 318 : 418;
      const boxW = 480;
      const isFaceit = safeRoom.rankingSystem === 'faceit';
      drawTeamBox(ctx, {
        x: 60, y: boxY, w: boxW, h: boxH,
        teamName: upperA, side: sideTeamA,
        players: (safeRoom.teamA || []).slice(0, 5),
        avg: safeRoom.metrics?.avgA, isFaceit,
      });
      drawTeamBox(ctx, {
        x: CARD_W - 60 - boxW, y: boxY, w: boxW, h: boxH,
        teamName: upperB, side: sideTeamB,
        players: (safeRoom.teamB || []).slice(0, 5),
        avg: safeRoom.metrics?.avgB, isFaceit,
      });
      drawVsBadge(ctx, CARD_W / 2, boxY + boxH / 2);

      if (hasSeries) {
        drawSeriesStrip(ctx, { x: 60, y: boxY + boxH + 14, w: CARD_W - 120, h: 92, series, labelA, labelB });
      }

      // Footer
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = '600 13px system-ui, sans-serif';
      const footer = serverIp
        ? `connect ${serverIp.replace(/^connect\s+/i, '')}`
        : 'Times balanceados automaticamente via CS2 Mix Hub';
      ctx.fillText(truncate(ctx, footer, 640), 60, CARD_H - 30);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f59e0b';
      ctx.font = '700 13px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillText(typeof window !== 'undefined' ? window.location.host : 'cs2-mix-hub', CARD_W - 60, CARD_H - 30);

      // Verify the canvas is exportable (a cross-origin image without CORS would taint it)
      if (bgImg) {
        try {
          canvas.toDataURL('image/png').slice(0, 10);
        } catch (e) {
          await drawCard(false);
        }
      }
    },
    // Redraw whenever the room data changes
    [room]
  );

  useEffect(() => {
    if (!isOpen || !room) return;
    let cancelled = false;
    setRendering(true);
    setRenderError(null);
    // wait one frame so the <canvas> is mounted
    const raf = requestAnimationFrame(() => {
      drawCard(true)
        .catch((e) => {
          console.error('Erro ao gerar card:', e);
          if (!cancelled) setRenderError('Não foi possível gerar o card. Tente novamente.');
        })
        .finally(() => {
          if (!cancelled) setRendering(false);
        });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [isOpen, room, drawCard]);

  // Close on Esc
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !room) return null;

  const fileName = `cs2-mix-${(roomName || 'partida').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${Date.now()}.png`;

  const handleDownload = () => {
    if (soundEnabled) playClickSound();
    const canvas = canvasRef.current;
    if (!canvas || rendering) return;
    setDownloading(true);
    const trigger = (href, revoke) => {
      const link = document.createElement('a');
      link.download = fileName;
      link.href = href;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (revoke) setTimeout(() => URL.revokeObjectURL(href), 2000);
      setTimeout(() => setDownloading(false), 600);
    };
    try {
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (blob) trigger(URL.createObjectURL(blob), true);
          else trigger(canvas.toDataURL('image/png'), false);
        }, 'image/png');
      } else {
        trigger(canvas.toDataURL('image/png'), false);
      }
    } catch (e) {
      console.error('Download error:', e);
      setRenderError('O navegador bloqueou o download. Clique com o botão direito no card e escolha "Salvar imagem como".');
      setDownloading(false);
    }
  };

  const handleCopyImage = () => {
    if (soundEnabled) playClickSound();
    const canvas = canvasRef.current;
    if (!canvas || rendering) return;
    const fail = () => {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 4000);
    };
    if (typeof window.ClipboardItem === 'undefined' || !navigator.clipboard?.write) return fail();
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return fail();
        try {
          await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch (err) {
          console.warn('Clipboard image write failed:', err);
          fail();
        }
      }, 'image/png');
    } catch (e) {
      fail();
    }
  };

  const handleWhatsAppShare = () => {
    if (soundEnabled) playClickSound();
    const seriesTxt =
      series.length > 1
        ? `\n${series
            .map((s, i) => `   ${i + 1}. ${s.map?.name || 'Mapa'}${s.pickedBy === 'decider' || i === series.length - 1 ? ' (Decider)' : ''}`)
            .join('\n')}\n`
        : '';
    const text = `🏆 *PARTIDA DE CS2 DEFINIDA!* 🏆\n\n🗺️ *Mapa:* ${fullMap?.name || 'Mirage'} (${matchFormat})${seriesTxt}\n🔵 *${upperA}* (${sideTeamA})\n🟠 *${upperB}* (${sideTeamB})\n\n${serverIp ? `⚡ *Connect:* \`${serverIp}\`\n\n` : ''}Acompanhe o mix no CS2 Mix Hub!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 custom-scrollbar">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Fechar (Esc)"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading text-white">Card Visual da Partida (1200×630)</h2>
            <p className="text-xs text-slate-400">Pronto para postar no WhatsApp, Discord ou redes sociais</p>
          </div>
        </div>

        <div className="relative bg-slate-950 p-2 sm:p-3 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden shadow-inner">
          <canvas
            ref={canvasRef}
            width={CARD_W}
            height={CARD_H}
            className="w-full h-auto max-h-[52vh] rounded-xl object-contain shadow-2xl border border-white/5"
            style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
          />
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-amber-300 text-sm font-bold gap-2">
              <Loader2 size={18} className="animate-spin" /> Gerando card...
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading || rendering}
            className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/25 active:scale-95 disabled:opacity-50"
          >
            <Download size={15} />
            <span>{downloading ? 'Baixando...' : 'Baixar Card (PNG)'}</span>
          </button>

          <button
            onClick={handleCopyImage}
            disabled={rendering}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Copia a imagem para colar direto no WhatsApp ou Discord com Ctrl+V"
          >
            {copied ? (
              <>
                <Check size={15} className="text-emerald-400" />
                <span className="text-emerald-300">Copiado! Cole com Ctrl+V</span>
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
            💡 Seu navegador bloqueou a cópia direta de imagem. Use <strong>"Baixar Card (PNG)"</strong> e anexe o arquivo.
          </p>
        )}
        {renderError && <p className="text-[11px] text-rose-400 text-center">⚠️ {renderError}</p>}
      </div>
    </div>
  );
}
