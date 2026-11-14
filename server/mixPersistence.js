import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'activeMixStore.json');

let saveTimeout = null;
let roomsStoreRef = null;
let discordBotRef = null;

/**
 * Define as referências em memória dos Map() de salas Web e bot do Discord
 */
export function setPersistenceRefs(roomsMap, discordBot) {
  if (roomsMap) roomsStoreRef = roomsMap;
  if (discordBot) discordBotRef = discordBot;
}

/**
 * Converte objetos complexos (como Set de confirmados do ready check) em dados serializáveis em JSON
 */
export function serializeMix(mix) {
  if (!mix) return null;
  const cloned = { ...mix };
  if (cloned.readyCheck) {
    cloned.readyCheck = {
      ...cloned.readyCheck,
      confirmed: Array.from(cloned.readyCheck.confirmed || []),
      timer: null,
      active: false,
    };
  }
  return cloned;
}

/**
 * Restaura objetos da memória ao deserializar do JSON (reconstrói Set de confirmados)
 */
export function deserializeMix(data) {
  if (!data) return null;
  const mix = { ...data };
  if (mix.readyCheck) {
    mix.readyCheck.confirmed = new Set(
      Array.isArray(mix.readyCheck.confirmed) ? mix.readyCheck.confirmed : []
    );
    mix.readyCheck.timer = null;
    mix.readyCheck.active = false;
  }
  return mix;
}

/**
 * Salva imediatamente em disco o estado atual de todas as salas Web e Mixes do Discord/WhatsApp
 */
export function saveActiveMixStateNow() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    const roomsList = [];
    if (roomsStoreRef && roomsStoreRef.size > 0) {
      for (const [id, room] of roomsStoreRef.entries()) {
        if (!room) continue;
        if (room.phase === 'finished' || room.phase === 'cancelled') continue;
        // Não salva salas vazias abandonadas há mais de 12 horas
        const isIdleEmpty = (!room.players || room.players.length === 0) && (Date.now() - (room.createdAt || 0) > 12 * 3600 * 1000);
        if (isIdleEmpty) continue;
        roomsList.push(room);
      }
    }

    const discordMixesList = [];
    if (discordBotRef && discordBotRef.activeMixes && discordBotRef.activeMixes.size > 0) {
      const seenMixIds = new Set();
      for (const [channelId, mix] of discordBotRef.activeMixes.entries()) {
        if (!mix) continue;
        if (mix.phase === 'finished' || mix.phase === 'cancelled') continue;
        // Avoid persisting the same mix twice if keyed by both channelId and mix.id
        if (mix.id && seenMixIds.has(mix.id)) continue;
        if (mix.id) seenMixIds.add(mix.id);
        discordMixesList.push({
          channelId,
          mix: serializeMix(mix),
        });
      }
    }

    const payload = {
      savedAt: Date.now(),
      roomsCount: roomsList.length,
      discordMixesCount: discordMixesList.length,
      rooms: roomsList,
      discordMixes: discordMixesList,
    };

    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.warn('[PERSISTÊNCIA] Falha ao salvar estado dos mixes:', err.message);
  }
}

/**
 * Agenda salvamento debounced para não onerar o disco com escritas redundantes em lote
 */
export function scheduleSave(delay = 300) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveActiveMixStateNow();
  }, delay);
}

/**
 * Lê do arquivo em disco as salas e mixes ativos salvos
 */
export function loadActiveMixState() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { rooms: [], discordMixes: [] };
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const rooms = Array.isArray(parsed?.rooms) ? parsed.rooms : [];
    const discordMixes = Array.isArray(parsed?.discordMixes) ? parsed.discordMixes : [];
    return {
      rooms,
      discordMixes: discordMixes.map((item) => ({
        channelId: item.channelId,
        mix: deserializeMix(item.mix),
      })),
    };
  } catch (err) {
    console.warn('[PERSISTÊNCIA] Falha ao ler estado persistido dos mixes:', err.message);
    return { rooms: [], discordMixes: [] };
  }
}

/**
 * Remove um mix específico do arquivo persistido (ao finalizar ou cancelar)
 */
export function clearMixPersistence(mixId) {
  try {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    const state = loadActiveMixState();
    state.rooms = (state.rooms || []).filter((r) => r.id !== mixId);
    state.discordMixes = (state.discordMixes || []).filter((item) => item.mix?.id !== mixId);
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpPath = `${STORE_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.warn('[PERSISTÊNCIA] Falha ao limpar persistência do mix:', err.message);
  }
}
