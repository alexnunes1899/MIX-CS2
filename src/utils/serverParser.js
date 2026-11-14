/**
 * Parses raw server input from users into clean IP, Port, Password, Console Command, and Steam URI.
 * Handles inputs like:
 * - "189.1.168.10:27015"
 * - "connect 189.1.168.10:27015"
 * - "connect 189.1.168.10:27015; password mix"
 * - "connect 189.1.168.10:27015;password mix"
 * - "189.1.168.10:27015; password 'mix'"
 */
export function parseServerDetails(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      raw: '',
      ip: '',
      password: '',
      connectCommand: '',
      steamUrl: null,
      isValid: false,
    };
  }

  let clean = rawInput.trim();
  if (clean.toLowerCase().startsWith('connect ')) {
    clean = clean.substring(8).trim();
  }

  let ip = clean;
  let password = '';

  // Match: <ip:port> [;] password <password>
  const pwMatch = clean.match(/^(.*?)(?:;|\s)+\s*(?:password\s*=?)\s*(["']?)(.*?)\2$/i);
  if (pwMatch) {
    ip = pwMatch[1].trim();
    password = pwMatch[3].trim();
  } else {
    // Check if input has semicolon separating ip and pw
    const semiParts = clean.split(';');
    if (semiParts.length === 2) {
      ip = semiParts[0].trim();
      const secondPart = semiParts[1].trim();
      if (secondPart.toLowerCase().startsWith('password ')) {
        password = secondPart.substring(9).trim().replace(/['"]/g, '');
      } else {
        password = secondPart.replace(/['"]/g, '');
      }
    }
  }

  // Remove any lingering quotes, semicolons or spaces
  ip = ip.replace(/[;'"]/g, '').trim();

  let host = ip;
  let port = 27015;
  const colonIdx = ip.lastIndexOf(':');
  if (colonIdx !== -1) {
    host = ip.substring(0, colonIdx).trim();
    const parsedPort = parseInt(ip.substring(colonIdx + 1).trim(), 10);
    if (parsedPort >= 1 && parsedPort <= 65535) {
      port = parsedPort;
    }
  }

  const isValid = host.length > 0;
  const connectCommand = isValid
    ? (password ? `connect ${ip}; password ${password}` : `connect ${ip}`)
    : '';
  const launchArgs = isValid
    ? (password ? `+connect ${ip} +password ${password}` : `+connect ${ip}`)
    : '';
  const steamUrl = isValid
    ? `steam://rungame/730/76561202255233023/${encodeURIComponent(launchArgs)}`
    : null;
  return {
    raw: rawInput,
    ip,
    host,
    port,
    password,
    connectCommand,
    steamUrl,
    isValid,
  };
}
