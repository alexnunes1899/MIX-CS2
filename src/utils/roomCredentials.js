/**
 * Utility to generate tactical CS2-themed room usernames and secure 4-digit PIN passwords.
 */

const CALLSIGNS = [
  'CORUJA', 'DELTA', 'VIPER', 'ALPHA', 'BRAVO', 'TANGO',
  'SHADOW', 'TITAN', 'APEX', 'PHOENIX', 'FALCON', 'RAVEN',
  'GHOST', 'STORM', 'SNIPER', 'CLUTCH', 'RUSH', 'MIRAGE',
  'INFERNO', 'NUKE', 'ANUBIS', 'DUST', 'ANCIENT', 'OVERPASS',
  'VERTIGO', 'TROOPER', 'COBRA', 'EAGLE', 'VALVE', 'MAJOR'
];

/**
 * Generates a clean, readable tactical room user/code (e.g. MIX-CORUJA-42)
 */
export function generateRoomUser() {
  const callsign = CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)];
  const num = Math.floor(10 + Math.random() * 90); // 2-digit number (10-99)
  return `MIX-${callsign}-${num}`;
}

/**
 * Generates an easy-to-share 4-digit numeric PIN password (e.g. 7492)
 */
export function generateRoomPassword() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Generates a full room credentials pair
 */
export function generateRoomCredentials() {
  const roomUser = generateRoomUser();
  const roomPassword = generateRoomPassword();
  return {
    roomUser,
    roomPassword,
    suggestedName: `Mix ${roomUser.replace('MIX-', '')}`,
  };
}
