/**
 * Utility to generate tactical CS2-themed room usernames and secure 4-digit PIN passwords.
 * Supports naming after the room creator (e.g. Alex -> "Time Alex" / "TIME-ALEX").
 */

const CALLSIGNS = [
  'CORUJA', 'DELTA', 'VIPER', 'ALPHA', 'BRAVO', 'TANGO',
  'SHADOW', 'TITAN', 'APEX', 'PHOENIX', 'FALCON', 'RAVEN',
  'GHOST', 'STORM', 'SNIPER', 'CLUTCH', 'RUSH', 'MIRAGE',
  'INFERNO', 'NUKE', 'ANUBIS', 'DUST', 'ANCIENT', 'OVERPASS',
  'VERTIGO', 'TROOPER', 'COBRA', 'EAGLE', 'VALVE', 'MAJOR'
];

/**
 * Generates a clean room user/code. If creatorNick is provided (e.g. Alex), returns TIME-ALEX.
 */
export function generateRoomUser(creatorNick = '') {
  const clean = (creatorNick || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length > 0) {
    return `TIME-${clean.slice(0, 14)}`;
  }
  const callsign = CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `MIX-${callsign}-${num}`;
}

/**
 * Generates an easy-to-share 4-digit numeric PIN password (e.g. 7492)
 */
export function generateRoomPassword() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Generates a full room credentials pair with creator name support.
 * E.g.: If Alex is creating, suggestedName is "Time Alex" and roomUser is "TIME-ALEX".
 */
export function generateRoomCredentials(creatorNick = '') {
  const cleanNick = (creatorNick || '').trim();
  const roomUser = generateRoomUser(cleanNick);
  const roomPassword = generateRoomPassword();
  const suggestedName = cleanNick
    ? `Time ${cleanNick}`
    : `Mix ${roomUser.replace('MIX-', '').replace('TIME-', '')}`;

  return {
    roomUser,
    roomPassword,
    suggestedName,
  };
}
