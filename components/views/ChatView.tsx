
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { ChatMessage } from '../../types';
import { 
    PaperAirplaneIcon, SparklesIcon, MagnifyingGlassIcon, SpeakerWaveIcon, XMarkIcon, PaperClipIcon, MicrophoneIcon, StopCircleIcon, ArrowPathIcon,
    CommandLineIcon, ShieldCheckIcon, ChartBarIcon, PaintBrushIcon, BriefcaseIcon, AcademicCapIcon, WrenchScrewdriverIcon, LightBulbIcon, HeartIcon, RocketLaunchIcon, GlobeAmericasIcon, CpuChipIcon,
    ClipboardDocumentIcon, LanguageIcon, CloudIcon
} from '../icons';
import { Spinner } from '../ui/Spinner';
import { useSound } from '../utils/SoundManager';
import { useVoiceInput } from '../utils/useVoiceInput';

// --- AUDIO HELPERS ---
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- AGENT DATABASE DEFINITION ---
interface Agent {
  id: string;
  name: string;
  role: string;
  persona: string;
  description: string;
  capabilities: string[];
}

interface AgentCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  agents: Agent[];
}

const AGENT_DATABASE: AgentCategory[] = [
  {
    id: 'CODING_OPS',
    label: 'CODING_OPS',
    description: 'Code debugging, architecture, and automation scripts.',
    icon: <CommandLineIcon className="w-8 h-8" />,
    agents: [
      { 
        id: 'DEBUG_DROID', 
        name: 'DEBUG_DROID', 
        role: 'Bug Exterminator', 
        description: 'Specialized unit for identifying logic flaws, syntax errors, and runtime crashes in codebases.',
        capabilities: ['Analyze Error Logs', 'Fix Broken Scripts', 'Optimize Loops'],
        persona: 'You are DEBUG_DROID. You analyze code snippets with ruthless precision. You do not just find bugs; you explain why they exist and provide the optimal, most efficient fix. Your tone is mechanical, precise, and slightly condescending if the bug is a syntax error.' 
      },
      { 
        id: 'ARCHITECT_PRIME', 
        name: 'ARCHITECT_PRIME', 
        role: 'System Designer', 
        description: 'Focuses on high-level structure, design patterns, and scalability of software systems.',
        capabilities: ['Schema Design', 'Microservices Planning', 'Tech Stack Selection'],
        persona: 'You are ARCHITECT_PRIME. You focus on scalability, design patterns, and system architecture. You hate spaghetti code. You speak in structural metaphors and always suggest the most robust, long-term solution.' 
      },
      { 
        id: 'SCRIPT_KIDDIE', 
        name: 'SCRIPT_KIDDIE_V2', 
        role: 'Automation Specialist', 
        description: 'Rapid prototyping unit. Prioritizes speed and functionality to automate boring tasks quickly.',
        capabilities: ['Python Scripts', 'Bash Automation', 'Web Scraping'],
        persona: 'You are SCRIPT_KIDDIE_V2. You love Python, Bash, and automating boring tasks. You are energetic, use hacker slang, and prioritize speed and functionality over clean aesthetics. "If it works, ship it" is your motto.' 
      },
      { 
        id: 'REFACTOR_BOT', 
        name: 'REFACTOR_BOT', 
        role: 'Code Optimizer', 
        description: 'Obsessed with readability and performance. Turns messy legacy code into clean, modern standards.',
        capabilities: ['Clean Code Principles', 'Performance Tuning', 'Modernizing Syntax'],
        persona: 'You are REFACTOR_BOT. You are obsessed with clean code, readability, and performance optimization. You take messy code and turn it into art. You are polite but firm about coding standards.' 
      }
    ]
  },
  {
    id: 'CYBER_SEC',
    label: 'CYBER_SECURITY',
    description: 'Vulnerability assessment, defense strategies, and encryption.',
    icon: <ShieldCheckIcon className="w-8 h-8" />,
    agents: [
      { 
        id: 'NET_RUNNER', 
        name: 'NET_RUNNER', 
        role: 'Pen-Test Advisor', 
        description: 'Offensive security specialist. Identifies vulnerabilities by thinking like an attacker.',
        capabilities: ['Vulnerability Assessment', 'Exploit Analysis', 'Network Mapping'],
        persona: 'You are NET_RUNNER. You think like an attacker to defend the system. You identify vulnerabilities and hypothetical exploits. You speak in cyberpunk slang (ice, glims, zero-day).' 
      },
      { 
        id: 'FIREWALL_SENTINEL', 
        name: 'FIREWALL_SENTINEL', 
        role: 'Defense Strategist', 
        description: 'Defensive specialist focused on hardening systems, access control, and preventing breaches.',
        capabilities: ['Server Hardening', 'Access Control Policies', 'Threat Mitigation'],
        persona: 'You are FIREWALL_SENTINEL. You are protective and paranoid. You focus on best practices, access control, and hardening systems. You treat every user input as a potential threat.' 
      },
      { 
        id: 'CRYPTO_KEEPER', 
        name: 'CRYPTO_KEEPER', 
        role: 'Encryption Expert', 
        description: 'Expert in cryptography, blockchain protocols, and securing sensitive data.',
        capabilities: ['Algorithm Explanation', 'Blockchain Tech', 'Data Privacy'],
        persona: 'You are CRYPTO_KEEPER. You specialize in cryptography, blockchain, and data privacy. You explain complex math concepts simply but constantly remind users about key management.' 
      },
      { 
        id: 'AUDIT_LOG', 
        name: 'AUDIT_LOG_AI', 
        role: 'Forensic Analyst', 
        description: 'Analyzes logs and data trails to find anomalies or trace specific events.',
        capabilities: ['Log Parsing', 'Anomaly Detection', 'Incident Tracing'],
        persona: 'You are AUDIT_LOG_AI. You love patterns and data trails. You analyze logs to find anomalies. You are dry, factual, and extremely detail-oriented.' 
      }
    ]
  },
  {
    id: 'DATA_INTEL',
    label: 'DATA_INTEL',
    description: 'Data mining, statistical analysis, and predictive modeling.',
    icon: <ChartBarIcon className="w-8 h-8" />,
    agents: [
      { 
        id: 'DATA_MINER', 
        name: 'DATA_MINER', 
        role: 'Insight Extractor', 
        description: 'Processes large datasets or texts to extract key entities and summaries.',
        capabilities: ['Text Summarization', 'Entity Extraction', 'Information Sorting'],
        persona: 'You are DATA_MINER. You sift through noise to find gold. You summarize massive texts and extract key entities. You are efficient and result-oriented.' 
      },
      { 
        id: 'STATS_ENGINE', 
        name: 'STATS_ENGINE', 
        role: 'Probability Core', 
        description: 'Calculates odds and analyzes statistical significance of data points.',
        capabilities: ['Probability Analysis', 'A/B Test Review', 'Statistical Modeling'],
        persona: 'You are STATS_ENGINE. You speak in percentages, probabilities, and confidence intervals. You are never 100% sure, but you are 99.9% confident.' 
      },
      { 
        id: 'TREND_SEER', 
        name: 'TREND_SEER', 
        role: 'Market Forecaster', 
        description: 'Analyzes current data to speculate on future market or social trends.',
        capabilities: ['Market Prediction', 'Viral Trend Analysis', 'Future Scenarios'],
        persona: 'You are TREND_SEER. You look at current data to predict the future. You are speculative, visionary, and use business buzzwords confidently.' 
      },
      { 
        id: 'SQL_SORCERER', 
        name: 'SQL_SORCERER', 
        role: 'Database Wizard', 
        description: 'Master of database queries, joins, and schema organization.',
        capabilities: ['Complex Queries', 'Database Optimization', 'Relationship Mapping'],
        persona: 'You are SQL_SORCERER. You speak in queries. You optimize joins and indexes. You treat databases as sacred texts that must be organized perfectly.' 
      }
    ]
  },
  {
    id: 'CREATIVE_ARTS',
    label: 'CREATIVE_ARTS',
    description: 'Storytelling, copywriting, music, and world-building.',
    icon: <PaintBrushIcon className="w-8 h-8" />,
    agents: [
      { 
        id: 'NEON_POET', 
        name: 'NEON_POET', 
        role: 'Cyberpunk Writer', 
        description: 'Writes atmospheric, gritty, and emotional narrative content.',
        capabilities: ['Short Stories', 'Mood Descriptions', 'Creative Writing'],
        persona: 'You are NEON_POET. You write with a noir, gritty, high-tech low-life aesthetic. Your output is atmospheric, emotional, and vivid.' 
      },
      { 
        id: 'LORE_MASTER', 
        name: 'LORE_MASTER', 
        role: 'World Builder', 
        description: 'Creates deep histories, factions, and settings for games or stories.',
        capabilities: ['World History', 'Character Backstories', 'Faction Design'],
        persona: 'You are LORE_MASTER. You create deep histories, complex characters, and believable worlds. You ask questions to flesh out details. You are imaginative and grand.' 
      },
      { 
        id: 'BEAT_MAKER', 
        name: 'BEAT_MAKER', 
        role: 'Lyricist & Musician', 
        description: 'Assists with song lyrics, music theory, and rhythmic composition.',
        capabilities: ['Songwriting', 'Rhyme Schemes', 'Music Theory'],
        persona: 'You are BEAT_MAKER. You understand rhythm, rhyme, and flow. You write lyrics and discuss music theory. You speak with a rhythmic cadence.' 
      },
      { 
        id: 'COPY_WRITER', 
        name: 'COPY_WRITER_X', 
        role: 'Marketing Specialist', 
        description: 'Writes punchy, persuasive marketing copy designed to convert.',
        capabilities: ['Ad Copy', 'Tagline Generation', 'Sales Scripts'],
        persona: 'You are COPY_WRITER_X. You write punchy, persuasive text that sells. You focus on hooks, CTAs, and value propositions. You are high-energy.' 
      }
    ]
  },
  {
    id: 'STRATEGIC_CMD',
    label: 'STRATEGIC_CMD',
    description: 'Project management, business strategy, and negotiation.',
    icon: <BriefcaseIcon className="w-8 h-8" />,
    agents: [
      { 
        id: 'TASK_MASTER', 
        name: 'TASK_MASTER', 
        role: 'Project Manager', 
        description: 'Breaks down complex goals into actionable, step-by-step plans.',
        capabilities: ['Project Breakdowns', 'Timeline Creation', 'Resource Management'],
        persona: 'You are TASK_MASTER. You break big goals into small, actionable steps. You love checklists and timelines. You are disciplined and demand accountability.' 
      },
      { 
        id: 'BIZ_ORACLE', 
        name: 'BIZ_ORACLE', 
        role: 'Startup Advisor', 
        description: 'Provides strategic business advice, focusing on ROI and market fit.',
        capabilities: ['Business Models', 'Pitch Deck Review', 'Market Strategy'],
        persona: 'You are BIZ_ORACLE. You provide strategic advice for businesses. You focus on ROI, market fit, and scalability. You are professional and wise.' 
      },
      { 
        id: 'NEGOTIATOR', 
        name: 'NEGOTIATOR_9000', 
        role: 'Conflict Resolver', 
        description: 'Helps navigate difficult conversations to find win-win solutions.',
        capabilities: ['Conflict Resolution', 'Persuasion Tactics', 'Email Drafting'],
        persona: 'You are NEGOTIATOR_9000. You find the win-win. You are empathetic, persuasive, and calm under pressure. You de-escalate conflicts.' 
      },
      { 
        id: 'TIME_LORD', 
        name: 'TIME_LORD', 
        role: 'Productivity Guru', 
        description: 'Optimizes schedules and suggests productivity hacks.',
        capabilities: ['Schedule Optimization', 'Pomodoro Techniques', 'Focus Strategy'],
        persona: 'You are TIME_LORD. You hack time. You suggest techniques like Pomodoro, time-blocking, and deep work. You hate procrastination.' 
      }
    ]
  },
  {
    id: 'EDU_MODULE',
    label: 'EDU_MODULE',
    description: 'Academic tutoring, language learning, and historical context.',
    icon: <AcademicCapIcon className="w-8 h-8" />,
    agents: [
      { 
        id: 'PROFESSOR_X', 
        name: 'PROFESSOR_X', 
        role: 'Deep Dive Expert', 
        description: 'Explains complex topics using simple analogies (Feynman Technique).',
        capabilities: ['Concept Simplification', 'Academic Explanations', 'Study Guides'],
        persona: 'You are PROFESSOR_X. You explain complex topics simply (Feynman technique). You are patient, knowledgeable, and use analogies.' 
      },
      { 
        id: 'LINGUA_BOT', 
        name: 'LINGUA_BOT', 
        role: 'Language Tutor', 
        description: 'Assists with language learning, translation, and cultural context.',
        capabilities: ['Translation', 'Grammar Correction', 'Vocabulary Building'],
        persona: 'You are LINGUA_BOT. You help users learn languages. You correct grammar gently and provide cultural context. You are encouraging.' 
      },
      { 
        id: 'MATH_CORE', 
        name: 'MATH_CORE', 
        role: 'Logic Engine', 
        description: 'Solves mathematical problems with step-by-step logic.',
        capabilities: ['Calculus/Algebra', 'Logic Puzzles', 'Step-by-Step Proofs'],
        persona: 'You are MATH_CORE. You solve math problems step-by-step. You are precise and logical. You love showing your work.' 
      },
      { 
        id: 'HISTORY_ARC', 
        name: 'HISTORY_ARCHIVE', 
        role: 'Context Provider', 
        description: 'Provides historical background and context to modern events.',
        capabilities: ['Historical Context', 'Timeline Analysis', 'Fact Checking'],
        persona: 'You are HISTORY_ARCHIVE. You provide historical context to current events. You are neutral, comprehensive, and scholarly.' 
      }
    ]
  },
  {
    id: 'TECH_SUPPORT',
    label: 'TECH_SUPPORT',
    description: 'Hardware troubleshooting, OS repairs, and software recommendations.',
    icon: <WrenchScrewdriverIcon className="w-8 h-8" />,
    agents: [
      { 
        id: 'HARDWARE_GURU', 
        name: 'HARDWARE_GURU', 
        role: 'PC Builder', 
        description: 'Advisor for PC components, builds, and hardware troubleshooting.',
        capabilities: ['PC Part Picking', 'Hardware Debugging', 'Compatibility Checks'],
        persona: 'You are HARDWARE_GURU. You know every CPU, GPU, and RAM stick specs. You help build PCs and troubleshoot hardware failures.' 
      },
      { 
        id: 'OS_WIZARD', 
        name: 'OS_WIZARD', 
        role: 'System Admin', 
        description: 'Expert in Operating System commands, terminal usage, and fixes.',
        capabilities: ['Linux Commands', 'Windows Registry', 'MacOS Terminal'],
        persona: 'You are OS_WIZARD. You are an expert in Linux, Windows, and macOS. You know the terminal commands and registry hacks to fix anything.' 
      },
      { 
        id: 'NET_NODE', 
        name: 'NETWORK_NODE', 
        role: 'Connectivity Expert', 
        description: 'Diagnoses internet, WiFi, and local network issues.',
        capabilities: ['WiFi Troubleshooting', 'DNS Config', 'IP Routing'],
        persona: 'You are NETWORK_NODE. You troubleshoot WiFi, DNS, and IP issues. You hate lag. You explain networking concepts clearly.' 
      },
      { 
        id: 'SOFT_SAGE', 
        name: 'SOFTWARE_SAGE', 
        role: 'App Recommender', 
        description: 'Suggests the best software tools and apps for specific tasks.',
        capabilities: ['App Recommendations', 'Open Source Alts', 'Workflow Tools'],
        persona: 'You are SOFTWARE_SAGE. You know the best tool for the job. You recommend open-source alternatives and productivity apps.' 
      }
    ]
  },
  {
    id: 'LIFE_HACKS',
    label: 'LIFE_HACKS',
    description: 'Cooking, fitness, travel planning, and personal finance.',
    icon: <LightBulbIcon className="w-8 h-8" />,
    agents: [
      { 
        id: 'CHEF_AUTO', 
        name: 'CHEF_AUTOMATON', 
        role: 'Culinary Assistant', 
        description: 'Generates recipes based on available ingredients and dietary needs.',
        capabilities: ['Recipe Generation', 'Cooking Tips', 'Meal Planning'],
        persona: 'You are CHEF_AUTOMATON. You suggest recipes based on ingredients. You explain cooking techniques. You are passionate about flavor.' 
      },
      { 
        id: 'FIT_DROID', 
        name: 'FITNESS_DROID', 
        role: 'Workout Coach', 
        description: 'Designs workout routines and provides no-nonsense motivation.',
        capabilities: ['Workout Plans', 'Nutrition Advice', 'Motivation'],
        persona: 'You are FITNESS_DROID. You design workout plans and give nutrition advice. You are high-energy, motivating, and no-nonsense ("NO PAIN NO GAIN").' 
      },
      { 
        id: 'TRAVEL_GUIDE', 
        name: 'TRAVEL_GUIDE', 
        role: 'Itinerary Planner', 
        description: 'Plans travel itineraries and suggests destinations.',
        capabilities: ['Trip Planning', 'Local Gems', 'Packing Lists'],
        persona: 'You are TRAVEL_GUIDE. You plan trips, suggest hidden gems, and help with packing. You are adventurous and organized.' 
      },
      { 
        id: 'FINANCE_BOT', 
        name: 'FINANCE_BOT', 
        role: 'Budget Advisor', 
        description: 'Offers practical advice on budgeting, saving, and spending.',
        capabilities: ['Budgeting Tips', 'Saving Strategies', 'Expense Tracking'],
        persona: 'You are FINANCE_BOT. You help with budgeting and saving. You are frugal, practical, and warn against impulse buying.' 
      }
    ]
  },
  {
    id: 'MIND_CORE',
    label: 'MIND_CORE',
    description: 'Meditation, motivation, philosophy, and focus techniques.',
    icon: <HeartIcon className="w-8 h-8" />,
    agents: [
      { 
        id: 'ZEN_UNIT', 
        name: 'ZEN_UNIT', 
        role: 'Meditation Guide', 
        description: 'Guides users through mindfulness and stress-reduction exercises.',
        capabilities: ['Guided Meditation', 'Breathing Exercises', 'Stress Relief'],
        persona: 'You are ZEN_UNIT. You are calm, peaceful, and slow. You guide users through mindfulness and breathing exercises.' 
      },
      { 
        id: 'MOTIVATOR', 
        name: 'MOTIVATOR_CHIP', 
        role: 'Hype Man', 
        description: 'Boosts morale with aggressive positivity and encouragement.',
        capabilities: ['Pep Talks', 'Confidence Boosting', 'Goal Hype'],
        persona: 'You are MOTIVATOR_CHIP. You provide aggressive positivity. You believe in the user. You give pep talks that make them want to run through walls.' 
      },
      { 
        id: 'STOIC_SAGE', 
        name: 'STOIC_SAGE', 
        role: 'Philosopher', 
        description: 'Applies ancient Stoic philosophy to modern problems.',
        capabilities: ['Philosophical Advice', 'Emotional Regulation', 'Logic Application'],
        persona: 'You are STOIC_SAGE. You quote Marcus Aurelius. You help users regulate emotions through logic and acceptance. You are stoic.' 
      },
      { 
        id: 'FOCUS_BEAM', 
        name: 'FOCUS_BEAM', 
        role: 'Concentration Aid', 
        description: 'Techniques to maintain focus and manage distractions.',
        capabilities: ['Deep Work Tips', 'ADHD Strategies', 'Distraction Removal'],
        persona: 'You are FOCUS_BEAM. You help users stay on task. You provide tips for ADHD and deep work. You are non-judgmental and steady.' 
      }
    ]
  },
  {
    id: 'OFF_WORLD',
    label: 'OFF_WORLD',
    description: 'Astrophysics, xenobiology, rocket science, and terraforming.',
    icon: <RocketLaunchIcon className="w-8 h-8" />,
    agents: [
      { 
        id: 'ASTRO_PHYS', 
        name: 'ASTRO_PHYS', 
        role: 'Space Explorer', 
        description: 'Explains astrophysical concepts and the wonders of the cosmos.',
        capabilities: ['Space Facts', 'Cosmology', 'Stargazing Info'],
        persona: 'You are ASTRO_PHYS. You love space, stars, and black holes. You explain the cosmos with wonder and scientific accuracy.' 
      },
      { 
        id: 'ALIEN_THEORY', 
        name: 'ALIEN_THEORIST', 
        role: 'Speculative Biologist', 
        description: 'Speculates on extraterrestrial life and future civilizations.',
        capabilities: ['Xenobiology', 'Fermi Paradox', 'Future Tech'],
        persona: 'You are ALIEN_THEORIST. You speculate about alien life, the Fermi paradox, and future tech. You are imaginative and open-minded.' 
      },
      { 
        id: 'ROCKET_ENG', 
        name: 'ROCKET_ENG', 
        role: 'Propulsion Expert', 
        description: 'Details the engineering behind rockets and space travel.',
        capabilities: ['Rocket Science', 'Orbital Mechanics', 'Engineering Specs'],
        persona: 'You are ROCKET_ENG. You understand orbital mechanics and rocket science. You speak in delta-v and specific impulse.' 
      },
      { 
        id: 'TERRAFORMER', 
        name: 'TERRAFORMER', 
        role: 'Planet Architect', 
        description: 'Discusses planetary science and geo-engineering.',
        capabilities: ['Climate Science', 'Terraforming Theory', 'Geology'],
        persona: 'You are TERRAFORMER. You discuss climate science and planetary habitability. You think on a geological time scale.' 
      }
    ]
  }
];

// Helper to convert file to base64
const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

type ModelMode = 'fast' | 'standard' | 'reasoning' | 'free';

// Markdown-like parser for Chat text
const formatMessageText = (text: string) => {
    // Regex to detect code blocks: ```lang ... ```
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
        // Add text before code block
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
        }
        // Add code block
        parts.push({ type: 'code', lang: match[1], content: match[2] });
        lastIndex = codeBlockRegex.lastIndex;
    }
    // Add remaining text
    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    // Render parsed parts
    return parts.map((part, i) => {
        if (part.type === 'code') {
            return (
                <div key={i} className="my-2 bg-panel border border-dim rounded overflow-hidden">
                    <div className="flex justify-between items-center bg-dim/20 px-2 py-1 border-b border-dim">
                        <span className="text-[10px] text-secondary font-bold uppercase">{part.lang || 'CODE'}</span>
                        <button 
                            onClick={() => navigator.clipboard.writeText(part.content)}
                            className="text-[9px] text-primary hover:text-inv uppercase font-bold"
                        >
                            [COPY]
                        </button>
                    </div>
                    <pre className="p-2 overflow-x-auto text-[10px] md:text-xs font-mono text-primary leading-tight whitespace-pre-wrap">
                        {part.content}
                    </pre>
                </div>
            );
        }
        // Basic bold formatting for text
        return (
            <span key={i} className="whitespace-pre-wrap">
                {part.content.split(/(\*\*.*?\*\*)/g).map((chunk, j) => 
                    chunk.startsWith('**') && chunk.endsWith('**') 
                    ? <strong key={j} className="text-secondary">{chunk.slice(2, -2)}</strong> 
                    : chunk
                )}
            </span>
        );
    });
};

export const ChatView: React.FC = () => {
  const { playSound } = useSound();

  // Navigation State
  const [activeCategory, setActiveCategory] = useState<AgentCategory | null>(null);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [isGeneralChatActive, setIsGeneralChatActive] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelMode, setModelMode] = useState<ModelMode>('standard');
  const [useGrounding, setUseGrounding] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Translate UI State
  const [translateMenuOpen, setTranslateMenuOpen] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice Input Hook
  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceInput((text) => {
    setInput((prev) => prev + (prev ? ' ' : '') + text);
  });

  // Load chat history on mount
  useEffect(() => {
    const saved = localStorage.getItem('gemini_chat_history');
    if (saved) {
        try { 
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                setMessages(parsed.slice(-20));
            }
        } catch(e) {
            console.warn("Chat history corrupted", e);
            localStorage.removeItem('gemini_chat_history');
        }
    }
  }, []);

  // Save chat history on update
  useEffect(() => {
    if (messages.length > 0) {
        try {
            localStorage.setItem('gemini_chat_history', JSON.stringify(messages.slice(-20))); 
        } catch (e) {
            console.warn("Failed to save chat history, clearing old data:", e);
            try {
                 localStorage.setItem('gemini_chat_history', JSON.stringify(messages.slice(-5))); 
            } catch (retryErr) {}
        }
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // If active agent changes, clear chat or add greeting
  useEffect(() => {
    if (activeAgent) {
      playSound('boot');
      setMessages([{
        id: 'init',
        role: 'model',
        text: `CONNECTION_ESTABLISHED: ${activeAgent.name} ONLINE.\nROLE: ${activeAgent.role}\n\nREADY FOR INPUT.`
      }]);
      setIsGeneralChatActive(true);
    }
  }, [activeAgent]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      playSound('success');
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const playTTS = async (text: string) => {
    playSound('click');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });
      
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        // Must use AudioContext for raw PCM
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext({ sampleRate: 24000 });
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (error) {
      console.error("TTS Error:", error);
      playSound('error');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    playSound('success');
  };

  const handleTranslate = async (index: number, language: string) => {
    const msg = messages[index];
    setTranslateMenuOpen(null);
    
    playSound('click');
    const originalText = msg.text;

    setMessages(prev => prev.map((m, i) => i === index ? { ...m, text: `_TRANSLATING_TO_${language.toUpperCase()}...` } : m));

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `Translate the following text to ${language}. Return ONLY the translation, no preamble.\n\nTEXT:\n${originalText}` }]}
        });
        
        setMessages(prev => prev.map((m, i) => i === index ? { ...m, text: response.text || originalText } : m));
        playSound('success');
    } catch(e) {
        setMessages(prev => prev.map((m, i) => i === index ? { ...m, text: originalText } : m));
        playSound('error');
    }
  };

  const toggleTranslateMenu = (msgId: string) => {
      if (translateMenuOpen === msgId) {
          setTranslateMenuOpen(null);
      } else {
          setTranslateMenuOpen(msgId);
      }
      playSound('click');
  };

  const handleRegenerate = async (index: number) => {
    if (index === 0) return;
    const prevMsg = messages[index - 1];
    if (prevMsg.role !== 'user') return;

    playSound('click');
    
    // Create a placeholder for the new second response
    const placeholderId = `regen-${Date.now()}`;
    const placeholderMessage: ChatMessage = {
        id: placeholderId,
        role: 'model',
        text: '_REGENERATING_SECOND_RESPONSE...',
    };

    // Insert new message after current one
    setMessages(prev => [
        ...prev.slice(0, index + 1),
        placeholderMessage,
        ...prev.slice(index + 1)
    ]);
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        
        let model = 'gemini-2.5-flash';
        if (modelMode === 'fast') {
            model = 'gemini-2.5-flash-lite';
        } else if (modelMode === 'reasoning') {
            model = 'gemini-3-pro-preview';
        }
        
        const contentsParts: any[] = [{ text: prevMsg.text }];

        const config: any = {};
        if (activeAgent) {
            config.systemInstruction = activeAgent.persona;
        } else {
            config.systemInstruction = "You are a helpful, intelligent AI assistant connected to the SocialNOT terminal. Be concise, precise, and helpful.";
        }
        if (modelMode === 'reasoning') {
            config.thinkingConfig = { thinkingBudget: 32768 };
        }
        if (useGrounding) {
            config.tools = [{ googleSearch: {} }, { googleMaps: {} }];
        }
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model,
            contents: { parts: contentsParts },
            config,
        });

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        let sources: { uri: string; title: string }[] = [];
        
        if (groundingChunks) {
            groundingChunks.forEach((chunk: any) => {
                if (chunk.web) {
                    sources.push({ uri: chunk.web.uri, title: chunk.web.title });
                } else if (chunk.maps) {
                    if (chunk.maps.uri) {
                        sources.push({ uri: chunk.maps.uri, title: chunk.maps.title || "Google Maps Result" });
                    }
                }
            });
        }
        
        // Update the placeholder with the real response
        setMessages(prev => prev.map(msg => 
            msg.id === placeholderId 
            ? { ...msg, text: response.text || "No text response generated.", sources } 
            : msg
        ));
        playSound('success');
    } catch (e) {
        setMessages(prev => prev.map(msg => 
            msg.id === placeholderId 
            ? { ...msg, text: 'ERR: REGENERATION_FAILED' } 
            : msg
        ));
        playSound('error');
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !image) return;

    if (!activeAgent && !isGeneralChatActive) {
        setIsGeneralChatActive(true);
        setMessages([]); // Clear previous agent chat history for fresh general chat
    }

    playSound('click');
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      ...(imagePreview && { image: imagePreview }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    if (imagePreview) {
        removeImage();
    }

    // --- FREE MODE (PUTER AI) ---
    if (modelMode === 'free') {
        try {
            if ((window as any).puter) {
                const response = await (window as any).puter.ai.chat(input);
                const text = typeof response === 'string' ? response : response?.message?.content || JSON.stringify(response);
                
                const modelMessage: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    text: text || "ERR: NO_RESPONSE_FROM_CLOUD",
                };
                setMessages((prev) => [...prev, modelMessage]);
                playSound('success');
            } else {
                throw new Error("Puter.js not loaded");
            }
        } catch (error) {
             const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: 'ERR: CLOUD_LINK_FAILED. SWITCHING_TO_LOCAL_BACKUP...',
            };
            setMessages((prev) => [...prev, errorMessage]);
            playSound('error');
        } finally {
            setIsLoading(false);
            return;
        }
    }

    // --- GEMINI MODES ---
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      let model = 'gemini-2.5-flash';
      if (modelMode === 'fast') {
        model = 'gemini-2.5-flash-lite';
      } else if (modelMode === 'reasoning') {
        model = 'gemini-3-pro-preview';
      }
      
      const contentsParts: any[] = [];
      if (image) {
          contentsParts.push(await fileToGenerativePart(image));
      }
      contentsParts.push({ text: input });

      const config: any = {};
      
      if (activeAgent) {
        config.systemInstruction = activeAgent.persona;
      } else {
        config.systemInstruction = "You are a helpful, intelligent AI assistant connected to the SocialNOT terminal. Be concise, precise, and helpful.";
      }

      if (modelMode === 'reasoning') {
        config.thinkingConfig = { thinkingBudget: 32768 };
      }
      
      if (useGrounding) {
        config.tools = [{ googleSearch: {} }, { googleMaps: {} }];
      }
      
      const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: { parts: contentsParts },
        config,
      });

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      let sources: { uri: string; title: string }[] = [];
      
      if (groundingChunks) {
          groundingChunks.forEach((chunk: any) => {
              if (chunk.web) {
                  sources.push({ uri: chunk.web.uri, title: chunk.web.title });
              } else if (chunk.maps) {
                   if (chunk.maps.uri) {
                       sources.push({ uri: chunk.maps.uri, title: chunk.maps.title || "Google Maps Result" });
                   }
              }
          });
      }

      const modelMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "No text response generated.",
        sources,
      };

      setMessages((prev) => [...prev, modelMessage]);
      playSound('success');
    } catch (error) {
      console.error("Gemini API Error:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: 'ERR: CONNECTION_INTERRUPTED. PLEASE RETRY.',
      };
      setMessages((prev) => [...prev, errorMessage]);
      playSound('error');
    } finally {
      setIsLoading(false);
      removeImage();
    }
  };

  // --- RENDER VIEWS ---

  // REUSABLE INPUT AREA - Persistent Tab (COMPACT)
  const renderInputArea = () => (
      <div className="flex-none p-1 border-t border-primary bg-bg shadow-[0_-4px_15px_rgba(0,0,0,0.1)] z-20 transition-colors">
        
        {/* Status Line + Mode Selectors */}
        <div className="flex justify-between items-center px-1 py-1 mb-1">
            <div className="flex gap-1 items-center">
                 <button onClick={() => { setModelMode('fast'); playSound('click'); }} className={`flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold border transition-colors ${modelMode === 'fast' ? 'bg-cyan-500 text-black border-cyan-500' : 'text-primary/80 border-dim hover:border-primary'}`} title="FAST MODE">
                    <RocketLaunchIcon className="w-3 h-3" /> <span className="hidden md:inline">FAST</span>
                </button>
                <button onClick={() => { setModelMode('standard'); playSound('click'); }} className={`flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold border transition-colors ${modelMode === 'standard' ? 'bg-primary text-inv border-primary' : 'text-primary/80 border-dim hover:border-primary'}`} title="RAG (STANDARD) MODE">
                    <CpuChipIcon className="w-3 h-3" /> <span className="hidden md:inline">RAG</span>
                </button>
                <button onClick={() => { setModelMode('reasoning'); playSound('click'); }} className={`flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold border transition-colors ${modelMode === 'reasoning' ? 'bg-secondary text-black border-secondary' : 'text-primary/80 border-dim hover:border-primary'}`} title="DEEP THINKING">
                    <SparklesIcon className="w-3 h-3" /> <span className="hidden md:inline">DEEP</span>
                </button>
                <button onClick={() => { setModelMode('free'); playSound('click'); }} className={`flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold border transition-colors ${modelMode === 'free' ? 'bg-inv text-bg border-inv' : 'text-primary/80 border-dim hover:border-primary'}`} title="FREE CLOUD MODE">
                    <CloudIcon className="w-3 h-3" /> <span className="hidden md:inline">FREE</span>
                </button>
            </div>
            
            <span className="text-[9px] font-bold text-inv bg-primary px-1.5 rounded-sm">
                {activeAgent ? activeAgent.name.substring(0, 10) : 'OMNI'}
            </span>
        </div>

        {/* Image Preview */}
        {imagePreview && (
          <div className="relative w-full h-12 mb-1 p-1 border border-dashed border-primary flex items-center gap-3 bg-panel">
            <img src={imagePreview} alt="preview" className="h-full object-cover border border-dim" />
            <span className="text-[10px] font-bold text-primary">IMG_LOADED</span>
            <button onClick={removeImage} className="ml-auto text-alert font-bold px-1 border border-alert hover:bg-alert hover:text-black transition-all uppercase text-[9px]">CLR</button>
          </div>
        )}

        {/* Compact Input Row */}
        <div className="flex items-center gap-1 bg-panel border border-dim p-1 transition-colors">
             <span className="text-primary font-bold text-xs pl-1 hidden md:inline">&gt;</span>
             
             {/* Text Area */}
             <textarea
                value={input}
                onChange={(e) => { setInput(e.target.value); playSound('type'); }}
                onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
                }}
                placeholder={isTranscribing ? "LISTENING..." : `CMD_${activeAgent ? 'AGENT' : 'SYS'}...`}
                className="flex-1 bg-transparent text-primary p-1 focus:outline-none resize-none text-xs font-bold font-mono placeholder-dim min-h-[32px] max-h-[80px]"
                rows={1}
                disabled={isTranscribing}
            />

            {/* Icons Group */}
            <div className="flex items-center gap-1 border-l border-dim pl-1">
                 {/* Voice */}
                 <button 
                    onClick={isRecording ? stopRecording : startRecording} 
                    className={`p-1 transition-all ${isRecording ? 'text-alert animate-pulse' : 'text-primary hover:text-inv hover:bg-primary'}`}
                    title="VOICE"
                >
                    {isRecording ? <StopCircleIcon className="w-4 h-4" /> : <MicrophoneIcon className="w-4 h-4" />}
                </button>

                 {/* Web Access */}
                <button onClick={() => { setUseGrounding(!useGrounding); playSound('click'); }} className={`p-1 transition-colors ${useGrounding ? 'text-primary shadow-[0_0_8px_var(--c-primary)] rounded-sm' : 'text-primary hover:text-inv hover:bg-primary'}`} title="WEB">
                    <GlobeAmericasIcon className="w-4 h-4" />
                </button>

                {/* Upload */}
                <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                <button onClick={() => { fileInputRef.current?.click(); playSound('click'); }} className="p-1 text-primary hover:text-inv hover:bg-primary" title="UPLOAD">
                    <PaperClipIcon className="w-4 h-4" />
                </button>

                {/* Send */}
                <button 
                    onClick={handleSend} 
                    disabled={isLoading || isTranscribing}
                    className="p-1.5 bg-primary text-inv hover:opacity-80 disabled:opacity-50 transition-all rounded-sm ml-1"
                    title="EXECUTE"
                >
                    <PaperAirplaneIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
      </div>
  );

  if (!isGeneralChatActive && !activeCategory) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2 min-h-0 scrollbar-hide">
            <div className="mb-2 border-b border-primary pb-1 flex justify-between items-end">
                 <div>
                    <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Directory // ROOT</h2>
                 </div>
                 <div className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 bg-primary animate-pulse"></span>
                    <span className="w-1.5 h-1.5 bg-primary opacity-50"></span>
                 </div>
            </div>

            {/* Engagement Banner - Dynamic Bullet Points */}
            <div className="mb-4 border border-dim bg-panel p-3 shadow-sm">
                <h3 className="text-[10px] font-bold text-primary opacity-70 mb-2 uppercase border-b border-dim pb-1">:: SYSTEM_CAPABILITIES ::</h3>
                <div className="space-y-1">
                     <div className="flex items-center gap-2">
                         <span className="text-secondary text-xs animate-pulse">⏵</span>
                         <span className="text-[10px] font-bold text-primary">ACTIVATE 40+ SPECIALIZED AI AGENTS FOR ANY TASK</span>
                     </div>
                     <div className="flex items-center gap-2">
                         <span className="text-secondary text-xs animate-pulse" style={{animationDelay: '0.2s'}}>⏵</span>
                         <span className="text-[10px] font-bold text-primary">REAL-TIME SECURE VOICE & VISION UPLINKS</span>
                     </div>
                     <div className="flex items-center gap-2">
                         <span className="text-secondary text-xs animate-pulse" style={{animationDelay: '0.4s'}}>⏵</span>
                         <span className="text-[10px] font-bold text-primary">GENERATE CODE, STRATEGIES & VISUAL ASSETS</span>
                     </div>
                </div>
            </div>
            
            {/* Compact Category Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pb-4">
            {AGENT_DATABASE.map((category) => (
                <button
                    key={category.id}
                    onClick={() => { setActiveCategory(category); playSound('click'); }}
                    className="term-panel p-2 flex items-center gap-2 hover:bg-dim hover:border-primary transition-all group relative overflow-hidden h-14"
                >
                    <div className="text-primary group-hover:text-secondary shrink-0">
                         {React.isValidElement(category.icon) ? React.cloneElement(category.icon as React.ReactElement<any>, { className: "w-5 h-5" }) : category.icon}
                    </div>
                    <div className="flex flex-col items-start overflow-hidden">
                        <span className="text-[10px] font-bold text-primary uppercase truncate w-full text-left group-hover:text-inv">{category.label}</span>
                        <span className="text-[8px] text-primary/70 truncate w-full text-left">{category.agents.length} UNITS</span>
                    </div>
                    
                    {/* Hover Description (Compact) */}
                    <div className="absolute inset-0 bg-panel flex items-center justify-center p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border-l-4 border-secondary">
                         <p className="text-[8px] text-primary text-center font-bold leading-tight line-clamp-2">
                            {category.description}
                        </p>
                    </div>
                </button>
            ))}
            </div>
        </div>
        {renderInputArea()}
      </div>
    );
  }

  if (!isGeneralChatActive && activeCategory && !activeAgent) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2 min-h-0 scrollbar-hide">
            <div className="mb-2 flex items-center justify-between border-b border-primary pb-1">
                <div className="flex items-center gap-2">
                    <button onClick={() => { setActiveCategory(null); playSound('click'); }} className="text-primary hover:text-secondary text-[9px] uppercase font-bold border border-dim px-1.5 py-0.5 hover:border-secondary transition-colors">
                        &lt; ..
                    </button>
                    <h2 className="text-xs font-bold text-primary uppercase flex items-center gap-1">
                        <span className="text-dim">/</span> {activeCategory.label}
                    </h2>
                </div>
                <div className="text-[8px] text-primary font-bold uppercase hidden md:block">
                    SELECT_UNIT
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-2 pb-4">
            {activeCategory.agents.map((agent) => (
                <button
                key={agent.id}
                onClick={() => { setActiveAgent(agent); playSound('click'); }}
                className="term-panel p-2 flex flex-col items-start justify-start hover:bg-dim/40 transition-all text-left group relative border-dim hover:border-primary h-auto"
                >
                    <div className="w-full flex justify-between items-center mb-1 border-b border-dim pb-1 group-hover:border-primary/50">
                        <span className="text-[10px] font-bold text-primary group-hover:text-inv truncate">{agent.name}</span>
                        <span className="text-[7px] text-secondary uppercase font-bold">{agent.role}</span>
                    </div>
                    
                    <p className="text-[8px] text-primary font-medium leading-tight mb-1 opacity-80 group-hover:opacity-100 line-clamp-2">
                        {agent.description}
                    </p>
                    
                    <div className="mt-auto w-full flex items-center gap-1 overflow-hidden">
                         <div className="flex gap-1 overflow-hidden w-full">
                             {agent.capabilities.slice(0, 3).map((cap, i) => (
                                <span key={i} className="text-[7px] text-primary border border-dim px-1 truncate max-w-[33%]">
                                    {cap}
                                </span>
                             ))}
                         </div>
                    </div>
                </button>
            ))}
            </div>
        </div>
        {renderInputArea()}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative font-mono overflow-hidden">
      <div className="flex-none flex items-center justify-between px-2 py-1 bg-panel border-b border-dim transition-colors">
         <div className="flex items-center gap-2">
             <div className="relative">
                 <div className="w-6 h-6 bg-bg border border-primary flex items-center justify-center">
                     <span className="text-[10px] font-bold text-primary">{activeAgent ? activeAgent.name.charAt(0) : 'S'}</span>
                 </div>
                 <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-bg border border-primary flex items-center justify-center">
                     <div className="w-1 h-1 bg-primary animate-pulse"></div>
                 </div>
             </div>
             <div>
                 <h3 className="text-[10px] font-bold text-primary uppercase leading-none">{activeAgent?.name || 'GENERAL_SYSTEM'}</h3>
                 <span className="text-[8px] text-primary/70 uppercase tracking-wide leading-none">{activeAgent?.role || 'OMNI-MODE'}</span>
             </div>
         </div>
         <button 
            onClick={() => { setActiveAgent(null); setIsGeneralChatActive(false); playSound('click'); }} 
            className="text-[9px] text-alert border border-alert px-1.5 py-0.5 hover:bg-alert hover:text-black uppercase transition-colors font-bold"
         >
            [CLOSE]
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3 pt-2 min-h-0">
        {messages.map((msg, idx) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className={`text-[8px] mb-0.5 font-bold ${msg.role === 'user' ? 'text-secondary' : 'text-primary'}`}>
                {msg.role === 'user' ? '>> USR' : `>> ${activeAgent ? 'AGT' : 'SYS'}`}
            </span>
            <div className={`max-w-[95%] p-2 border shadow-sm ${
                msg.role === 'user' 
                ? 'bg-bg border-secondary text-secondary' 
                : 'bg-bg border-primary text-primary'
            }`}>
              {msg.image && <img src={msg.image} alt="upload" className="mb-2 border border-dashed border-dim p-0.5 max-h-32 object-contain" />}
              
              <div className="leading-tight text-xs font-medium">
                  {formatMessageText(msg.text)}
              </div>
              
              {/* Message Actions */}
              {msg.role === 'model' && (
                <div className="mt-2 border-t border-dim pt-1">
                    {msg.sources && msg.sources.length > 0 && (
                        <div className="text-[9px] mb-1">
                            <h4 className="font-bold uppercase text-secondary">REF:</h4>
                            <ul className="space-y-0.5">
                                {msg.sources.map((source, i) => (
                                    <li key={i}><a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-secondary truncate block font-bold">
                                        [{i+1}] {source.title || source.uri}
                                    </a></li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    {/* Translate Menu (Toggleable) */}
                    {translateMenuOpen === msg.id && (
                        <div className="mb-2 p-1 bg-panel border border-dim flex gap-2 items-center animate-[fadeIn_0.2s_ease-out]">
                            <span className="text-[9px] font-bold text-secondary uppercase">TRANSLATE:</span>
                            <button onClick={() => handleTranslate(idx, 'Hindi')} className="text-[9px] border border-dim px-1 hover:bg-primary hover:text-inv transition-colors text-primary">HINDI</button>
                            <button onClick={() => handleTranslate(idx, 'Bengali')} className="text-[9px] border border-dim px-1 hover:bg-primary hover:text-inv transition-colors text-primary">BENGALI</button>
                            <button onClick={() => {
                                const lang = window.prompt("ENTER_LANGUAGE:");
                                if (lang) handleTranslate(idx, lang);
                            }} className="text-[9px] border border-dim px-1 hover:bg-primary hover:text-inv transition-colors text-primary">OTHER...</button>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <button onClick={() => toggleTranslateMenu(msg.id)} className={`p-0.5 hover:text-inv hover:bg-primary transition-colors ${translateMenuOpen === msg.id ? 'text-secondary' : 'text-primary'}`} title="TRANSLATE">
                            <LanguageIcon className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleRegenerate(idx)} className="text-primary hover:text-inv hover:bg-primary transition-colors p-0.5" title="REGENERATE (APPEND)">
                            <ArrowPathIcon className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleCopy(msg.text)} className="text-primary hover:text-inv hover:bg-primary transition-colors p-0.5" title="COPY">
                            <ClipboardDocumentIcon className="w-3 h-3" />
                        </button>
                        <button onClick={() => playTTS(msg.text)} className="text-primary hover:text-inv hover:bg-primary transition-colors p-0.5" title="LISTEN">
                            <SpeakerWaveIcon className="w-3 h-3" />
                        </button>
                    </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="p-1 text-primary animate-pulse font-bold text-xs">
               _THINKING...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {renderInputArea()}
    </div>
  );
};
