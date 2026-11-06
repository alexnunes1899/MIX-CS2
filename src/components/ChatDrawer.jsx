import React, { useState, useEffect, useRef } from 'react';
import GCBadge from './GCBadge';
import { MessageSquare, Send, X, Smile, Sparkles } from 'lucide-react';
import { playChatPop, playClickSound } from '../utils/audio';

const QUICK_CALLOUTS = ['Bora Mirage!', 'Rush B não para!', 'NT!', 'GG WP!', 'Pede pause', 'EZ d+'];

export default function ChatDrawer({
  chat = [],
  onSendMessage,
  myProfile,
  soundEnabled,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef(null);
  const prevChatLen = useRef(chat.length);

  useEffect(() => {
    if (chat.length > prevChatLen.current) {
      if (!isOpen) {
        setUnreadCount((c) => c + 1);
      }
      if (soundEnabled) playChatPop();
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevChatLen.current = chat.length;
  }, [chat, isOpen, soundEnabled]);

  const handleOpen = () => {
    if (soundEnabled) playClickSound();
    setIsOpen(true);
    setUnreadCount(0);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage({
      sender: {
        nick: myProfile?.nick || 'Anônimo',
        level: myProfile?.level || 10,
        avatar: myProfile?.avatar || '🎯',
      },
      text: inputText.trim(),
    });

    setInputText('');
  };

  const sendQuick = (phrase) => {
    onSendMessage({
      sender: {
        nick: myProfile?.nick || 'Anônimo',
        level: myProfile?.level || 10,
        avatar: myProfile?.avatar || '🎯',
      },
      text: phrase,
    });
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-2xl shadow-amber-500/30 transition-all cursor-pointer group"
        >
          <MessageSquare size={17} className="transition-transform group-hover:scale-110" />
          <span>Chat do Mix</span>
          {unreadCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-black flex items-center justify-center animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-full max-w-sm sm:max-w-md bg-slate-900 border-2 border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[460px] animate-slideUp backdrop-blur">
          {/* Header */}
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="font-bold font-heading text-sm text-white">Chat do Mix ao Vivo</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick Banter / Phrases Bar */}
          <div className="bg-slate-950/60 px-3 py-1.5 border-b border-slate-800/80 flex gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
            {QUICK_CALLOUTS.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => sendQuick(phrase)}
                className="whitespace-nowrap px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium transition-colors text-[10px]"
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chat.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs">
                <Smile size={24} className="mb-2 text-slate-600" />
                <p>Nenhuma mensagem ainda.</p>
                <p className="text-[11px] text-slate-600">Mande um salve para os companheiros de time!</p>
              </div>
            ) : (
              chat.map((m) => (
                <div key={m.id} className="flex items-start gap-2 text-xs">
                  <span className="text-base select-none">{m.sender?.avatar || '🎯'}</span>
                  <div className="flex-1 bg-slate-950/70 border border-slate-800/70 rounded-2xl p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-[11px]">{m.sender?.nick}</span>
                        <GCBadge level={m.sender?.level || 1} size="sm" />
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-200 text-xs break-words">{m.text}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite no chat..."
              maxLength={150}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
