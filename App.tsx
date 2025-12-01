
import React, { useState, useEffect } from 'react';
import { BottomNav } from './components/BottomNav';
import { ChatView } from './components/views/ChatView';
import { ImageGenView } from './components/views/ImageGenView';
import { IdeView } from './components/views/IdeView';
import { LiveTalkView } from './components/views/LiveTalkView';
import { ImageEditView } from './components/views/ImageEditView';
import { View } from './types';
import { SoundProvider, useSound } from './components/utils/SoundManager';
import { SpeakerWaveIcon, ShieldCheckIcon, SunIcon, MoonIcon } from './components/icons';
import { BootSequence } from './components/ui/BootSequence';

const StatusHeader: React.FC<{ theme: string; toggleTheme: () => void }> = ({ theme, toggleTheme }) => {
    const { isMuted, toggleMute } = useSound();
    
    return (
        <header className="flex-none h-10 bg-bg border-b-2 border-dim z-20 flex items-center px-4 justify-between shrink-0 transition-colors duration-300">
            <div className="text-[10px] text-primary font-bold tracking-widest truncate">
                <span>SocialNOT // DEV: </span>
                <a 
                    href="https://github.com/SocialNOT" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline hover:text-inv transition-colors"
                >
                    RAJIB_SINGH
                </a>
            </div>
            <div className="flex items-center gap-4 shrink-0">
                 {/* Theme Toggle */}
                <button onClick={toggleTheme} className="text-primary hover:text-inv transition-colors" title="Toggle Theme">
                    {theme === 'light' ? (
                        <MoonIcon className="w-4 h-4" />
                    ) : (
                        <SunIcon className="w-4 h-4" />
                    )}
                </button>

                {/* Sound Toggle */}
                <button onClick={toggleMute} className="text-primary hover:text-inv">
                    {isMuted ? (
                        <span className="text-[10px] uppercase text-alert font-bold">MUTE</span>
                    ) : (
                        <SpeakerWaveIcon className="w-4 h-4" />
                    )}
                </button>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    <span className="text-[10px] text-primary font-bold tracking-widest hidden md:inline">v2.5.0-STABLE</span>
                </div>
            </div>
        </header>
    );
};

const ApiKeyError: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-screen bg-bg text-alert font-mono p-4 text-center">
        <ShieldCheckIcon className="w-16 h-16 mb-4 animate-pulse" />
        <h1 className="text-2xl font-bold mb-2">SYSTEM LOCKDOWN</h1>
        <p className="text-sm mb-6 max-w-md text-primary">
            CRITICAL ERROR: API_KEY_MISSING.<br/>
            The neural link cannot be established without a valid Gemini API key.
        </p>
        <div className="border border-alert p-4 bg-alert/10 max-w-lg text-left text-xs text-primary">
            <p className="font-bold mb-2">TROUBLESHOOTING:</p>
            <ol className="list-decimal list-inside space-y-1">
                <li>Check your <code className="bg-panel px-1">.env</code> file or Vercel Environment Variables.</li>
                <li>Ensure <code className="bg-panel px-1">GEMINI_API_KEY</code> is set to a valid key from AI Studio.</li>
                <li>Redeploy or restart the application.</li>
            </ol>
        </div>
    </div>
);

const MainLayout: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>('chat');
    const { playSound } = useSound();
    const [theme, setTheme] = useState('light');
    const [isBooting, setIsBooting] = useState(true);

    // Load theme from storage
    useEffect(() => {
        try {
            const savedTheme = localStorage.getItem('app_theme') || 'light';
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        } catch(e) {
            console.warn("Storage access denied");
        }
    }, []);
    
    // Check if user has seen boot sequence before in this session
    useEffect(() => {
        if (sessionStorage.getItem('boot_shown')) {
            setIsBooting(false);
        }
    }, []);

    const toggleTheme = () => {
        playSound('click');
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        try {
            localStorage.setItem('app_theme', newTheme);
        } catch(e) {}
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const handleBootComplete = () => {
        setIsBooting(false);
        playSound('boot');
        sessionStorage.setItem('boot_shown', 'true');
    };

    // Check for API Key availability
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey.includes("Paste_Your_Key")) {
        return <ApiKeyError />;
    }
    
    if (isBooting) {
        return <BootSequence onComplete={handleBootComplete} />;
    }

    const renderView = () => {
        switch (currentView) {
        case 'chat':
            return <ChatView />;
        case 'imageGen':
            return <ImageGenView />;
        case 'ide':
            return <IdeView />;
        case 'imageEdit':
            return <ImageEditView />;
        case 'liveTalk':
            return <LiveTalkView />;
        default:
            return <ChatView />;
        }
    };

    return (
        <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-bg relative text-primary font-mono selection:bg-primary selection:text-inv transition-colors duration-300">
            <div className="crt-grid"></div>
            
            <StatusHeader theme={theme} toggleTheme={toggleTheme} />
            
            <main className="flex-1 flex flex-col relative z-10 overflow-hidden min-h-0 w-full max-w-7xl mx-auto">
                {renderView()}
            </main>
            
            <BottomNav currentView={currentView} setCurrentView={setCurrentView} />
        </div>
    );
};

const App: React.FC = () => {
  return (
    <SoundProvider>
        <MainLayout />
    </SoundProvider>
  );
};

export default App;
