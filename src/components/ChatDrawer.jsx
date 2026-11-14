import React, { useState, useEffect, useRef } from 'react';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import { MessageSquare, Send, X, Smile, Sparkles, User } from 'lucide-react';
import { playChatPop, playClickSound } from '../utils/audio';

const QUICK_CALLOUTS = ['Bora Mirage!', 'Rush B não para!', 'NT!', 'GG WP!', 'Pede pause', 'EZ d+'];

export default function ChatDrawer({
  chat = [],
  onSendMessage,
  myProfile,
  rankingSystem = 'gc',
  soundEnabled,
  roomId = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef(null);
  const prevChatLen = useRef(chat.length);

  useEffect(() => {
    prevChatLen.current = chat.length;
    setUnreadCount(0);
  }, [roomId]);

  useEffect(() => {
    if (chat.length > prevChatLen.current) {
      const delta = chat.length - prevChatLen.current;
      if (!isOpen) {
        setUnreadCount((c) => c + delta);
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
        faceitLevel: myProfile?.faceitLevel || 5,
        faceitElo: myProfile?.faceitElo || null,
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
        faceitLevel: myProfile?.faceitLevel || 5,
        faceitElo: myProfile?.faceitElo || null,
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
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-2xl shadow-amber-500/30 transition-all cursor-pointer group active:scale-95"
        >
          <MessageSquare size={17} className="transition-transform group-hover:scale-110" />
          <span>Chat do Mix</span>
          {unreadCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center animate-bounce shadow-md">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Chat do Mix ao Vivo"
          className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm sm:max-w-md bg-slate-900 border-2 border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[min(480px,80vh)] animate-slideUp backdrop-blur"
        >
          {/* Header */}
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="font-bold font-heading text-sm text-white">Chat do Mix ao Vivo</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick Banter / Phrases Bar */}
          <div className="bg-slate-950/60 px-3 py-2 border-b border-slate-800/80 flex gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
            {QUICK_CALLOUTS.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => sendQuick(phrase)}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/50 font-medium transition-all text-[10px] cursor-pointer active:scale-95 shrink-0"
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* Messages list with Refined Speech Balloons */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {chat.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs py-8">
                <Smile size={28} className="mb-2 text-slate-600 animate-bounce" />
                <p className="font-semibold text-slate-400">Nenhuma mensagem ainda.</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Mande um salve para os companheiros de time!</p>
              </div>
            ) : (
              chat.map((m) => {
                const senderNick = typeof m.sender === 'object' && m.sender?.nick
                  ? m.sender.nick
                  : (typeof m.sender === 'string' && m.sender ? m.sender : 'Jogador');

                const myNick = myProfile?.nick || '';
                const isMe = senderNick && myNick && senderNick.toLowerCase() === myNick.toLowerCase();
                const isFaceit = rankingSystem === 'faceit';
                const senderAvatar = (typeof m.sender === 'object' ? m.sender?.avatar : null) || (isMe ? myProfile?.avatar : '🎯') || '🎯';
                const senderLevel = typeof m.sender === 'object' ? (m.sender?.level || 10) : 10;
                const senderFaceitLevel = typeof m.sender === 'object' ? (m.sender?.faceitLevel || 5) : 5;
                const senderFaceitElo = typeof m.sender === 'object' ? m.sender?.faceitElo : null;

                return (
                  <div
                    key={m.id}
                    className={`flex items-end gap-2 text-xs ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isMe && (
                      <span className="text-sm select-none shrink-0 mb-1" title={senderNick}>
                        {senderAvatar}
                      </span>
                    )}

                    {/* Speech Balloon */}
                    <div
                      className={`max-w-[85%] p-3 shadow-md transition-all ${
                        isMe
                          ? 'bg-gradient-to-br from-amber-500/20 via-amber-600/15 to-amber-500/10 border border-amber-500/40 text-amber-50 rounded-2xl rounded-tr-xs'
                          : 'bg-slate-950/85 border border-slate-800 text-slate-200 rounded-2xl rounded-tl-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-white/10">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-black text-xs tracking-wide ${isMe ? 'text-amber-400' : 'text-sky-300'}`}>
                            {senderNick}
                          </span>
                          {isMe && (
                            <span className="text-[9px] font-mono font-bold text-amber-400/90 bg-amber-500/15 border border-amber-500/30 px-1 rounded">
                              Você
                            </span>
                          )}
                          {isFaceit ? (
                            <FaceitBadge
                              level={senderFaceitLevel}
                              elo={senderFaceitElo}
                              size="sm"
                            />
                          ) : (
                            <GCBadge level={senderLevel} size="sm" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {m.timestamp ? new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-xs break-words leading-relaxed font-normal">{m.text}</p>
                    </div>

                    {isMe && (
                      <span className="text-sm select-none shrink-0 mb-1" title={senderNick}>
                        {senderAvatar}
                      </span>
                    )}
                  </div>
                );
              })
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
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 font-medium"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
