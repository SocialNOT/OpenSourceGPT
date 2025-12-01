
import React, { useEffect, useState } from 'react';

interface BootSequenceProps {
  onComplete: () => void;
}

export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const SEQUENCE = [
    { text: "INITIALIZING NEURAL LINK...", delay: 500 },
    { text: "LOADING KERNEL MODULES... [OK]", delay: 1200 },
    { text: "ESTABLISHING SECURE UPLINK...", delay: 2000 },
    { text: "MOUNTING FILE SYSTEM... [OK]", delay: 2800 },
    { text: "CALIBRATING SENSORS... [OK]", delay: 3500 },
    { text: "ACCESS GRANTED. WELCOME USER.", delay: 4200 },
  ];

  useEffect(() => {
    let timeouts: number[] = [];

    // Line sequence
    SEQUENCE.forEach(({ text, delay }) => {
      const t = window.setTimeout(() => {
        setLines(prev => [...prev, text]);
      }, delay);
      timeouts.push(t);
    });

    // Progress bar
    const progressInterval = window.setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return p + Math.random() * 5;
      });
    }, 150);

    // Completion
    const completeTimeout = window.setTimeout(onComplete, 4800);
    timeouts.push(completeTimeout);

    return () => {
      timeouts.forEach(clearTimeout);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center font-mono text-[#00ff41] p-8">
      <div className="w-full max-w-lg space-y-4">
        <div className="border-b-2 border-[#00ff41] pb-2 mb-8">
          <h1 className="text-2xl font-bold tracking-widest">SOCIAL_NOT // BIOS v2.5</h1>
        </div>
        
        <div className="space-y-2 h-40">
          {lines.map((line, i) => (
            <div key={i} className="text-sm font-bold animate-[fadeIn_0.1s_ease-out]">
              {`> ${line}`}
            </div>
          ))}
          <div className="animate-pulse text-sm font-bold">_</div>
        </div>

        <div className="mt-8">
          <div className="flex justify-between text-xs mb-1">
             <span>SYSTEM_LOAD</span>
             <span>{Math.min(100, Math.floor(progress))}%</span>
          </div>
          <div className="w-full h-4 border-2 border-[#00ff41] p-0.5">
             <div 
               className="h-full bg-[#00ff41] transition-all duration-100 ease-out"
               style={{ width: `${Math.min(100, progress)}%` }}
             ></div>
          </div>
        </div>
      </div>
    </div>
  );
};
