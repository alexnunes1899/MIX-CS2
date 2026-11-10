import React, { useState, useEffect } from 'react';
import { AlertTriangle, HardDrive, Wifi, WifiOff, X, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';

export default function FailoverBanner({ roomId = 'MIX-PRO', roomPassword = '', socketConnected = true }) {
  const [isLocalHost, setIsLocalHost] = useState(false);
  const [localAvailable, setLocalAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [onlineAvailable, setOnlineAvailable] = useState(null);

  useEffect(() => {
    const host = window.location.hostname;
    setIsLocalHost(host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.'));
  }, []);

  // Check if local backup server on http://localhost:3000 is alive
  const checkLocalServer = async () => {
    setChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('http://localhost:3000/api/health', {
        signal: controller.signal,
        mode: 'cors',
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        setLocalAvailable(true);
        return true;
      }
    } catch (e) {
      setLocalAvailable(false);
    } finally {
      setChecking(false);
    }
    return false;
  };

  // If online socket is disconnected and we are NOT on localhost, monitor local backup
  useEffect(() => {
    if (isLocalHost || socketConnected) {
      setCountdown(null);
      return;
    }

    let interval = null;
    const testAndTrigger = async () => {
      const available = await checkLocalServer();
      if (available && countdown === null && !dismissed) {
        setCountdown(4);
      }
    };

    testAndTrigger();
    interval = setInterval(testAndTrigger, 5000);
    return () => clearInterval(interval);
  }, [socketConnected, isLocalHost, dismissed]);

  // Handle Countdown tick
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      handleSwitchToLocal();
      return;
    }
    const timer = setTimeout(() => setCountdown((prev) => (prev ? prev - 1 : 0)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSwitchToLocal = () => {
    const url = new URL('http://localhost:3000');
    url.searchParams.set('room', roomId);
    if (roomPassword) url.searchParams.set('pwd', roomPassword);
    window.location.href = url.toString();
  };

  // If on localhost, check if production online is back
  const checkOnlineProduction = async () => {
    try {
      const res = await fetch('https://mix-cs2-production.up.railway.app/api/health', { mode: 'cors' });
      if (res.ok) {
        setOnlineAvailable(true);
      } else {
        setOnlineAvailable(false);
      }
    } catch (e) {
      setOnlineAvailable(false);
    }
  };

  if (dismissed) return null;

  // When running locally on the user's PC, localhost is the primary server.
  if (isLocalHost) {
    return null;
  }

  // CASE 2: Online Server is Disconnected / Down
  if (!socketConnected) {
    if (localAvailable) {
      return (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xl animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-slate-950 animate-bounce shrink-0" />
            <span>
              Servidor online fora do ar! <strong>Servidor Local no seu computador detectado.</strong> Alternando automaticamente em {countdown !== null ? `${countdown}s` : 'instantes'}...
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSwitchToLocal}
              className="px-3 py-1 bg-slate-950 text-white rounded-lg font-bold text-xs hover:bg-slate-900 transition-all cursor-pointer flex items-center gap-1 shadow-md"
            >
              <span>Alternar para o PC Agora</span>
              <ArrowRight size={13} />
            </button>
            <button
              onClick={() => {
                setCountdown(null);
                setDismissed(true);
              }}
              className="p-1 hover:bg-black/15 rounded text-slate-950 cursor-pointer"
              title="Fechar aviso"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      );
    }

    // Local server not running yet
    return (
      <div className="bg-red-500/15 border-b border-red-500/30 text-red-200 px-4 py-2 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-lg animate-fadeIn">
        <div className="flex items-center gap-2">
          <WifiOff size={16} className="text-red-400 shrink-0" />
          <span>
            <strong>Servidor online desconectado.</strong> Para ativar o backup no seu computador, dê 2 cliques em <strong>INICIAR-SERVIDOR-BACKUP.bat</strong> na pasta do projeto.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={checkLocalServer}
            disabled={checking}
            className="px-3 py-1 rounded-lg bg-red-500 hover:bg-red-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
            <span>{checking ? 'Verificando PC...' : 'Testar Servidor do PC'}</span>
          </button>
          <button onClick={() => setDismissed(true)} className="text-red-400 hover:text-white p-0.5 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
