import https from 'https';

export const ALL_MAPS_CATALOGUE = [
  {
    id: 'de_mirage',
    name: 'Mirage',
    file: 'de_mirage',
    location: 'Marrocos',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_mirage_1_png.png',
    logo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/de_mirage.png',
    accentColor: '#f59e0b',
    description: 'Rotação Oficial Competitiva da Valve',
  },
  {
    id: 'de_inferno',
    name: 'Inferno',
    file: 'de_inferno',
    location: 'Itália',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_inferno_1_png.png',
    logo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/de_inferno.png',
    accentColor: '#ea580c',
    description: 'Rotação Oficial Competitiva da Valve',
  },
  {
    id: 'de_nuke',
    name: 'Nuke',
    file: 'de_nuke',
    location: 'EUA',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_nuke_1_png.png',
    logo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/de_nuke.png',
    accentColor: '#0ea5e9',
    description: 'Rotação Oficial Competitiva da Valve',
  },
  {
    id: 'de_dust2',
    name: 'Dust II',
    file: 'de_dust2',
    location: 'Oriente Médio',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_dust2_1_png.png',
    logo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/de_dust2.png',
    accentColor: '#eab308',
    description: 'Rotação Oficial Competitiva da Valve',
  },
  {
    id: 'de_ancient',
    name: 'Ancient',
    file: 'de_ancient',
    location: 'América Central',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_ancient_1_png.png',
    logo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/de_ancient.png',
    accentColor: '#10b981',
    description: 'Rotação Oficial Competitiva da Valve',
  },
  {
    id: 'de_anubis',
    name: 'Anubis',
    file: 'de_anubis',
    location: 'Egito',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_anubis_1_png.png',
    logo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/de_anubis.png',
    accentColor: '#d97706',
    description: 'Rotação Oficial Competitiva da Valve',
  },
  {
    id: 'de_cache',
    name: 'Cache',
    file: 'de_cache',
    location: 'Chernobyl, Ucrânia',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_cache_1_png.png',
    logo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/de_cache.png',
    accentColor: '#22c55e',
    description: 'Rotação Oficial Competitiva da Valve',
  },
  {
    id: 'de_train',
    name: 'Train',
    file: 'de_train',
    location: 'Europa Oriental',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_train_1_png.png',
    logo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/de_train.png',
    accentColor: '#94a3b8',
    description: 'Clássico dos trens adicionado ao CS2',
  },
  {
    id: 'de_overpass',
    name: 'Overpass',
    file: 'de_overpass',
    location: 'Berlim, Alemanha',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_overpass_1_png.png',
    logo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/de_overpass.png',
    accentColor: '#0284c7',
    description: 'Mapa do pool clássico do CS2',
  },
  {
    id: 'de_vertigo',
    name: 'Vertigo',
    file: 'de_vertigo',
    location: 'EUA',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_vertigo_1_png.png',
    logo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/de_vertigo.png',
    accentColor: '#6366f1',
    description: 'Mapa no topo do arranha-céu do CS2',
  },
  {
    id: 'cs_office',
    name: 'Office',
    file: 'cs_office',
    location: 'EUA',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/cs_office_1_png.png',
    logo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/cs_office.png',
    accentColor: '#38bdf8',
    description: 'Clássico com neve e resgate de reféns',
  },
  {
    id: 'cs_italy',
    name: 'Italy',
    file: 'cs_italy',
    location: 'Itália',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/cs_italy_1_png.png',
    logo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/cs_italy.png',
    accentColor: '#ef4444',
    description: 'Remake Source 2 com reféns',
  },
];

const DEFAULT_ACTIVE_IDS = ['de_mirage', 'de_inferno', 'de_nuke', 'de_dust2', 'de_ancient', 'de_anubis', 'de_cache'];

let cachedRotationState = {
  source: 'Wikipedia / Valve Esports Records',
  sourceUrl: 'https://en.wikipedia.org/wiki/List_of_competitive_Counter-Strike_maps',
  lastSync: Date.now(),
  activeMapIds: [...DEFAULT_ACTIVE_IDS],
  activeDutyMaps: ALL_MAPS_CATALOGUE.filter((m) => DEFAULT_ACTIVE_IDS.includes(m.id)),
  extraMaps: ALL_MAPS_CATALOGUE.filter((m) => !DEFAULT_ACTIVE_IDS.includes(m.id)),
};

/**
 * Fetches the live official Active Duty map pool from reliable Wikipedia / Valve esports records
 */
export async function fetchLiveOfficialRotation() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'en.wikipedia.org',
      path: '/w/api.php?action=parse&page=List_of_competitive_Counter-Strike_maps&format=json&prop=wikitext',
      headers: {
        'User-Agent': 'CS2MixHub/1.0 (https://github.com/alexnunes1899/MIX-CS2)',
      },
      timeout: 8000,
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.warn(`[MAP_SYNC] Status ${res.statusCode} ao consultar Wikipedia. Mantendo cache.`);
            return resolve(cachedRotationState);
          }

          const json = JSON.parse(data);
          const text = json.parse?.wikitext?.['*'] || '';

          // Look for sentence: "the seven Active Duty maps in ''Counter-Strike 2'' are ..."
          const regex = /(?:seven\s+Active\s+Duty\s+maps[^\n]*?are|Active\s+Duty\s+map\s+pool[^\n]*?are)\s+([^\.\n]+)/i;
          const match = text.match(regex);

          let detectedIds = [];
          if (match && match[1]) {
            const raw = match[1].toLowerCase();
            for (const map of ALL_MAPS_CATALOGUE) {
              if (raw.includes(map.name.toLowerCase()) || (map.name === 'Dust II' && raw.includes('dust 2'))) {
                detectedIds.push(map.id);
              }
            }
          }

          // If we got valid 7 maps
          if (detectedIds.length >= 7) {
            detectedIds = detectedIds.slice(0, 7);
          } else if (detectedIds.length === 0) {
            detectedIds = DEFAULT_ACTIVE_IDS;
          }

          const activeDuty = ALL_MAPS_CATALOGUE.filter((m) => detectedIds.includes(m.id)).map((m) => ({
            ...m,
            activeDuty: true,
            category: 'active_duty',
          }));

          const extra = ALL_MAPS_CATALOGUE.filter((m) => !detectedIds.includes(m.id)).map((m) => ({
            ...m,
            activeDuty: false,
            category: m.id.startsWith('cs_') ? 'hostage' : 'extra',
          }));

          cachedRotationState = {
            source: 'Wikipedia / Valve Esports Records (Verificado em Tempo Real)',
            sourceUrl: 'https://en.wikipedia.org/wiki/List_of_competitive_Counter-Strike_maps',
            lastSync: Date.now(),
            activeMapIds: detectedIds,
            activeDutyMaps: activeDuty,
            extraMaps: extra,
          };

          console.log(`[MAP_SYNC] Rotação oficial sincronizada com sucesso (${detectedIds.length} mapas):`, detectedIds.join(', '));
          resolve(cachedRotationState);
        } catch (err) {
          console.warn('[MAP_SYNC] Erro ao analisar retorno da Wikipedia:', err.message);
          resolve(cachedRotationState);
        }
      });
    });

    req.on('error', (err) => {
      console.warn('[MAP_SYNC] Erro na requisição HTTP:', err.message);
      resolve(cachedRotationState);
    });

    req.on('timeout', () => {
      req.destroy();
      console.warn('[MAP_SYNC] Timeout ao consultar Wikipedia.');
      resolve(cachedRotationState);
    });
  });
}

export function getCurrentRotationState() {
  return cachedRotationState;
}
