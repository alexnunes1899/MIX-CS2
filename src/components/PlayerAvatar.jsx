import React from 'react';

export default function PlayerAvatar({ avatar, nick, size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs rounded-md',
    md: 'w-8 h-8 text-sm rounded-lg',
    lg: 'w-11 h-11 text-xl rounded-xl',
    xl: 'w-16 h-16 text-3xl rounded-2xl',
  };

  const isUrl = typeof avatar === 'string' && (avatar.startsWith('http://') || avatar.startsWith('https://'));

  if (isUrl) {
    return (
      <img
        src={avatar}
        alt={nick || 'Avatar'}
        className={`object-cover border border-slate-700/80 shadow-sm shrink-0 ${sizeClasses[size] || sizeClasses.md} ${className}`}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center select-none bg-slate-800/70 border border-slate-700/60 shadow-sm shrink-0 ${sizeClasses[size] || sizeClasses.md} ${className}`}
      role="img"
      aria-label="avatar"
    >
      {avatar || '🎯'}
    </span>
  );
}
