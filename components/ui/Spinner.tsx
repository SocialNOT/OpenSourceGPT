
import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md' }) => {
  return (
    <div className="inline-flex items-center space-x-1 font-mono text-[#00ff41]">
      <span className="animate-pulse">[</span>
      <span className="animate-[pulse_1s_ease-in-out_infinite]">|||||</span>
      <span className="animate-pulse">]</span>
    </div>
  );
};
