
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Spinner } from '../ui/Spinner';
import { SparklesIcon, ArrowPathIcon, FilmIcon, PhotoIcon, TrashIcon, MicrophoneIcon, StopCircleIcon } from '../icons';
import { useSound } from '../utils/SoundManager';
import { useVoiceInput } from '../utils/useVoiceInput';

type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";
type ImageSize = "1K" | "2K" | "4K";
type BatchSize = 1 | 2 | 4;

const PROMPT_TEMPLATES = [
  { label: "REALISTIC", prompt: "Photorealistic image of [SUBJECT], 8k resolution, cinematic lighting, highly detailed, shot on DSLR" },
  { label: "3D_RENDER", prompt: "3D render of [SUBJECT], unreal engine 5, octane render, volumetric lighting, 4k, clean composition" },
  { label: "CARTOON", prompt: "Cartoon style illustration of [SUBJECT], vibrant colors, thick outlines, flat shading, playful character design" },
  { label: "SKETCH", prompt: "Pencil sketch of [SUBJECT], rough charcoal lines, graphite texture, artistic shading, white background" },
  { label: "WATERCOLOR", prompt: "Watercolor painting of [SUBJECT], soft pastel colors, wet-on-wet technique, artistic splatter, textured paper" },
  { label: "OIL_PAINT", prompt: "Oil painting of [SUBJECT], textured brushstrokes, classical composition, dramatic lighting, masterpiece" },
  { label: "PIXEL_ART", prompt: "Pixel art of [SUBJECT], 16-bit style, retro game aesthetic, limited color palette, clean dithering" },
  { label: "ANIME", prompt: "Anime style illustration of [SUBJECT], studio ghibli inspired, vibrant colors, detailed background, emotional atmosphere" },
];

const CAMERA_OPTIONS = ["DSLR", "Cinematic", "Wide Angle", "Telephoto", "Macro", "Polaroid", "Drone", "Fisheye"];
const ANGLE_OPTIONS = ["Eye Level", "Low Angle", "High Angle", "Bird's Eye", "Dutch Angle", "Over-the-Shoulder"];
const LIGHTING_OPTIONS = ["Natural", "Studio", "Neon", "Golden Hour", "Dark/Moody", "Volumetric", "Cyberpunk", "Bioluminescent"];
const MOVEMENT_OPTIONS = ["Static", "Motion Blur", "High Speed", "Slow Motion", "Freeze Frame"];

export const ImageGenView: React.FC = () => {
  const { playSound } = useSound();

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [batchSize, setBatchSize] = useState<BatchSize>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedBatch, setGeneratedBatch] = useState<string[]>([]);
  const [isUpscaling, setIsUpscaling] = useState(false);
  
  const [history, setHistory] = useState<string[]>([]);

  const [isGifMode, setIsGifMode] = useState(false);
  const [gifFrames, setGifFrames] = useState<string[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [fps, setFps] = useState(4);
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advCamera, setAdvCamera] = useState('');
  const [advAngle, setAdvAngle] = useState('');
  const [advLighting, setAdvLighting] = useState('');
  const [advMovement, setAdvMovement] = useState('');
  const [advLocation, setAdvLocation] = useState('');

  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceInput((text) => {
    setPrompt((prev) => prev + (prev ? ' ' : '') + text);
  });

  useEffect(() => {
    const saved = localStorage.getItem('gemini_img_history');
    if (saved) {
        try { 
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                setHistory(parsed.slice(0, 3));
            }
        } catch(e) {
            console.warn("Corrupted history", e);
            localStorage.removeItem('gemini_img_history');
        }
    }
  }, []);

  const saveToHistory = (images: string[]) => {
      // Reduce history to max 3 items to avoid 5MB quota limits on mobile
      const newHistory = [...images, ...history].slice(0, 3);
      setHistory(newHistory);
      
      try {
        localStorage.setItem('gemini_img_history', JSON.stringify(newHistory));
      } catch (err) {
        console.warn('Storage quota exceeded, history not saved to disk', err);
      }
  };

  const clearHistory = () => {
      setHistory([]);
      localStorage.removeItem('gemini_img_history');
      playSound('click');
  };

  useEffect(() => {
    let interval: number;
    if (gifFrames.length > 0 && fps > 0) {
        interval = window.setInterval(() => {
            setCurrentFrameIndex(prev => (prev + 1) % gifFrames.length);
        }, 1000 / fps);
    }
    return () => clearInterval(interval);
  }, [gifFrames, fps]);

  const getFullPrompt = () => {
      const parts = [prompt];
      if (advCamera) parts.push(`shot on ${advCamera}`);
      if (advAngle) parts.push(`${advAngle} view`);
      if (advLighting) parts.push(`${advLighting} lighting`);
      if (advMovement) parts.push(`${advMovement}`);
      if (advLocation) parts.push(`set in ${advLocation}`);
      return parts.join(', ');
  };

  const getPollinationsUrl = (prompt: string, seed: number) => {
      let width = 1024;
      let height = 1024;
      
      switch (aspectRatio) {
          case '1:1': width = 1024; height = 1024; break;
          case '16:9': width = 1280; height = 720; break;
          case '9:16': width = 720; height = 1280; break;
          case '4:3': width = 1024; height = 768; break;
          case '3:4': width = 768; height = 1024; break;
          case '2:3': width = 768; height = 1152; break;
          case '3:2': width = 1152; height = 768; break;
          case '21:9': width = 1280; height = 549; break;
      }

      const encodedPrompt = encodeURIComponent(prompt);
      return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;
  };

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('INPUT_ERROR: PROMPT_EMPTY');
      playSound('error');
      return;
    }

    playSound('click');
    setIsLoading(true);
    setIsUpscaling(false);
    setError(null);
    setGeneratedImage(null);
    setGeneratedBatch([]);
    setGifFrames([]); 

    const finalPrompt = getFullPrompt();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    const singleGenerate = async (seed: number): Promise<string | null> => {
        // Helper to generate using 'generateContent' models (Flash/Pro)
        const tryGenerateContent = async (model: string, config: any) => {
            const response = await ai.models.generateContent({
                model,
                contents: { parts: [{ text: finalPrompt }] },
                config: { ...config, seed },
            });
            
            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        const base64EncodeString = part.inlineData.data;
                        const mimeType = part.inlineData.mimeType || 'image/png';
                        return `data:${mimeType};base64,${base64EncodeString}`;
                    }
                }
            }
            return null;
        };

        // Helper to generate using 'generateImages' models (Imagen)
        const tryGenerateImages = async (model: string) => {
             const response = await ai.models.generateImages({
                model,
                prompt: finalPrompt,
                config: {
                    numberOfImages: 1,
                    aspectRatio: aspectRatio,
                    outputMimeType: 'image/jpeg'
                }
             });
             if (response.generatedImages?.[0]?.image?.imageBytes) {
                 return `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
             }
             return null;
        };

        // --- GENERATION FALLBACK CHAIN ---
        try {
            // Attempt 1: Gemini 3 Pro Image (High Quality / Aspect Ratio / Size Support)
            return await tryGenerateContent('gemini-3-pro-image-preview', {
                imageConfig: { aspectRatio: aspectRatio, imageSize: imageSize },
            });
        } catch (err: any) {
            console.warn("Pro model failed, attempting fallback to Flash...", err);
            try {
                // Attempt 2: Gemini 2.5 Flash Image (Fast / Aspect Ratio)
                return await tryGenerateContent('gemini-2.5-flash-image', {
                    imageConfig: { aspectRatio: aspectRatio },
                });
            } catch (flashErr: any) {
                 console.warn("Flash model failed, attempting fallback to experimental...", flashErr);
                 try {
                    // Attempt 3: Gemini 2.0 Flash Experimental (Backup bucket)
                    return await tryGenerateContent('gemini-2.0-flash-exp', {
                        imageConfig: { aspectRatio: aspectRatio },
                    });
                } catch (fallbackErr: any) {
                    console.warn("Experimental model failed, attempting fallback to Imagen...", fallbackErr);
                    try {
                        // Attempt 4: Imagen 3.0 (Separate Quota Bucket)
                        return await tryGenerateImages('imagen-3.0-generate-001');
                    } catch(imagenErr: any) {
                         console.error("Imagen failed, trying Pollinations AI...", imagenErr);
                         try {
                            // Attempt 5: Pollinations AI (Free / Unlimited)
                            const url = getPollinationsUrl(finalPrompt, seed);
                            // Fetch to verify it works (and convert to blob if needed, or just use URL)
                            const resp = await fetch(url);
                            if (resp.ok) {
                                const blob = await resp.blob();
                                return new Promise((resolve) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => resolve(reader.result as string);
                                    reader.readAsDataURL(blob);
                                });
                            }
                            return null;
                         } catch (finalErr) {
                            return null;
                         }
                    }
                }
            }
        }
    };

    try {
        const promises = Array(batchSize).fill(0).map((_, i) => {
            const seed = Math.floor(Math.random() * 2147483647);
            return singleGenerate(seed);
        });

        const results = await Promise.all(promises);
        const validImages = results.filter(img => img !== null) as string[];

        if (validImages.length > 0) {
            setGeneratedBatch(validImages);
            setGeneratedImage(validImages[0]);
            saveToHistory(validImages);
            playSound('success');
        } else {
            throw new Error("GENERATION_ABORTED: ALL_MODELS_FAILED");
        }

    } catch (err: any) {
        setError(`CRITICAL_FAILURE: ${err.message || 'UNKNOWN_ERROR'}`);
        playSound('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSequence = async () => {
    if (!prompt.trim()) {
        setError('INPUT_ERROR: PROMPT_EMPTY');
        playSound('error');
        return;
    }

    playSound('click');
    setIsLoading(true);
    setGifFrames([]);
    setError(null);
    setGeneratedImage(null);

    const finalPrompt = getFullPrompt();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const frameCount = 4;

    try {
        const requests = Array(frameCount).fill(0).map((_, i) => {
             const seed = Math.floor(Math.random() * 2147483647);
             return ai.models.generateContent({
                model: 'gemini-2.5-flash-image', // Stick to flash for sequences for speed
                contents: { parts: [{ text: finalPrompt }] },
                config: {
                    imageConfig: { aspectRatio },
                    seed: seed 
                }
             }).then(resp => {
                 const part = resp.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                 if(part && part.inlineData) {
                     return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                 }
                 return null;
             }).catch(e => null);
        });

        const results = await Promise.all(requests);
        const validFrames = results.filter(f => f !== null) as string[];
        
        if (validFrames.length > 0) {
            setGifFrames(validFrames);
            setCurrentFrameIndex(0);
            playSound('success');
        } else {
            throw new Error("Failed to generate sequence frames.");
        }
    } catch (err: any) {
        setError(`SEQ_ERR: ${err.message}`);
        playSound('error');
    } finally {
        setIsLoading(false);
    }
  };

  const handleUpscale = async () => {
    if (!generatedImage || !prompt) return;

    playSound('click');
    setIsLoading(true);
    setIsUpscaling(true);
    setError(null);
    
    const finalPrompt = getFullPrompt() + ", higher resolution, enhanced details, 4k";

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const base64Data = generatedImage.split(',')[1];
        const mimeType = generatedImage.substring(generatedImage.indexOf(':') + 1, generatedImage.indexOf(';'));

        // Use Pro model for upscaling if possible for best details
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview', 
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType } },
                    { text: finalPrompt }
                ]
            },
            config: {
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: '4K' // Request 4K explicitly
                }
            }
        });

        let newImageUrl = null;
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64EncodeString = part.inlineData.data;
                    const mt = part.inlineData.mimeType || 'image/png';
                    newImageUrl = `data:${mt};base64,${base64EncodeString}`;
                }
            }
        }

        if (newImageUrl) {
            setGeneratedImage(newImageUrl);
            const index = generatedBatch.indexOf(generatedImage);
            if (index !== -1) {
                const newBatch = [...generatedBatch];
                newBatch[index] = newImageUrl;
                setGeneratedBatch(newBatch);
                saveToHistory([newImageUrl]);
            } else {
                setGeneratedBatch([newImageUrl]);
            }
            setImageSize('4K');
            playSound('success');
        } else {
            throw new Error("Upscaling failed.");
        }

    } catch (e: any) {
        console.warn("Pro upscale failed, trying Flash", e);
        try {
            // Fallback to Flash upscale
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
             const base64Data = generatedImage.split(',')[1];
             const mimeType = generatedImage.substring(generatedImage.indexOf(':') + 1, generatedImage.indexOf(';'));
             const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { data: base64Data, mimeType } },
                        { text: finalPrompt }
                    ]
                }
            });
             
            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        const base64EncodeString = part.inlineData.data;
                        const mt = part.inlineData.mimeType || 'image/png';
                         const img = `data:${mt};base64,${base64EncodeString}`;
                         setGeneratedImage(img);
                         setImageSize('2K'); // Flash roughly output 2K
                         return;
                    }
                }
            }
        } catch (fallbackErr) {
             setError("SYS_ERR: UPSCALE_REJECTED");
             playSound('error');
        }
    } finally {
        setIsLoading(false);
        setIsUpscaling(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto relative">
      <div className="max-w-4xl mx-auto w-full pb-20">
        <div className="flex justify-between items-center mb-4 border-b-2 border-primary pb-2">
            <h2 className="text-xl font-bold text-primary uppercase">
                // VISUAL_SYNTHESIS
            </h2>
            <div className="flex gap-2">
                <button 
                    onClick={() => { setActiveTab('create'); playSound('click'); }} 
                    className={`text-xs font-bold px-3 py-1 transition-colors ${activeTab === 'create' ? 'bg-primary text-inv' : 'text-dim hover:bg-dim/10 hover:text-primary'}`}
                >
                    CREATE
                </button>
                <button 
                    onClick={() => { setActiveTab('history'); playSound('click'); }} 
                    className={`text-xs font-bold px-3 py-1 transition-colors ${activeTab === 'history' ? 'bg-primary text-inv' : 'text-dim hover:bg-dim/10 hover:text-primary'}`}
                >
                    HISTORY
                </button>
            </div>
        </div>
        
        {activeTab === 'create' ? (
        <div className="term-panel p-4 mb-6">
          <div className="space-y-4">
             {/* Mode Selector */}
             <div className="flex flex-col md:flex-row border-b border-dim pb-2 gap-2 md:gap-4">
                <button 
                    onClick={() => { setIsGifMode(false); playSound('click'); }}
                    className={`flex items-center justify-center gap-2 text-xs font-bold px-3 py-2 border transition-all ${
                        !isGifMode 
                        ? 'bg-primary text-inv border-primary' 
                        : 'text-dim border-dim hover:border-primary hover:text-primary'
                    }`}
                >
                    <PhotoIcon className="w-4 h-4" /> SINGLE_FRAME
                </button>
                <button 
                    onClick={() => { setIsGifMode(true); playSound('click'); }}
                    className={`flex items-center justify-center gap-2 text-xs font-bold px-3 py-2 border transition-all ${
                        isGifMode 
                        ? 'bg-primary text-inv border-primary' 
                        : 'text-dim border-dim hover:border-primary hover:text-primary'
                    }`}
                >
                    <FilmIcon className="w-4 h-4" /> ANIMATED_SEQ
                </button>
             </div>

            <div className="relative">
              <label className="block text-xs font-bold text-inv bg-primary px-2 py-0.5 inline-block mb-2">PROMPT_INPUT</label>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); playSound('type'); }}
                placeholder={isTranscribing ? "LISTENING..." : (isGifMode ? "DESCRIBE_ANIMATION_SEQUENCE..." : "ENTER_VISUAL_DESCRIPTION...")}
                className="term-input w-full p-3 text-base font-bold placeholder-dim text-primary focus:shadow-[0_0_15px_var(--c-primary)] transition-shadow duration-300"
                disabled={isTranscribing}
              />
              <button 
                onClick={isRecording ? stopRecording : startRecording}
                className={`absolute top-8 right-2 p-2 border transition-all ${isRecording ? 'bg-alert text-black border-alert animate-pulse' : 'border-dim text-dim hover:text-primary hover:border-primary bg-bg'}`}
                title="VOICE INPUT"
              >
                {isRecording ? <StopCircleIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
              </button>
              
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                {PROMPT_TEMPLATES.map((template) => (
                    <button
                        key={template.label}
                        onClick={() => { setPrompt(template.prompt); playSound('click'); }}
                        onMouseEnter={() => playSound('hover')}
                        className="py-3 text-xs font-bold border border-dim text-primary hover:text-inv hover:border-primary hover:bg-dim transition-all duration-300 shadow-sm"
                    >
                        [{template.label}]
                    </button>
                ))}
              </div>
            </div>

            {/* Advanced Options Toggle */}
            <div>
                <button 
                    onClick={() => { setShowAdvanced(!showAdvanced); playSound('click'); }}
                    className="text-xs font-bold text-secondary border border-secondary px-3 py-1 hover:bg-secondary hover:text-black transition-all duration-300 w-full md:w-auto uppercase"
                >
                    [ {showAdvanced ? 'COLLAPSE' : 'EXPAND'} ADVANCED_PARAMS ]
                </button>
                
                {showAdvanced && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-dim pt-4 animate-[fadeIn_0.3s_ease-out]">
                        <div>
                            <label className="block text-xs font-bold text-primary mb-1">CAMERA_TYPE</label>
                            <select value={advCamera} onChange={(e) => setAdvCamera(e.target.value)} className="term-input w-full p-1 text-sm font-bold text-primary">
                                <option value="">[DEFAULT]</option>
                                {CAMERA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-primary mb-1">VIEW_ANGLE</label>
                            <select value={advAngle} onChange={(e) => setAdvAngle(e.target.value)} className="term-input w-full p-1 text-sm font-bold text-primary">
                                <option value="">[DEFAULT]</option>
                                {ANGLE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-primary mb-1">LIGHTING_RIG</label>
                            <select value={advLighting} onChange={(e) => setAdvLighting(e.target.value)} className="term-input w-full p-1 text-sm font-bold text-primary">
                                <option value="">[DEFAULT]</option>
                                {LIGHTING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-primary mb-1">MOTION_DYNAMICS</label>
                            <select value={advMovement} onChange={(e) => setAdvMovement(e.target.value)} className="term-input w-full p-1 text-sm font-bold text-primary">
                                <option value="">[DEFAULT]</option>
                                {MOVEMENT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                             <label className="block text-xs font-bold text-primary mb-1">SCENE_LOCATION</label>
                             <input 
                                type="text" 
                                value={advLocation} 
                                onChange={(e) => setAdvLocation(e.target.value)} 
                                placeholder="ENTER_LOCATION_DATA..." 
                                className="term-input w-full p-2 text-sm font-bold placeholder-dim text-primary"
                             />
                        </div>
                    </div>
                )}
            </div>
            
            <div className="flex flex-col gap-4 border-t border-dim pt-4">
                <div>
                  <span className="block text-xs font-bold text-primary mb-2 uppercase">Aspect_Ratio_Config</span>
                  <div className="flex flex-wrap gap-2">
                    {(["1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "21:9"] as AspectRatio[]).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => { setAspectRatio(ratio); playSound('click'); }}
                        className={`px-3 py-1 text-xs font-bold border transition-all duration-300 ${
                          aspectRatio === ratio
                            ? 'bg-primary text-inv border-primary'
                            : 'bg-transparent border-dim text-dim hover:border-primary hover:text-primary hover:bg-dim'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
                {!isGifMode && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="block text-xs font-bold text-primary mb-2 uppercase">Resolution_Output</span>
                            <div className="flex gap-2">
                                 {(["1K", "2K", "4K"] as ImageSize[]).map((size) => (
                                     <button
                                        key={size}
                                        onClick={() => { setImageSize(size); playSound('click'); }}
                                        className={`px-3 py-1 text-xs font-bold border transition-all duration-300 ${
                                          imageSize === size
                                            ? 'bg-secondary text-black border-secondary'
                                            : 'text-dim border-dim hover:text-secondary hover:border-secondary hover:bg-dim'
                                        }`}
                                     >
                                         {size}
                                     </button>
                                 ))}
                            </div>
                        </div>
                        <div>
                            <span className="block text-xs font-bold text-primary mb-2 uppercase">Batch_Size</span>
                            <div className="flex gap-2">
                                 {([1, 2, 4] as BatchSize[]).map((size) => (
                                     <button
                                        key={size}
                                        onClick={() => { setBatchSize(size); playSound('click'); }}
                                        className={`px-3 py-1 text-xs font-bold border transition-all duration-300 ${
                                          batchSize === size
                                            ? 'bg-primary text-inv border-primary'
                                            : 'text-dim border-dim hover:text-primary hover:border-primary hover:bg-dim'
                                        }`}
                                     >
                                         {size}
                                     </button>
                                 ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <button
              onClick={isGifMode ? handleGenerateSequence : generateImage}
              disabled={isLoading}
              onMouseEnter={() => playSound('hover')}
              className="term-btn w-full py-4 mt-4 text-base font-bold transition-all duration-300 hover:shadow-[0_0_15px_var(--c-primary)] group relative overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                 {isLoading && !isUpscaling ? <Spinner /> : null}
                 {isLoading && !isUpscaling ? ' COMPILING_ASSETS...' : (isGifMode ? 'RENDER_SEQUENCE_BATCH' : 'INITIATE_RENDER')}
              </span>
              <div className="absolute inset-0 bg-primary transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 opacity-20 z-0"></div>
            </button>
          </div>
        </div>
        ) : (
            <div className="term-panel p-4 mb-6 min-h-[400px]">
                <div className="flex justify-between mb-4">
                    <span className="text-xs text-dim uppercase font-bold">SAVED_OUTPUTS (MAX 3)</span>
                    <button onClick={clearHistory} className="text-xs text-alert border border-alert px-3 py-1 hover:bg-alert hover:text-black uppercase font-bold">
                        [ CLEAR_MEMORY ]
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {history.map((img, idx) => (
                        <div key={idx} className="relative group border border-dim hover:border-primary">
                            <img src={img} className="w-full h-auto" alt={`History ${idx}`} />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                                <a href={img} download={`gemini-hist-${idx}.png`} onClick={() => playSound('click')} className="p-1 bg-primary text-inv rounded-full">
                                    <ArrowPathIcon className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && <div className="col-span-1 md:col-span-4 text-center text-dim py-10 uppercase font-bold">NO_DATA_FOUND</div>}
                </div>
            </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-alert text-black font-bold text-sm uppercase border-2 border-white animate-pulse">
            {error}
          </div>
        )}

        {/* Loading Overlay / Generated Image Area */}
        <div className="mt-8 flex justify-center relative min-h-[300px]">
          {isLoading && (
            <div className="absolute inset-0 z-20 bg-bg border-2 border-primary flex flex-col items-center justify-center p-8 opacity-90">
              <div className="w-full max-w-xs space-y-4">
                  <div className="flex justify-between text-xs text-primary font-bold">
                      <span>STATUS: {isUpscaling ? 'UPSCALING' : (isGifMode ? 'SEQ_GEN' : 'GENERATING')}</span>
                      <span className="animate-pulse">PROCESSING...</span>
                  </div>
                  <div className="h-4 w-full border border-dim p-[2px]">
                      <div className="h-full bg-primary animate-[width_2s_ease-in-out_infinite] w-full origin-left"></div>
                  </div>
                  <div className="text-center font-mono text-sm font-bold text-primary">
                      {isUpscaling 
                        ? 'ENHANCING_RESOLUTION_MATRIX...' 
                        : 'CONSTRUCTING_VISUAL_DATA_BLOCKS...'}
                  </div>
              </div>
            </div>
          )}
          
          {/* SINGLE / BATCH IMAGE DISPLAY */}
          {!isGifMode && activeTab === 'create' && generatedImage && !isLoading && (
            <div className="w-full border-2 border-primary p-1 bg-primary animate-[fadeIn_0.5s_ease-out]">
               <div className="relative">
                   <img src={generatedImage} alt="Generated art" className="w-full h-auto filter sepia-[0.1] contrast-110" />
                   {generatedBatch.length > 1 && (
                       <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 text-xs font-bold text-primary border border-primary">
                           SELECTED: {generatedBatch.indexOf(generatedImage) + 1}/{generatedBatch.length}
                       </div>
                   )}
               </div>
               
               {/* Controls Bar */}
               <div className="mt-1 flex justify-between items-center bg-bg p-2 flex-wrap gap-2">
                   <div className="flex gap-2">
                       {imageSize !== '4K' && (
                           <button 
                                onClick={handleUpscale} 
                                disabled={isLoading}
                                className="text-xs font-bold text-secondary hover:bg-secondary hover:text-black px-3 py-1 border border-secondary transition-all duration-300 uppercase"
                           >
                               [ UPSCALE_4K ]
                           </button>
                       )}
                   </div>
                   <a 
                     href={generatedImage} 
                     download={`gemini-gen-${Date.now()}.png`} 
                     onClick={() => playSound('success')}
                     className="text-xs font-bold text-primary hover:underline transition-all duration-300 hover:text-inv flex items-center gap-1 uppercase"
                   >
                      <ArrowPathIcon className="w-4 h-4" /> [ DOWNLOAD_ASSET ]
                   </a>
               </div>

               {/* Batch Thumbnails */}
               {generatedBatch.length > 1 && (
                   <div className="mt-1 grid grid-cols-4 gap-1 bg-bg p-1">
                       {generatedBatch.map((img, idx) => (
                           <button 
                                key={idx}
                                onClick={() => { setGeneratedImage(img); playSound('click'); }}
                                className={`border-2 transition-all hover:opacity-100 ${
                                    generatedImage === img ? 'border-primary opacity-100' : 'border-dim opacity-50'
                                }`}
                           >
                               <img src={img} alt={`Thumbnail ${idx}`} className="w-full h-auto object-cover aspect-square" />
                           </button>
                       ))}
                   </div>
               )}
            </div>
          )}

          {/* GIF SEQUENCE DISPLAY */}
          {isGifMode && gifFrames.length > 0 && !isLoading && (
            <div className="w-full border-2 border-primary p-1 bg-primary animate-[fadeIn_0.5s_ease-out]">
                <div className="relative">
                    <img src={gifFrames[currentFrameIndex]} alt={`Frame ${currentFrameIndex}`} className="w-full h-full object-cover filter sepia-[0.1] contrast-110" />
                    <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 border border-primary">
                        <span className="text-xs font-bold text-primary">FRAME: {currentFrameIndex + 1}/{gifFrames.length}</span>
                    </div>
                </div>
                
                <div className="mt-1 bg-bg p-2">
                    <div className="flex items-center justify-between mb-2 border-b border-dim pb-2">
                         <span className="text-xs font-bold text-primary uppercase">PLAYBACK_SPEED: {fps} FPS</span>
                         <div className="flex gap-1">
                            <button onClick={() => { setFps(Math.max(1, fps - 1)); playSound('click'); }} className="w-6 h-6 border border-dim text-primary font-bold flex items-center justify-center hover:bg-dim">-</button>
                            <button onClick={() => { setFps(Math.min(24, fps + 1)); playSound('click'); }} className="w-6 h-6 border border-dim text-primary font-bold flex items-center justify-center hover:bg-dim">+</button>
                         </div>
                    </div>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
