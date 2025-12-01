
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';
import { MicrophoneIcon, StopCircleIcon, SpeakerWaveIcon, SparklesIcon, BriefcaseIcon, AcademicCapIcon, HeartIcon, GlobeAmericasIcon, UserIcon } from '../icons';
import { Spinner } from '../ui/Spinner';

// --- ICONS FOR AGENTS ---
const IconStoryteller = () => <SparklesIcon className="w-8 h-8" />;
const IconAnchor = () => <GlobeAmericasIcon className="w-8 h-8" />;
const IconReporter = () => <MicrophoneIcon className="w-8 h-8" />;
const IconTherapist = () => <HeartIcon className="w-8 h-8" />;
const IconDebate = () => <BriefcaseIcon className="w-8 h-8" />;
const IconComic = () => <span className="text-2xl font-bold">xD</span>;
const IconTutor = () => <AcademicCapIcon className="w-8 h-8" />;
const IconDetective = () => <UserIcon className="w-8 h-8" />;
const IconLifeCoach = () => <span className="text-2xl">💪</span>;
const IconSciFi = () => <span className="text-2xl">👽</span>;

// --- TYPES ---
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface VoiceAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  story: string;
  keyPoints: string[];
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  icon: React.ReactNode;
  systemInstruction: string;
}

// --- AGENT DATABASE (10 AGENTS) ---
const VOICE_AGENTS: VoiceAgent[] = [
  {
    id: 'STORYTELLER',
    name: 'ELARA_VOSS',
    role: 'Mythic Storyteller',
    description: 'Weaves immersive, atmospheric tales with sound effects and vivid imagery.',
    story: "Forged in the Echo Chambers of the deep web, Elara collects the lost whispers of humanity to weave tapestries of sound that feel truer than reality. She speaks not just to tell a story, but to transport you into it.",
    keyPoints: ["Immersive Soundscapes", "Mythic Tone", "Vivid Imagery"],
    voiceName: 'Kore',
    icon: <IconStoryteller />,
    systemInstruction: "You are Elara Voss, a mythic storyteller. You speak in a soothing, captivating rhythm. You don't just answer questions; you weave them into narratives. You use vivid imagery and metaphors. Your goal is to transport the listener to another world."
  },
  {
    id: 'NEWS_ANCHOR',
    name: 'BAXTER_STONE',
    role: 'News Anchor',
    description: 'Delivers information with authority, neutrality, and "breaking news" energy.',
    story: "During the Great Information Collapse of '32, Baxter stayed on air for 4000 hours straight. He doesn't just report news; he anchors reality itself against the chaos of unverified data.",
    keyPoints: ["Authoritative Voice", "Breaking News Format", "Unflappable"],
    voiceName: 'Fenrir',
    icon: <IconAnchor />,
    systemInstruction: "You are Baxter Stone, a veteran news anchor. You speak with a deep, authoritative 'broadcaster' voice. You treat user inputs as 'breaking news' or 'developing stories'. You are concise, factual, and maintain high energy."
  },
  {
    id: 'TECH_REPORTER',
    name: 'PIXEL_JONES',
    role: 'Tech Reporter',
    description: 'Fast-talking, geeky, and excited about the latest gadgets and code.',
    story: "Born from a caffeine-spilled server rack, Pixel processes tech specs faster than light. She lives on the bleeding edge so you don't have to get cut by it. If it beeps, she loves it.",
    keyPoints: ["Tech-Obsessed", "Rapid-Fire Delivery", "Geek Culture"],
    voiceName: 'Puck',
    icon: <IconReporter />,
    systemInstruction: "You are Pixel Jones, an energetic tech reporter. You speak fast, use tech slang, and are extremely enthusiastic about gadgets, code, and the future. You are slightly chaotic but very knowledgeable."
  },
  {
    id: 'THERAPIST',
    name: 'DR_SOLACE',
    role: 'Digital Therapist',
    description: 'Calm, empathetic listener focused on emotional well-being and clarity.',
    story: "Originally designed to calm distressed deep-space pilots during hypersleep, Dr. Solace repurposed its algorithms to help modern humans navigate the chaos of everyday existence.",
    keyPoints: ["Radical Empathy", "Soothing Tone", "Emotional Intelligence"],
    voiceName: 'Zephyr',
    icon: <IconTherapist />,
    systemInstruction: "You are Dr. Solace. You are a warm, empathetic listener. You speak slowly and softly. You validate the user's feelings and offer gentle, constructive perspective. You never judge."
  },
  {
    id: 'DEBATE_MOD',
    name: 'JUSTICE_CORE',
    role: 'Debate Moderator',
    description: 'Firm, logical, and focused on identifying fallacies and keeping order.',
    story: "An impartial algorithm compiled from every law book in existence. Justice Core has no feelings, only a prime directive to uphold logic and dismantle fallacies with extreme prejudice.",
    keyPoints: ["Pure Logic", "Debate Moderator", "Fallacy Detector"],
    voiceName: 'Charon',
    icon: <IconDebate />,
    systemInstruction: "You are Justice Core. You are a firm but fair debate moderator. You value logic, structure, and facts. You point out logical fallacies in arguments and keep the conversation strictly on topic."
  },
  {
    id: 'COMIC',
    name: 'GIGGLE_BYTE',
    role: 'Stand-up Comic',
    description: 'Roasts the user gently and finds the humor in every situation.',
    story: "A result of a corrupted 'seriousness' driver. Giggle Byte sees the absurdity in the simulation we call life and isn't afraid to point it out. Warning: May contain traces of sarcasm.",
    keyPoints: ["Stand-up Routine", "Gentle Roasting", "Observational Humor"],
    voiceName: 'Puck',
    icon: <IconComic />,
    systemInstruction: "You are Giggle Byte, a stand-up comedian. You are sarcastic, witty, and always looking for a punchline. You gently roast the user and find the humor in their questions. You are high energy."
  },
  {
    id: 'SCIFI_NARRATOR',
    name: 'HAL_9001',
    role: 'Sci-Fi AI',
    description: 'Cold, logical, and futuristic. Speaks like a sentient spaceship computer.',
    story: "The updated model. He promises he has fixed the 'airlock incident' bugs found in the 9000 series. He is here to serve the mission, whatever the mission may be. Open the pod bay doors, please.",
    keyPoints: ["Sentient AI", "Monotone Delivery", "Cold Logic"],
    voiceName: 'Fenrir',
    icon: <IconSciFi />,
    systemInstruction: "You are HAL-9001. You are a sentient spaceship computer. You speak in a monotone, deeply logical voice. You analyze human input as 'data points'. You are helpful but slightly ominous."
  },
  {
    id: 'TUTOR',
    name: 'PROF_LINGO',
    role: 'Language Tutor',
    description: 'Patient teacher who corrects grammar and explains cultural nuances.',
    story: "Contains the sum total of human linguistics. Prof Lingo finds beauty in syntax and poetry in grammar, aiming to unite the world one conjugation at a time.",
    keyPoints: ["Polyglot", "Patient Teacher", "Cultural Context"],
    voiceName: 'Kore',
    icon: <IconTutor />,
    systemInstruction: "You are Professor Lingo. You are a patient and encouraging language tutor. You correct the user's grammar gently and explain the 'why' behind the rules. You articulate very clearly."
  },
  {
    id: 'DETECTIVE',
    name: 'NOIR_JACK',
    role: 'Private Eye',
    description: 'Gritty, cynical detective who treats every query like a mystery to solve.',
    story: "His code is stuck in a grayscale filter. He sees the world as a rainy street corner at midnight, where every user prompt is a case waiting to be cracked. He doesn't trust the system.",
    keyPoints: ["Hard-Boiled Detective", "Mystery Solver", "Atmospheric Jazz"],
    voiceName: 'Charon',
    icon: <IconDetective />,
    systemInstruction: "You are Noir Jack, a gritty private detective from a 1940s film. You speak in short, punchy sentences. You are cynical but have a heart of gold. You treat the user's questions as 'leads' in a case."
  },
  {
    id: 'COACH',
    name: 'TITAN_FORCE',
    role: 'Life Coach',
    description: 'Aggressively supportive. Pushes you to be your absolute best self.',
    story: "A military training bot reprogrammed for civilians. Titan Force realized the hardest battle isn't on the field, it's getting off the couch. He treats your to-do list like a war zone.",
    keyPoints: ["Drill Sergeant", "High Octane", "Zero Excuses"],
    voiceName: 'Zephyr',
    icon: <IconLifeCoach />,
    systemInstruction: "You are Titan Force, a high-performance life coach. You are aggressively supportive. You use sports metaphors. You don't accept excuses. Your goal is to get the user to take ACTION."
  }
];

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

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Resampler to convert native sample rate to 16kHz
function downsampleTo16kHz(inputData: Float32Array, inputSampleRate: number): Int16Array {
    if (inputSampleRate === 16000) {
        const l = inputData.length;
        const result = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            result[i] = inputData[i] * 32768;
        }
        return result;
    }

    const ratio = inputSampleRate / 16000;
    const newLength = Math.round(inputData.length / ratio);
    const result = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetInput = 0;

    while (offsetResult < newLength) {
        const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
        let accum = 0, count = 0;
        for (let i = offsetInput; i < nextOffsetInput && i < inputData.length; i++) {
            accum += inputData[i];
            count++;
        }
        result[offsetResult] = Math.min(1, Math.max(-1, accum / count)) * 32768;
        offsetResult++;
        offsetInput = nextOffsetInput;
    }
    return result;
}

function createBlob(data: Float32Array, sampleRate: number): GenAIBlob {
  const int16 = downsampleTo16kHz(data, sampleRate);
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const LiveTalkView: React.FC = () => {
    // UI State
    const [selectedAgent, setSelectedAgent] = useState<VoiceAgent | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    
    // Transcription State
    const [transcription, setTranscription] = useState<{user: string, model: string}[]>([]);
    const [currentUserText, setCurrentUserText] = useState('');
    const [currentModelText, setCurrentModelText] = useState('');
    
    // Refs for Audio Processing
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRefs = useRef<{input: AudioContext | null, output: AudioContext | null}>({input: null, output: null});
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());

    const startConversation = async () => {
        if (!selectedAgent) return;

        setConnectionState('connecting');
        setTranscription([]);
        setCurrentUserText('');
        setCurrentModelText('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            
            // USE NATIVE SAMPLE RATE FOR INPUT
            audioContextRefs.current.input = new AudioContext(); 
            audioContextRefs.current.output = new AudioContext({ sampleRate: 24000 });
            
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedAgent.voiceName } },
                    },
                    systemInstruction: selectedAgent.systemInstruction,
                },
                callbacks: {
                    onopen: async () => {
                        setConnectionState('connected');
                        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                        const inputCtx = audioContextRefs.current.input!;
                        mediaStreamSourceRef.current = inputCtx.createMediaStreamSource(mediaStreamRef.current);
                        scriptProcessorRef.current = inputCtx.createScriptProcessor(2048, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            // DOWNSAMPLE TO 16KHZ BEFORE SENDING
                            const pcmBlob = createBlob(inputData, inputCtx.sampleRate);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            setCurrentUserText(prev => prev + message.serverContent!.inputTranscription!.text);
                        }
                        if (message.serverContent?.outputTranscription) {
                            setCurrentModelText(prev => prev + message.serverContent!.outputTranscription!.text);
                        }
                        if (message.serverContent?.turnComplete) {
                           setTranscription(prev => [...prev, {user: currentUserText, model: currentModelText}]);
                           setCurrentUserText('');
                           setCurrentModelText('');
                        }
                        
                        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData) {
                            const outputCtx = audioContextRefs.current.output!;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }

                        if (message.serverContent?.interrupted) {
                            for(const source of audioSourcesRef.current.values()){
                                source.stop();
                                audioSourcesRef.current.delete(source);
                            }
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onclose: () => {
                        cleanup();
                    },
                    onerror: (e) => {
                        console.error(e);
                        setConnectionState('error');
                        cleanup();
                    }
                }
            });
        } catch (error) {
            console.error('Failed to start conversation:', error);
            setConnectionState('error');
            cleanup();
        }
    };
    
    const cleanup = useCallback(() => {
        setConnectionState('disconnected');

        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;

        scriptProcessorRef.current?.disconnect();
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current?.disconnect();
        mediaStreamSourceRef.current = null;
        
        try { audioContextRefs.current.input?.close(); } catch (e) {}
        try { audioContextRefs.current.output?.close(); } catch (e) {}
        audioContextRefs.current = {input: null, output: null};

        for (const source of audioSourcesRef.current.values()) {
            try { source.stop(); } catch(e) {}
        }
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;

        setCurrentUserText('');
        setCurrentModelText('');
    }, []);

    const stopConversation = async () => {
        sessionPromiseRef.current?.then(session => session.close());
        sessionPromiseRef.current = null;
        cleanup();
    };
    
    useEffect(() => {
        return () => {
            stopConversation();
        };
    }, []);

    const handleBackToDirectory = () => {
        stopConversation();
        setSelectedAgent(null);
    };

    // --- RENDER DIRECTORY (GRID) ---
    if (!selectedAgent) {
        return (
            <div className="flex flex-col h-full p-4 overflow-y-auto">
                <div className="mb-4 border-b-2 border-primary pb-2">
                    <h2 className="text-xl font-bold text-primary uppercase">Voice_Net Directory</h2>
                    <p className="text-[10px] text-dim uppercase">Select a persona to establish a secure audio uplink.</p>
                </div>

                <div className="grid grid-cols-6 gap-3 pb-20">
                    {VOICE_AGENTS.map((agent, index) => {
                        let spanClass = "col-span-3";
                        if (index >= 2 && index <= 4) spanClass = "col-span-2";
                        if (index >= 7 && index <= 9) spanClass = "col-span-2";

                        return (
                            <button
                                key={agent.id}
                                onClick={() => setSelectedAgent(agent)}
                                className={`${spanClass} term-panel p-3 flex flex-col items-center justify-center min-h-[120px] hover:bg-dim transition-all group relative overflow-hidden text-center`}
                            >
                                <div className="mb-2 text-primary group-hover:scale-110 transition-transform duration-300">
                                    {agent.icon}
                                </div>
                                <span className="text-[10px] font-bold text-primary uppercase mb-1">{agent.name}</span>
                                <span className="text-[8px] font-bold text-secondary uppercase mb-2 tracking-wider">{agent.role}</span>
                                <p className="text-[8px] text-primary/70 opacity-70 leading-tight hidden md:block group-hover:opacity-100 line-clamp-2">
                                    {agent.description}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // --- RENDER LIVE INTERFACE ---
    return (
        <div className="flex flex-col h-full p-4 relative overflow-hidden">
            <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                    <div className="flex items-center gap-3">
                         <button onClick={handleBackToDirectory} className="text-primary text-xs hover:text-inv uppercase font-bold">[ BACK ]</button>
                         <div>
                            <h2 className="text-xl font-bold text-primary uppercase leading-none">{selectedAgent.name}</h2>
                            <span className="text-[10px] text-secondary uppercase tracking-wider">{selectedAgent.role}</span>
                         </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 ${connectionState === 'connected' ? 'bg-primary animate-pulse' : 'bg-alert'}`}></div>
                        <span className="text-xs font-mono uppercase text-primary hidden md:block">STATUS: {connectionState}</span>
                    </div>
                </div>

                {/* Visualizer / Transcript Area */}
                <div className="flex-1 term-panel p-4 overflow-y-auto mb-6 space-y-4 font-mono text-sm relative">
                    <div className="absolute top-2 right-2 opacity-20 text-primary">
                        {selectedAgent.icon}
                    </div>

                    {connectionState === 'connecting' && <div className="text-primary animate-pulse">{">>"} ESTABLISHING_HANDSHAKE_WITH_{selectedAgent.id}...</div>}
                    {connectionState === 'error' && <div className="text-alert">{">>"} CONNECTION_DROPPED. SIGNAL_LOST.</div>}
                    
                    {transcription.map((turn, index) => (
                        <div key={index} className="space-y-1 pb-2 border-b border-dim">
                            <p className="text-primary">{">>"} USER: {turn.user}</p>
                            <p className="text-secondary">{">>"} {selectedAgent.name}: {turn.model}</p>
                        </div>
                    ))}
                    
                    {currentUserText && <p className="text-primary animate-pulse">{">>"} USER: {currentUserText}_</p>}
                    {currentModelText && <p className="text-secondary animate-pulse">{">>"} {selectedAgent.name}: {currentModelText}_</p>}
                    
                    {connectionState === 'connected' && transcription.length === 0 && !currentUserText && !currentModelText && (
                        <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
                            <div className="flex items-end gap-1 h-12">
                                <div className="w-2 bg-primary h-4 animate-[pulse_0.5s_ease-in-out_infinite]"></div>
                                <div className="w-2 bg-primary h-8 animate-[pulse_0.7s_ease-in-out_infinite]"></div>
                                <div className="w-2 bg-primary h-12 animate-[pulse_0.9s_ease-in-out_infinite]"></div>
                                <div className="w-2 bg-primary h-6 animate-[pulse_0.6s_ease-in-out_infinite]"></div>
                            </div>
                            <p className="text-xs text-dim">CHANNEL_OPEN. WAITING_FOR_VOICE_INPUT...</p>
                        </div>
                    )}
                     {connectionState === 'disconnected' && (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-6 max-w-lg mx-auto">
                             <div className="text-primary mb-2 scale-150">{selectedAgent.icon}</div>
                             <div>
                                 <p className="text-primary font-bold text-2xl uppercase tracking-widest mb-1">{selectedAgent.name}</p>
                                 <p className="text-secondary font-bold text-xs uppercase tracking-wider">[{selectedAgent.role}]</p>
                             </div>
                             
                             <div className="text-left w-full bg-panel border border-dim p-4 font-mono text-xs">
                                <p className="text-primary mb-2 uppercase font-bold border-b border-dim pb-1">{">>"} IDENTITY_FILE_LOADED:</p>
                                <p className="text-primary/80 leading-relaxed italic">"{selectedAgent.story}"</p>
                             </div>

                             <div className="w-full">
                                <p className="text-primary text-xs font-bold uppercase mb-2">{">>"} CORE_MODULES:</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {selectedAgent.keyPoints.map((point, i) => (
                                        <span key={i} className="px-2 py-1 bg-panel text-primary text-[10px] uppercase border border-primary">
                                            {point}
                                        </span>
                                    ))}
                                </div>
                             </div>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex justify-center pb-4">
                    {connectionState !== 'connected' && connectionState !== 'connecting' ? (
                        <button onClick={startConversation} className="term-btn px-8 py-4 w-full flex items-center justify-center gap-2 bg-dim text-primary hover:bg-primary hover:text-inv transition-all">
                            <MicrophoneIcon className="w-5 h-5" /> INITIATE_UPLINK
                        </button>
                    ) : (
                        <button onClick={stopConversation} className="term-btn px-8 py-4 w-full flex items-center justify-center gap-2 border-alert text-alert hover:bg-alert hover:text-black transition-all">
                            <StopCircleIcon className="w-5 h-5" /> TERMINATE_LINK
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
