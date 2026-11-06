import net from 'net';

/**
 * Valve Source RCON Protocol Client
 * Handles connection, authentication, command execution, and response parsing.
 * Compatible with CS2 dedicated servers (FireGames, Dathost, self-hosted, etc.)
 */

const SERVERDATA_AUTH = 3;
const SERVERDATA_EXECCOMMAND = 2;
const SERVERDATA_AUTH_RESPONSE = 2;
const SERVERDATA_RESPONSE_VALUE = 0;

export function executeRconCommand({ host, port = 27015, password, command, timeoutMs = 5000 }) {
  return new Promise((resolve, reject) => {
    if (!host || !password) {
      return reject(new Error('Host e senha RCON são obrigatórios.'));
    }

    const cleanHost = host.trim();
    const cleanPort = Number(port) || 27015;
    const socket = new net.Socket();

    let authenticated = false;
    let authReqId = Math.floor(Math.random() * 10000) + 1;
    let cmdReqId = authReqId + 1;
    let responseBuffer = '';
    let timeoutTimer = null;

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      socket.removeAllListeners();
      socket.destroy();
    };

    timeoutTimer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout de RCON (${timeoutMs}ms) ao conectar em ${cleanHost}:${cleanPort}`));
    }, timeoutMs);

    function createPacket(id, type, body) {
      const bodyBuffer = Buffer.from(body, 'utf8');
      const size = 4 + 4 + bodyBuffer.length + 2; // id (4) + type (4) + body + 2 null bytes
      const packet = Buffer.alloc(size + 4);

      packet.writeInt32LE(size, 0);
      packet.writeInt32LE(id, 4);
      packet.writeInt32LE(type, 8);
      bodyBuffer.copy(packet, 12);
      packet.writeInt8(0, 12 + bodyBuffer.length);
      packet.writeInt8(0, 13 + bodyBuffer.length);

      return packet;
    }

    socket.connect(cleanPort, cleanHost, () => {
      // 1. Send AUTH packet
      const authPacket = createPacket(authReqId, SERVERDATA_AUTH, password);
      socket.write(authPacket);
    });

    let incomingData = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      incomingData = Buffer.concat([incomingData, chunk]);

      while (incomingData.length >= 12) {
        const size = incomingData.readInt32LE(0);
        const totalSize = size + 4;

        if (incomingData.length < totalSize) {
          break; // wait for more bytes
        }

        const packetBuf = incomingData.slice(0, totalSize);
        incomingData = incomingData.slice(totalSize);

        const id = packetBuf.readInt32LE(4);
        const type = packetBuf.readInt32LE(8);
        const body = packetBuf.slice(12, totalSize - 2).toString('utf8');

        // Authentication response
        if (!authenticated) {
          if (type === SERVERDATA_AUTH_RESPONSE) {
            if (id === -1) {
              cleanup();
              return reject(new Error('Senha RCON incorreta.'));
            }
            authenticated = true;

            // If just testing connection
            if (!command || command.trim() === 'test') {
              cleanup();
              return resolve({ success: true, message: 'Autenticado com sucesso via RCON!' });
            }

            // 2. Send command packet
            const cmdPacket = createPacket(cmdReqId, SERVERDATA_EXECCOMMAND, command);
            socket.write(cmdPacket);
          }
        } else {
          // Command response
          if (id === cmdReqId || type === SERVERDATA_RESPONSE_VALUE) {
            responseBuffer += body;

            // Most commands return immediate response
            setTimeout(() => {
              cleanup();
              resolve({
                success: true,
                command,
                response: responseBuffer.trim() || 'Comando executado com sucesso no servidor.',
              });
            }, 300);
          }
        }
      }
    });

    socket.on('error', (err) => {
      cleanup();
      reject(new Error(`Falha de conexão RCON com ${cleanHost}:${cleanPort}: ${err.message}`));
    });

    socket.on('end', () => {
      cleanup();
      if (authenticated) {
        resolve({
          success: true,
          command,
          response: responseBuffer.trim() || 'Comando enviado.',
        });
      } else {
        reject(new Error('Conexão encerrada pelo servidor sem resposta de autenticação.'));
      }
    });
  });
}
