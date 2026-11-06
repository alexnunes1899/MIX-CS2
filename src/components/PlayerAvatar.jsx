import React from 'react';

export default function PlayerAvatar({ avatar, nick, size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-sm rounded-md',
    md: 'w-8 h-8 text-lg rounded-lg',
    lg: 'w-11 h-11 text-2xl rounded-xl',
    xl: 'w-16 h-16 text-4xl rounded-2xl',
  };

  const isUrl = typeof avatar === 'string' && (avatar.startsWith('http://') || avatar.startsWith('https://'));

  if (isUrl) {
    return (
      <img
        src={avatar}
        alt={nick || 'Avatar'}
        className={`object-cover border border-slate-700 shadow-sm ${sizeClasses[size]} ${className}`}
        onError={(e) => {
          // fallback to emoji if image fails
          e.target.style.display = 'none';
        }}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center select-none ${className}`}
      role="img"
      aria-label="avatar"
    >
      {avatar || '🎯'}
    </span>
  );
}
