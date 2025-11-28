
import React from 'react';
import { View } from '../types';
import { ChatBubbleLeftRightIcon, PhotoIcon, SparklesIcon, SpeakerWaveIcon, CodeBracketIcon } from './icons';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const NavItem: React.FC<{
  viewName: View;
  label: string;
  icon: React.ReactNode;
  currentView: View;
  onClick: (view: View) => void;
}> = ({ viewName, label, icon, currentView, onClick }) => {
  const isActive = currentView === viewName;
  return (
    <button
      onClick={() => onClick(viewName)}
      className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {icon}
      <span className="ml-3">{label}</span>
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  return (
    <aside className="w-64 flex-shrink-0 bg-gray-800 p-4 flex flex-col">
      <div className="flex items-center mb-8">
        <SparklesIcon className="w-8 h-8 text-blue-400" />
        <h1 className="ml-2 text-xl font-bold text-white">SocialNOT</h1>
      </div>
      <nav className="flex flex-col space-y-2">
        <NavItem viewName="chat" label="AI Chat" icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />} currentView={currentView} onClick={setCurrentView} />
        <NavItem viewName="imageGen" label="Image Generation" icon={<PhotoIcon className="w-6 h-6" />} currentView={currentView} onClick={setCurrentView} />
        <NavItem viewName="imageEdit" label="Image Editing" icon={<SparklesIcon className="w-6 h-6" />} currentView={currentView} onClick={setCurrentView} />
        <NavItem viewName="ide" label="IDE" icon={<CodeBracketIcon className="w-6 h-6" />} currentView={currentView} onClick={setCurrentView} />
        <NavItem viewName="liveTalk" label="Live Conversation" icon={<SpeakerWaveIcon className="w-6 h-6" />} currentView={currentView} onClick={setCurrentView} />
      </nav>
      <div className="mt-auto text-center text-gray-500 text-xs">
        <p>Powered by Google Gemini</p>
      </div>
    </aside>
  );
};
