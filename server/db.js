import fs from 'fs';
import { getDataDir, getDataFilePath } from './dataDir.js';

const DATA_DIR = getDataDir();
const ECONOMY_FILE = getDataFilePath('economyStore.json');
const CLIPS_LINKED_FILE = getDataFilePath('linkedClipsStore.json');
const BAGRE_VOTES_FILE = getDataFilePath('bagreVotesStore.json');
const COMMENDATIONS_FILE = getDataFilePath('commendationsStore.json');

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
const commendationsMemory = readJsonAtomic(COMMENDATIONS_FILE, {});

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
  commendPlayer(targetId, type = 'friendly', voterKey = '', matchKey = 'global') {
    const cleanTarget = String(targetId || '').trim();
    const validTypes = new Set(['friendly', 'leader', 'aim', 'comms']);
    const cleanType = validTypes.has(type) ? type : 'friendly';
    if (!cleanTarget) return null;

    if (!commendationsMemory[cleanTarget]) {
      commendationsMemory[cleanTarget] = {
        friendly: 0,
        leader: 0,
        aim: 0,
        comms: 0,
        votes: {},
        updatedAt: new Date().toISOString(),
      };
    }

    const entry = commendationsMemory[cleanTarget];
    if (!entry.votes || typeof entry.votes !== 'object') entry.votes = {};

    const cleanVoter = String(voterKey || '').trim();
    const dedupeKey = cleanVoter ? `${cleanVoter}:${String(matchKey || 'global')}:${cleanType}` : '';
    if (dedupeKey && entry.votes[dedupeKey]) {
      return {
        targetId: cleanTarget,
        counts: { friendly: entry.friendly || 0, leader: entry.leader || 0, aim: entry.aim || 0, comms: entry.comms || 0 },
        alreadyCommended: true,
      };
    }

    entry[cleanType] = (Number(entry[cleanType]) || 0) + 1;
    if (dedupeKey) {
      entry.votes[dedupeKey] = Date.now();
    }
    entry.updatedAt = new Date().toISOString();
    writeJsonAtomic(COMMENDATIONS_FILE, commendationsMemory);

    return {
      targetId: cleanTarget,
      counts: { friendly: entry.friendly || 0, leader: entry.leader || 0, aim: entry.aim || 0, comms: entry.comms || 0 },
      alreadyCommended: false,
    };
  },
  getCommendations(targetIds = null) {
    const formatEntry = (e = {}) => ({
      friendly: Number(e.friendly) || 0,
      leader: Number(e.leader) || 0,
      aim: Number(e.aim) || 0,
      comms: Number(e.comms) || 0,
    });
    if (Array.isArray(targetIds) && targetIds.length > 0) {
      const subset = {};
      for (const id of targetIds) {
        const key = String(id || '').trim();
        if (key && commendationsMemory[key]) {
          subset[key] = formatEntry(commendationsMemory[key]);
        }
      }
      return subset;
    }
    const all = {};
    for (const [k, v] of Object.entries(commendationsMemory)) {
      all[k] = formatEntry(v);
    }
    return all;
  },
};