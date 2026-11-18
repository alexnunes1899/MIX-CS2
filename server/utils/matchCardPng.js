import { deflateSync } from 'zlib';

// Precompute CRC32 table for valid PNG chunks
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePngRgba(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // None filter
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), rowStart + 1);
  }

  const compressed = deflateSync(raw, { level: 6 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// 5x7 crisp bitmap font (5-bit rows encoded left-to-right in low 5 bits, 7 rows per glyph)
const FONT_5X7 = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 0, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0],
  '-': [0, 0, 0, 31, 0, 0, 0],
  '+': [0, 4, 4, 31, 4, 4, 0],
  '/': [1, 2, 2, 4, 8, 8, 16],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '[': [14, 8, 8, 8, 8, 8, 14],
  ']': [14, 2, 2, 2, 2, 2, 14],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4],
  '%': [25, 25, 2, 4, 8, 19, 19],
  '|': [4, 4, 4, 4, 4, 4, 4],
  '_': [0, 0, 0, 0, 0, 0, 31],
  '*': [0, 21, 14, 31, 14, 21, 0],
  '#': [10, 31, 10, 10, 31, 10, 0],
};

function sanitizeBitmapText(raw = '', maxLen = 40) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[•·]/g, '-')
    .toUpperCase()
    .replace(/[^A-Z0-9 .,:+\-/()\[\]!?%|_*#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

class CanvasBuffer {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  blendPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || a <= 0) return;
    const idx = (y * this.width + x) * 4;
    if (a >= 255) {
      this.data[idx] = r;
      this.data[idx + 1] = g;
      this.data[idx + 2] = b;
      this.data[idx + 3] = 255;
      return;
    }
    const alpha = a / 255;
    const inv = 1 - alpha;
    this.data[idx] = Math.round(r * alpha + this.data[idx] * inv);
    this.data[idx + 1] = Math.round(g * alpha + this.data[idx + 1] * inv);
    this.data[idx + 2] = Math.round(b * alpha + this.data[idx + 2] * inv);
    this.data[idx + 3] = 255;
  }

  fillGradientV(cTop, cBottom) {
    for (let y = 0; y < this.height; y++) {
      const t = y / Math.max(1, this.height - 1);
      const r = Math.round(cTop[0] + (cBottom[0] - cTop[0]) * t);
      const g = Math.round(cTop[1] + (cBottom[1] - cTop[1]) * t);
      const b = Math.round(cTop[2] + (cBottom[2] - cTop[2]) * t);
      for (let x = 0; x < this.width; x++) {
        const idx = (y * this.width + x) * 4;
        this.data[idx] = r;
        this.data[idx + 1] = g;
        this.data[idx + 2] = b;
        this.data[idx + 3] = 255;
      }
    }
  }

  fillRect(x, y, w, h, color, alpha = 255) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.floor(x + w));
    const y1 = Math.min(this.height, Math.floor(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        this.blendPixel(px, py, color[0], color[1], color[2], alpha);
      }
    }
  }

  strokeRect(x, y, w, h, color, alpha = 255) {
    this.fillRect(x, y, w, 1, color, alpha);
    this.fillRect(x, y + h - 1, w, 1, color, alpha);
    this.fillRect(x, y, 1, h, color, alpha);
    this.fillRect(x + w - 1, y, 1, h, color, alpha);
  }

  measureTextWidth(text, scale = 2, spacing = 1) {
    if (!text) return 0;
    return text.length * (5 * scale + spacing * scale) - spacing * scale;
  }

  drawText(rawText, x, y, scale = 2, color = [248, 250, 252], { align = 'left', spacing = 1, maxLen = 40 } = {}) {
    const text = sanitizeBitmapText(rawText, maxLen);
    if (!text) return;
    const totalW = this.measureTextWidth(text, scale, spacing);
    let cursorX = Math.round(x);
    if (align === 'center') cursorX = Math.round(x - totalW / 2);
    else if (align === 'right') cursorX = Math.round(x - totalW);

    const step = (5 + spacing) * scale;
    for (let i = 0; i < text.length; i++) {
      const glyph = FONT_5X7[text[i]] || FONT_5X7[' '];
      for (let row = 0; row < 7; row++) {
        const bits = glyph[row];
        for (let col = 0; col < 5; col++) {
          if ((bits >> (4 - col)) & 1) {
            this.fillRect(cursorX + col * scale, y + row * scale, scale, scale, color, 255);
          }
        }
      }
      cursorX += step;
    }
  }
}

/**
 * Generates a pure-JS PNG match summary card (960x540) suitable for Discord attachments.
 * Requires zero native C++ dependencies.
 */
export function renderMatchSummaryPng(matchRecord = {}) {
  const W = 960;
  const H = 540;
  const img = new CanvasBuffer(W, H);

  // Background gradient (#090d16 -> #111a2e)
  img.fillGradientV([9, 13, 22], [17, 26, 46]);

  // Ambient esports glow accents
  img.fillRect(0, 0, W, 6, [245, 158, 11], 255); // Amber top stripe
  img.fillRect(36, 26, 888, 44, [15, 23, 42], 235);
  img.strokeRect(36, 26, 888, 44, [51, 65, 85], 200);

  const mapName = String(matchRecord.map || 'Mirage').toUpperCase();
  const formatLabel = String(matchRecord.format || 'MD1').toUpperCase();
  const dateLabel = String(matchRecord.dateFormatted || matchRecord.date || 'CS2 MIX HUB').trim();

  img.drawText('CS2 MIX HUB - RESULTADO OFICIAL', 54, 40, 2, [251, 191, 36], { maxLen: 36 });
  img.drawText(`${mapName} | ${formatLabel} | ${dateLabel}`, 906, 41, 2, [148, 163, 184], {
    align: 'right',
    maxLen: 42,
  });

  // Main scoreboard banner
  img.fillRect(36, 84, 888, 108, [12, 18, 34], 245);
  img.strokeRect(36, 84, 888, 108, [245, 158, 11], 140);

  const winnerName = String(matchRecord.winner || 'TIME A');
  const loserName = String(matchRecord.loser || 'TIME B');
  const scoreW = Number.isFinite(Number(matchRecord.scoreWinner)) ? Number(matchRecord.scoreWinner) : 13;
  const scoreL = Number.isFinite(Number(matchRecord.scoreLoser)) ? Number(matchRecord.scoreLoser) : 8;

  // Winner Side (Left)
  img.fillRect(46, 94, 300, 88, [16, 185, 129], 32);
  img.strokeRect(46, 94, 300, 88, [16, 185, 129], 130);
  img.drawText('CAMPEOES', 196, 106, 2, [52, 211, 153], { align: 'center', maxLen: 18 });
  img.drawText(winnerName, 196, 134, 3, [255, 255, 255], { align: 'center', maxLen: 14 });

  // Center Score
  img.fillRect(362, 96, 236, 24, [30, 41, 59], 220);
  img.drawText(`MAPA: ${mapName}`, 480, 101, 2, [251, 191, 36], { align: 'center', maxLen: 20 });
  img.drawText(`${scoreW}`, 420, 132, 6, [52, 211, 153], { align: 'center', maxLen: 4 });
  img.drawText('X', 480, 138, 4, [148, 163, 184], { align: 'center', maxLen: 2 });
  img.drawText(`${scoreL}`, 540, 132, 6, [251, 113, 133], { align: 'center', maxLen: 4 });

  // Loser Side (Right)
  img.fillRect(614, 94, 300, 88, [244, 63, 94], 26);
  img.strokeRect(614, 94, 300, 88, [244, 63, 94], 110);
  img.drawText('VICE-CAMPEOES', 764, 106, 2, [253, 164, 175], { align: 'center', maxLen: 18 });
  img.drawText(loserName, 764, 134, 3, [226, 232, 240], { align: 'center', maxLen: 14 });

  // Lookup evaluated GSI stats by player nick/id
  const evaluated = Array.isArray(matchRecord.evaluatedPlayers) ? matchRecord.evaluatedPlayers : [];
  const findEval = (p) =>
    evaluated.find(
      (e) =>
        e &&
        ((p.id && e.id && String(e.id) === String(p.id)) ||
          (p.nick && e.nick && String(e.nick).toLowerCase() === String(p.nick).toLowerCase()))
    ) || null;

  const drawRosterPanel = (panelX, title, accentColor, playersList = []) => {
    const panelW = 434;
    const panelY = 206;
    const panelH = 240;

    img.fillRect(panelX, panelY, panelW, panelH, [12, 18, 34], 240);
    img.strokeRect(panelX, panelY, panelW, panelH, [51, 65, 85], 200);
    img.fillRect(panelX, panelY, panelW, 34, accentColor, 48);
    img.drawText(title, panelX + 16, panelY + 10, 2, accentColor, { maxLen: 32 });

    const list = Array.isArray(playersList) ? playersList.slice(0, 5) : [];
    for (let i = 0; i < 5; i++) {
      const rowY = panelY + 44 + i * 38;
      img.fillRect(panelX + 12, rowY, panelW - 24, 32, [15, 23, 42], i % 2 === 0 ? 230 : 170);
      const p = list[i];
      if (!p) {
        img.drawText(`${i + 1}. - VAGA -`, panelX + 22, rowY + 9, 2, [71, 85, 105], { maxLen: 26 });
        continue;
      }
      const ev = findEval(p);
      const lvl = p.level || 16;
      const leftText = `${i + 1}. ${p.nick || p.username || 'JOGADOR'}`;
      const rightText = ev && ev.isRealGsi ? `${ev.kills}/${ev.deaths} (${ev.rating})` : `LVL ${lvl}`;
      img.drawText(leftText, panelX + 22, rowY + 9, 2, [248, 250, 252], { maxLen: 20 });
      img.drawText(rightText, panelX + panelW - 22, rowY + 9, 2, ev && ev.isRealGsi ? [251, 191, 36] : accentColor, {
        align: 'right',
        maxLen: 14,
      });
    }
  };

  drawRosterPanel(36, `VENCEDORES - ${winnerName}`, [52, 211, 153], matchRecord.winnerPlayers);
  drawRosterPanel(490, `ADVERSARIOS - ${loserName}`, [251, 113, 133], matchRecord.loserPlayers);

  // Bottom MVP & Bagre cards
  const mvpNick = matchRecord.mvpNick || matchRecord.mvp?.nick || '';
  const mvpStats = matchRecord.mvpStats || matchRecord.mvp || null;
  const bagreNick = matchRecord.bagreNick || matchRecord.bagre?.nick || '';
  const bagreStats = matchRecord.bagreStats || matchRecord.bagre || null;

  img.fillRect(36, 460, 434, 56, [245, 158, 11], 28);
  img.strokeRect(36, 460, 434, 56, [245, 158, 11], 170);
  if (mvpNick) {
    const kda = mvpStats && typeof mvpStats.kills === 'number' ? ` (${mvpStats.kills}K/${mvpStats.deaths}D - ${mvpStats.rating})` : '';
    img.drawText(`MVP DA PARTIDA: ${mvpNick}${kda}`, 52, 481, 2, [252, 211, 77], { maxLen: 34 });
  } else {
    img.drawText(`VITORIA REGISTRADA - BALANCEAMENTO ${matchRecord.balancePct || 92}%`, 52, 481, 2, [252, 211, 77], {
      maxLen: 34,
    });
  }

  img.fillRect(490, 460, 434, 56, [139, 92, 246], 28);
  img.strokeRect(490, 460, 434, 56, [139, 92, 246], 160);
  if (bagreNick) {
    const kda = bagreStats && typeof bagreStats.kills === 'number' ? ` (${bagreStats.kills}K/${bagreStats.deaths}D)` : '';
    img.drawText(`BAGRE DA PARTIDA: ${bagreNick}${kda}`, 506, 481, 2, [216, 180, 254], { maxLen: 34 });
  } else {
    img.drawText('MIX-CS2.ONRENDER.COM - CS2 MIX HUB', 506, 481, 2, [196, 181, 253], { maxLen: 34 });
  }

  return encodePngRgba(W, H, img.data);
}
