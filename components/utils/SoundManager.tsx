
import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

type SoundType = 'hover' | 'click' | 'type' | 'success' | 'error' | 'boot';

interface SoundContextType {
  playSound: (type: SoundType) => void;
  isMuted: boolean;
  toggleMute: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export const useSound = () => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
};

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMuted, setIsMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastTypeSound = useRef<number>(0);

  // Initialize Audio Context on first user interaction
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      // Safely attempt to resume, ignoring errors if user hasn't interacted yet
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  const playTone = (freq: number, type: OscillatorType, duration: number, vol: number = 0.1) => {
    if (isMuted || !audioCtxRef.current) return;
    
    // Ensure we are in a running state before playing
    if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
        return;
    }

    try {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
        
        gain.gain.setValueAtTime(vol, audioCtxRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);

        osc.start();
        osc.stop(audioCtxRef.current.currentTime + duration);
    } catch(e) {
        // Ignore playback errors
    }
  };

  const playSound = useCallback((type: SoundType) => {
    initAudio(); 
    
    switch (type) {
      case 'hover':
        playTone(800, 'sine', 0.03, 0.02);
        break;
      case 'click':
        playTone(300, 'square', 0.05, 0.05);
        break;
      case 'type':
        const now = Date.now();
        if (now - lastTypeSound.current > 50) {
            playTone(600, 'triangle', 0.02, 0.03);
            lastTypeSound.current = now;
        }
        break;
      case 'success':
        if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
            const now = audioCtxRef.current.currentTime;
            const osc = audioCtxRef.current.createOscillator();
            const gain = audioCtxRef.current.createGain();
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.connect(gain);
            gain.connect(audioCtxRef.current.destination);
            osc.start();
            osc.stop(now + 0.3);
        }
        break;
      case 'error':
        playTone(150, 'sawtooth', 0.3, 0.1);
        break;
      case 'boot':
        if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
            const now = audioCtxRef.current.currentTime;
            const osc = audioCtxRef.current.createOscillator();
            const gain = audioCtxRef.current.createGain();
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(1000, now + 0.5);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 1.0);
            osc.connect(gain);
            gain.connect(audioCtxRef.current.destination);
            osc.start();
            osc.stop(now + 1.0);
        }
        break;
    }
  }, [isMuted, initAudio]);

  const toggleMute = () => setIsMuted(!isMuted);

  return (
    <SoundContext.Provider value={{ playSound, isMuted, toggleMute }}>
      {children}
    </SoundContext.Provider>
  );
};
