import path from 'path';
import { fileURLToPath } from 'url';
import { readJsonSafe, writeJsonAtomic } from './utils/atomicJson.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const ECONOMY_FILE = path.join(DATA_DIR, 'economyStore.json');
const CLIPS_LINKED_FILE = path.join(DATA_DIR, 'linkedClipsStore.json');
const BAGRE_VOTES_FILE = path.join(DATA_DIR, 'bagreVotesStore.json');

const economyMemory = readJsonSafe(ECONOMY_FILE, {});
const linkedClipsMemory = readJsonSafe(CLIPS_LINKED_FILE, []);
const bagreVotesMemory = readJsonSafe(BAGRE_VOTES_FILE, {});

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
    if (linkedClipsMemory.length > 500) {
      linkedClipsMemory.length = 500;
    }
    writeJsonAtomic(CLIPS_LINKED_FILE, linkedClipsMemory);
    if (authorSteamId) this.rewardPlayer(authorSteamId, authorName, 15, 0);
    return clip;
  },
  getClipsByMatch(matchId) {
    if (!matchId) return linkedClipsMemory.slice(0, 50);
    return linkedClipsMemory.filter((c) => String(c.matchId) === String(matchId));
  },
};