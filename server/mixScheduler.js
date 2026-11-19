import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getDataFilePath } from './dataDir.js';
import { readJsonSafe, writeJsonAtomic } from './utils/atomicJson.js';
import { sanitizeInput } from './utils/security.js';
import { sqliteStore } from './storage/sqliteStore.js';

const DEFAULT_SCHEDULES_FILE = getDataFilePath('scheduledMixes.json');
const SQLITE_NS = 'scheduled_mixes';
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const EXPIRED_GRACE_MS = 2 * 60 * 60 * 1000;

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

/**
 * Parses PT-BR schedule strings such as "21:00", "21h30", "21h", "amanha 20:30", or "25/11 21:00"
 * using America/Sao_Paulo (UTC-03:00) consistently across local Windows and UTC cloud servers.
 */
export function parseScheduleTimePtBr(rawInput = '', referenceDate = new Date()) {
  const cleaned = String(rawInput || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!cleaned) {
    return { valid: false, error: 'Informe um horário válido (ex: `21:00`, `21h30` ou `amanha 20:00`).' };
  }

  const ref = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date();
  const hasTomorrow = /\bamanha\b/.test(cleaned);
  const dateMatch = cleaned.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  const timeMatch = cleaned.match(/\b(\d{1,2})\s*[:h]\s*(\d{2})?\b/);

  if (!timeMatch) {
    return { valid: false, error: 'Formato de horário inválido. Use `21:00`, `21h30` ou `25/11 21:00`.' };
  }

  const hours = parseInt(timeMatch[1], 10);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

  if (Number.isNaN(hours) || hours < 0 || hours > 23 || Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    return { valid: false, error: 'Horário fora do intervalo permitido (00:00 a 23:59).' };
  }

  const brtNow = new Date(ref.getTime() + BRT_OFFSET_MS);
  let targetYear = brtNow.getUTCFullYear();
  let targetMonth = brtNow.getUTCMonth(); // 0-indexed
  let targetDay = brtNow.getUTCDate();

  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    const hasExplicitYear = Boolean(dateMatch[3]);
    let year = hasExplicitYear ? parseInt(dateMatch[3], 10) : brtNow.getUTCFullYear();

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return { valid: false, error: 'Data inválida no calendário.' };
    }

    const validateDay = (y, mZero, d) => {
      const check = new Date(Date.UTC(y, mZero, d, 12, 0, 0, 0));
      return check.getUTCFullYear() === y && check.getUTCMonth() === mZero && check.getUTCDate() === d;
    };

    if (!validateDay(year, month - 1, day)) {
      return { valid: false, error: 'Data inválida no calendário.' };
    }

    let candidateMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - BRT_OFFSET_MS;
    if (candidateMs < ref.getTime() - 2 * 60 * 1000) {
      if (!hasExplicitYear) {
        year += 1;
        if (!validateDay(year, month - 1, day)) {
          return { valid: false, error: 'Data inválida no calendário.' };
        }
        candidateMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - BRT_OFFSET_MS;
      } else {
        return { valid: false, error: 'Esta data/horário já passou.' };
      }
    }

    targetYear = year;
    targetMonth = month - 1;
    targetDay = day;
  } else {
    let candidateMs = Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, 0, 0) - BRT_OFFSET_MS;
    if (hasTomorrow || candidateMs < ref.getTime() - 2 * 60 * 1000) {
      const nextDayUtc = new Date(Date.UTC(targetYear, targetMonth, targetDay + 1, hours, minutes, 0, 0));
      targetYear = nextDayUtc.getUTCFullYear();
      targetMonth = nextDayUtc.getUTCMonth();
      targetDay = nextDayUtc.getUTCDate();
    }
  }

  const timestamp = Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, 0, 0) - BRT_OFFSET_MS;
  if (!Number.isFinite(timestamp)) {
    return { valid: false, error: 'Data/horário inválido.' };
  }

  const brtTarget = new Date(timestamp + BRT_OFFSET_MS);
  const formattedDate = `${String(brtTarget.getUTCDate()).padStart(2, '0')}/${String(brtTarget.getUTCMonth() + 1).padStart(2, '0')}/${brtTarget.getUTCFullYear()}`;

  return {
    valid: true,
    timestamp,
    formattedDate,
    formattedTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  };
}

/**
 * Manages scheduled mixes with persistent RSVPs and automated 15-minute reminders.
 */
export function createMixScheduler({ filePath = DEFAULT_SCHEDULES_FILE, store } = {}) {
  const effectiveStore = store !== undefined ? store : (filePath === DEFAULT_SCHEDULES_FILE ? sqliteStore : null);
  let schedules = [];

  function load() {
    const parsed = readJsonSafe(filePath, null);
    if (Array.isArray(parsed)) {
      schedules = parsed.filter((s) => s && s.id && s.scheduledAt);
      return schedules;
    }
    if (effectiveStore) {
      const rows = effectiveStore.listNamespace(SQLITE_NS);
      if (rows.length > 0) {
        schedules = rows.map((r) => r.value).filter((s) => s && s.id && s.scheduledAt);
        return schedules;
      }
    }
    schedules = [];
    return schedules;
  }

  function save() {
    writeJsonAtomic(filePath, schedules);
    if (effectiveStore) {
      for (const s of schedules) {
        effectiveStore.setJson(SQLITE_NS, String(s.id), s);
      }
    }
  }

  load();

  function createSchedule({
    guildId = '',
    channelId = '',
    messageId = '',
    creatorId = '',
    creatorName = 'Organizador',
    title = 'Mix CS2 5v5 Agendado',
    scheduledAt,
    format = 'MD1',
  } = {}) {
    load();
    const ts = Number(scheduledAt);
    if (!Number.isFinite(ts) || ts <= 0) {
      throw new Error('Timestamp de agendamento inválido.');
    }

    const id = `SCHED-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const cleanCreatorId = String(creatorId || '').trim();
    const cleanCreatorName = sanitizeInput(String(creatorName || 'Organizador'), 40) || 'Organizador';

    const record = {
      id,
      guildId: String(guildId || ''),
      channelId: String(channelId || ''),
      messageId: String(messageId || ''),
      creatorId: cleanCreatorId,
      creatorName: cleanCreatorName,
      title: sanitizeInput(String(title || 'Mix CS2 5v5 Agendado'), 60) || 'Mix CS2 5v5 Agendado',
      format: ['MD1', 'MD3', 'MD5'].includes(String(format).toUpperCase()) ? String(format).toUpperCase() : 'MD1',
      scheduledAt: ts,
      createdAt: Date.now(),
      confirmed: cleanCreatorId ? [{ id: cleanCreatorId, name: cleanCreatorName }] : [],
      maybe: [],
      reminded: false,
      status: 'open',
    };

    schedules.push(record);
    save();
    return record;
  }

  function updateMessageId(scheduleId, messageId) {
    load();
    const s = schedules.find((item) => item.id === scheduleId);
    if (!s) return null;
    s.messageId = String(messageId || '');
    save();
    return s;
  }

  function rsvp(scheduleId, userId, username = 'Jogador', action = 'confirm') {
    load();
    const s = schedules.find((item) => item.id === scheduleId);
    if (!s) return null;

    const uid = String(userId || '').trim();
    const uname = sanitizeInput(String(username || 'Jogador'), 40) || 'Jogador';
    if (!uid) return s;

    s.confirmed = (Array.isArray(s.confirmed) ? s.confirmed : []).filter((u) => u.id !== uid);
    s.maybe = (Array.isArray(s.maybe) ? s.maybe : []).filter((u) => u.id !== uid);

    if (action === 'confirm') {
      s.confirmed.push({ id: uid, name: uname });
    } else if (action === 'maybe') {
      s.maybe.push({ id: uid, name: uname });
    }

    save();
    return s;
  }

  function getSchedule(scheduleId) {
    load();
    return schedules.find((item) => item.id === scheduleId) || null;
  }

  function listUpcomingSchedules(now = Date.now()) {
    load();
    return schedules
      .filter((s) => s.status !== 'cancelled' && s.scheduledAt + EXPIRED_GRACE_MS > now)
      .sort((a, b) => a.scheduledAt - b.scheduledAt);
  }

  function getDueReminders(now = Date.now()) {
    load();
    return schedules.filter((s) => {
      if (s.reminded || s.status === 'cancelled') return false;
      const diff = s.scheduledAt - now;
      return diff <= FIFTEEN_MINUTES_MS && diff >= -5 * 60 * 1000;
    });
  }

  function markReminded(scheduleId) {
    load();
    const s = schedules.find((item) => item.id === scheduleId);
    if (!s) return null;
    s.reminded = true;
    s.remindedAt = Date.now();
    save();
    return s;
  }

  function pruneExpired(now = Date.now()) {
    load();
    const kept = [];
    const removed = [];
    for (const s of schedules) {
      if (s.scheduledAt + EXPIRED_GRACE_MS <= now || s.status === 'cancelled') {
        removed.push(s);
      } else {
        kept.push(s);
      }
    }
    if (removed.length > 0) {
      schedules = kept;
      if (effectiveStore) {
        for (const r of removed) effectiveStore.deleteJson(SQLITE_NS, String(r.id));
      }
      save();
    }
    return removed.length;
  }

  function buildScheduleMessagePayload(schedule) {
    const confirmed = Array.isArray(schedule?.confirmed) ? schedule.confirmed : [];
    const maybe = Array.isArray(schedule?.maybe) ? schedule.maybe : [];
    const unixTs = Math.floor(Number(schedule?.scheduledAt || Date.now()) / 1000);
    const totalConfirmed = confirmed.length;
    const filledSlots = Math.min(10, totalConfirmed);
    const bar = '🟩'.repeat(filledSlots) + '⬛'.repeat(10 - filledSlots);

    const confirmedText =
      confirmed.length > 0
        ? confirmed.map((u, idx) => `**${idx + 1}.** <@${u.id}>`).join('\n')
        : '*Ninguém confirmou ainda — clique abaixo!*';

    const maybeText =
      maybe.length > 0 ? maybe.map((u) => `<@${u.id}>`).join(' • ') : '*Ninguém em dúvida*';

    const embed = new EmbedBuilder()
      .setAuthor({ name: `AGENDAMENTO OFICIAL • ${schedule.format || 'MD1'}` })
      .setTitle(`📅 ${String(schedule.title || 'Mix CS2 5v5').toUpperCase()}`)
      .setDescription(
        `⏰ **Horário Marcado:** <t:${unixTs}:F> (<t:${unixTs}:R>)\n` +
        `👥 **Confirmados (${totalConfirmed}/10):** \`${bar}\`\n\n` +
        `🔔 O bot envia um lembrete automático **15 minutos antes** marcando quem confirmou!`
      )
      .setColor(totalConfirmed >= 10 ? 0x10b981 : 0x38bdf8)
      .addFields(
        { name: `✅ Presença Confirmada (${confirmed.length})`, value: confirmedText, inline: true },
        { name: `🤔 Talvez (${maybe.length})`, value: maybeText, inline: true }
      )
      .setFooter({ text: `Agenda ID: ${schedule.id} • Organizado por ${schedule.creatorName || 'Capitão'}` })
      .setTimestamp(new Date(schedule.scheduledAt || Date.now()));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`sched_confirm:${schedule.id}`)
        .setLabel(`Confirmar (${confirmed.length}/10)`)
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`sched_maybe:${schedule.id}`)
        .setLabel(`Talvez (${maybe.length})`)
        .setEmoji('🤔')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`sched_leave:${schedule.id}`)
        .setLabel('Sair')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row] };
  }

  return {
    createSchedule,
    updateMessageId,
    rsvp,
    getSchedule,
    listUpcomingSchedules,
    getDueReminders,
    markReminded,
    pruneExpired,
    buildScheduleMessagePayload,
  };
}

export const mixScheduler = createMixScheduler();
