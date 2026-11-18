import net from 'net';
import { isBlockedMetadataHost, isCloudEnvironment, isPrivateOrLoopbackHost } from './utils/security.js';

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

    const cleanHost = String(host).trim();
    const cleanPort = Number(port) || 27015;
    if (
      !cleanHost ||
      isBlockedMetadataHost(cleanHost) ||
      (isCloudEnvironment() && isPrivateOrLoopbackHost(cleanHost))
    ) {
      return reject(new Error('Host RCON inválido ou bloqueado pela política de segurança.'));
    }
    if (!Number.isInteger(cleanPort) || cleanPort < 1 || cleanPort > 65535) {
      return reject(new Error('Porta RCON inválida (use 1 a 65535).'));
    }

    const socket = new net.Socket();
    let settled = false;
    let authenticated = false;
    const authReqId = Math.floor(Math.random() * 10000) + 1;
    const cmdReqId = authReqId + 1;
    let responseBuffer = '';
    let timeoutTimer = null;
    let finishTimer = null;

    const cleanup = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      if (finishTimer) {
        clearTimeout(finishTimer);
        finishTimer = null;
      }
      socket.removeAllListeners();
      socket.destroy();
    };

    const settleResolve = (val) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(val);
    };

    const settleReject = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    timeoutTimer = setTimeout(() => {
      settleReject(new Error(`Timeout de RCON (${timeoutMs}ms) ao conectar em ${cleanHost}:${cleanPort}`));
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
      const authPacket = createPacket(authReqId, SERVERDATA_AUTH, password);
      socket.write(authPacket);
    });

    let incomingData = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      incomingData = Buffer.concat([incomingData, chunk]);

      while (incomingData.length >= 12 && !settled) {
        const size = incomingData.readInt32LE(0);
        const totalSize = size + 4;
        if (size < 10 || totalSize > 65536) {
          settleReject(new Error('Resposta RCON malformada recebida do servidor.'));
          return;
        }
        if (incomingData.length < totalSize) {
          break;
        }

        const packetBuf = incomingData.slice(0, totalSize);
        incomingData = incomingData.slice(totalSize);

        const id = packetBuf.readInt32LE(4);
        const type = packetBuf.readInt32LE(8);
        const body = packetBuf.slice(12, totalSize - 2).toString('utf8');

        if (!authenticated) {
          if (type === SERVERDATA_AUTH_RESPONSE) {
            if (id === -1) {
              settleReject(new Error('Senha RCON incorreta.'));
              return;
            }
            authenticated = true;

            if (!command || command.trim() === 'test') {
              settleResolve({ success: true, message: 'Autenticado com sucesso via RCON!' });
              return;
            }

            const cmdPacket = createPacket(cmdReqId, SERVERDATA_EXECCOMMAND, command);
            socket.write(cmdPacket);
          }
        } else if (id === cmdReqId || type === SERVERDATA_RESPONSE_VALUE) {
          responseBuffer += body;
          if (finishTimer) clearTimeout(finishTimer);
          finishTimer = setTimeout(() => {
            settleResolve({
              success: true,
              command,
              response: responseBuffer.trim() || 'Comando executado com sucesso no servidor.',
            });
          }, 300);
        }
      }
    });

    socket.on('error', (err) => {
      settleReject(new Error(`Falha de conexão RCON com ${cleanHost}:${cleanPort}: ${err.message}`));
    });

    socket.on('end', () => {
      if (authenticated) {
        settleResolve({
          success: true,
          command,
          response: responseBuffer.trim() || 'Comando enviado.',
        });
      } else {
        settleReject(new Error('Conexão encerrada pelo servidor sem resposta de autenticação.'));
      }
    });
  });
}
