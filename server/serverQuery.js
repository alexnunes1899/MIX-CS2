import dgram from 'dgram';
import net from 'net';

/**
 * Pings a CS2/Source Server using Valve A2S_INFO UDP protocol or TCP fallback.
 */
export async function pingCs2Server(host, port = 27015, timeoutMs = 1800) {
  const cleanHost = String(host || '').trim().replace(/^connect\s+/i, '').split(':')[0];
  const cleanPort = parseInt(port, 10) || 27015;

  if (!cleanHost) {
    return { online: false, pingMs: null, error: 'Host não informado.' };
  }

  // 1. Try Valve A2S_INFO UDP
  const udpResult = await new Promise((resolve) => {
    let socket;
    try {
      socket = dgram.createSocket('udp4');
    } catch (e) {
      return resolve({ online: false, pingMs: null, error: e.message });
    }

    const start = Date.now();
    let responded = false;

    const timer = setTimeout(() => {
      if (!responded) {
        responded = true;
        try { socket.close(); } catch (e) {}
        resolve({ online: false, pingMs: null, error: 'Timeout' });
      }
    }, timeoutMs);

    socket.on('message', (msg) => {
      if (!responded) {
        responded = true;
        clearTimeout(timer);
        const pingMs = Date.now() - start;
        try { socket.close(); } catch (e) {}
        resolve({ online: true, pingMs, host: cleanHost, port: cleanPort, protocol: 'A2S_INFO UDP' });
      }
    });

    socket.on('error', (err) => {
      if (!responded) {
        responded = true;
        clearTimeout(timer);
        try { socket.close(); } catch (e) {}
        resolve({ online: false, pingMs: null, error: err.message });
      }
    });

    // Standard Valve A2S_INFO packet
    const query = Buffer.from([
      0xFF, 0xFF, 0xFF, 0xFF, 0x54, 0x53, 0x6F, 0x75, 0x72, 0x63, 0x65, 0x20,
      0x45, 0x6E, 0x67, 0x69, 0x6E, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00,
    ]);

    try {
      socket.send(query, cleanPort, cleanHost, (err) => {
        if (err && !responded) {
          responded = true;
          clearTimeout(timer);
          try { socket.close(); } catch (e) {}
          resolve({ online: false, pingMs: null, error: err.message });
        }
      });
    } catch (err) {
      if (!responded) {
        responded = true;
        clearTimeout(timer);
        try { socket.close(); } catch (e) {}
        resolve({ online: false, pingMs: null, error: err.message });
      }
    }
  });

  if (udpResult.online) {
    return udpResult;
  }

  // 2. TCP Connect Fallback (e.g. for servers with UDP filters or RCON port)
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.connect(cleanPort, cleanHost, () => {
      const pingMs = Date.now() - start;
      socket.destroy();
      resolve({ online: true, pingMs, host: cleanHost, port: cleanPort, protocol: 'TCP' });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({ online: false, pingMs: null, error: 'Porta fechada ou sem resposta' });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ online: false, pingMs: null, error: 'Tempo limite esgotado' });
    });
  });
}
