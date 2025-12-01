import React from 'react';
import { View } from '../types';
import { ChatBubbleLeftRightIcon, CodeBracketIcon, PhotoIcon, SparklesIcon, SpeakerWaveIcon } from './icons';
import { useSound } from './utils/SoundManager';

interface BottomNavProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const NavItem: React.FC<{
  viewName: View;
  icon: React.ReactNode;
  label: string;
  currentView: View;
  onClick: (view: View) => void;
}> = ({ viewName, icon, label, currentView, onClick }) => {
  const isActive = currentView === viewName;
  const { playSound } = useSound();
  
  return (
    <button
      onClick={() => { onClick(viewName); playSound('click'); }}
      onMouseEnter={() => playSound('hover')}
      className={`flex flex-col items-center justify-center w-full py-3 border-r border-dim last:border-r-0 transition-colors duration-0 ${
        isActive 
            ? 'bg-primary text-inv' 
            : 'bg-bg text-dim hover:text-primary hover:bg-panel'
      }`}
    >
      <div className="mb-1">
        {icon}
      </div>
      <span className="text-xs font-bold uppercase tracking-tighter">
        {label}
      </span>
    </button>
  );
};

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, setCurrentView }) => {
  return (
    <nav className="flex-shrink-0 border-t-2 border-primary bg-bg z-50 safe-area-bottom transition-colors">
      <div className="flex w-full">
        <NavItem viewName="chat" label="COMM_LINK" icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />} currentView={currentView} onClick={setCurrentView} />
        <NavItem viewName="imageGen" label="VIS_SYNTH" icon={<PhotoIcon className="w-5 h-5" />} currentView={currentView} onClick={setCurrentView} />
        <NavItem viewName="imageEdit" label="IMG_MANIP" icon={<SparklesIcon className="w-5 h-5" />} currentView={currentView} onClick={setCurrentView} />
        <NavItem viewName="ide" label="DEV_CONSOLE" icon={<CodeBracketIcon className="w-5 h-5" />} currentView={currentView} onClick={setCurrentView} />
        <NavItem viewName="liveTalk" label="VOICE_NET" icon={<SpeakerWaveIcon className="w-5 h-5" />} currentView={currentView} onClick={setCurrentView} />
      </div>
    </nav>
  );
};