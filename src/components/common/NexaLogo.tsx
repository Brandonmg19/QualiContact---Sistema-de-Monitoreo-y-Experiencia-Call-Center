import React from 'react';

interface NexaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const NexaLogo: React.FC<NexaLogoProps> = ({ size = 'md', className = '' }) => {
  const dimensions =
    size === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : size === 'lg'
      ? 'w-14 h-14 rounded-2xl'
      : 'w-10 h-10 rounded-xl';

  return (
    <img
      src="/nexa-cx-logo.svg"
      alt="NEXA-CX"
      className={`${dimensions} object-cover shrink-0 shadow-xs border border-slate-200/80 bg-white ${className}`}
    />
  );
};
