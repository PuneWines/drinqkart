import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

/**
 * WhatsAppContactAvatar
 * Handles image rendering, error fallback, alphabetical initials,
 * or standard user silhouette icon if contact only has a phone number.
 */
export default function WhatsAppContactAvatar({
  avatarUrl,
  name,
  phoneNumber,
  size = 'md',
  className = '',
}) {
  const [imgError, setImgError] = useState(false);

  const cleanAvatarUrl =
    avatarUrl &&
    typeof avatarUrl === 'string' &&
    avatarUrl !== 'null' &&
    avatarUrl !== 'undefined' &&
    avatarUrl.trim().length > 0
      ? avatarUrl.trim()
      : null;

  useEffect(() => {
    setImgError(false);
  }, [cleanAvatarUrl]);

  // Determine fallback character or icon
  const getFallback = () => {
    const raw = (name || '').trim();
    // If name contains letters, use the first letter as initial (e.g. "H" for Himalay, "V" for Vinod)
    const match = raw.match(/[a-zA-Z]/);
    if (match) {
      return {
        type: 'letter',
        value: match[0].toUpperCase(),
      };
    }
    // If only numbers/symbols (like phone number +91-9527...), show clean user icon
    return { type: 'icon' };
  };

  const fallback = getFallback();

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-24 h-24 text-3xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-12 h-12',
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;
  const currentIconSize = iconSizes[size] || iconSizes.md;

  return (
    <div
      className={`rounded-full overflow-hidden shrink-0 flex items-center justify-center relative select-none bg-emerald-100 text-emerald-800 font-bold ${currentSizeClass} ${className}`}
    >
      {cleanAvatarUrl && !imgError ? (
        <img
          src={cleanAvatarUrl}
          alt=""
          onError={() => setImgError(true)}
          className="w-full h-full object-cover rounded-full"
        />
      ) : fallback.type === 'letter' ? (
        <span className="leading-none">{fallback.value}</span>
      ) : (
        <User className={`${currentIconSize} text-emerald-700 stroke-[2]`} />
      )}
    </div>
  );
}
