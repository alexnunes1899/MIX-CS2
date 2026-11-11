import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const ECONOMY_FILE = path.join(DATA_DIR, 'economyStore.json');
const CLIPS_LINKED_FILE = path.join(DATA_DIR, 'linkedClipsStore.json');
const BAGRE_VOTES_FILE = path.join(DATA_DIR, 'bagreVotesStore.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJsonAtomic(filePath, defaultVal = {}) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {}
  return defaultVal;
}

function writeJsonAtomic(filePath, data) {
  try {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (e) {}
}

const economyMemory = readJsonAtomic(ECONOMY_FILE, {});
const linkedClipsMemory = readJsonAtomic(CLIPS_LINKED_FILE, []);
const bagreVotesMemory = readJsonAtomic(BAGRE_VOTES_FILE, {});

export const economyDb = {
  getPlayer(steamId, name = 'Jogador') {
    const key = String(steamId || name || 'anon').trim();
    if (!economyMemory[key]) {
      economyMemory[key] = {
        steamId: key,
        name: name || 'Jogador',
        mixCoins: 100,
        freeKeys: 1,
        featuredSkin: null,
        updatedAt: new Date().toISOString(),
      };
      writeJsonAtomic(ECONOMY_FILE, economyMemory);
    }
    return economyMemory[key];
  },
  rewardPlayer(steamId, name, coinsDelta = 0, keysDelta = 0) {
    const player = this.getPlayer(steamId, name);
    player.mixCoins = Math.max(0, (Number(player.mixCoins) || 0) + Number(coinsDelta));
    player.freeKeys = Math.max(0, (Number(player.freeKeys) || 0) + Number(keysDelta));
    if (name) player.name = name;
    player.updatedAt = new Date().toISOString();
    writeJsonAtomic(ECONOMY_FILE, economyMemory);
    return player;
  },
  setFeaturedSkin(steamId, skinObj) {
    const player = this.getPlayer(steamId);
    player.featuredSkin = skinObj || null;
    player.updatedAt = new Date().toISOString();
    writeJsonAtomic(ECONOMY_FILE, economyMemory);
    return player;
  },
  recordBagreVote(matchId, voterSteamId, voterName, targetSteamId, targetName) {
    const mKey = String(matchId || 'latest');
    if (!bagreVotesMemory[mKey]) bagreVotesMemory[mKey] = {};
    if (bagreVotesMemory[mKey][voterSteamId]) return { alreadyVoted: true };
    bagreVotesMemory[mKey][voterSteamId] = { targetSteamId, targetName, votedAt: new Date().toISOString() };
    writeJsonAtomic(BAGRE_VOTES_FILE, bagreVotesMemory);
    const updated = this.rewardPlayer(voterSteamId, voterName, 10, 0);
    return { alreadyVoted: false, reward: 10, economy: updated };
  },
  addLinkedClip({ title, url, authorName, authorSteamId, matchId, map }) {
    const clip = {
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title || 'Jogada da Noite no Mix',
      url,
      authorName: authorName || 'Jogador',
      authorSteamId: authorSteamId || '',
      matchId: String(matchId || ''),
      map: map || 'Mirage',
      createdAt: new Date().toISOString(),
    };
    linkedClipsMemory.unshift(clip);
    writeJsonAtomic(CLIPS_LINKED_FILE, linkedClipsMemory.slice(0, 500));
    if (authorSteamId) this.rewardPlayer(authorSteamId, authorName, 15, 0);
    return clip;
  },
  getClipsByMatch(matchId) {
    if (!matchId) return linkedClipsMemory.slice(0, 50);
    return linkedClipsMemory.filter((c) => String(c.matchId) === String(matchId));
  },
};