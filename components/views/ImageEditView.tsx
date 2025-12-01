
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Spinner } from '../ui/Spinner';
import { ArrowPathIcon, PhotoIcon, MicrophoneIcon, StopCircleIcon } from '../icons';
import { useVoiceInput } from '../utils/useVoiceInput';
import { useSound } from '../utils/SoundManager';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
    });
};

const MODIFICATION_TEMPLATES = [
  { label: "ERASE_BG", prompt: "Remove the background from the image, leaving the subject on a solid white background." },
  { label: "B_AND_W", prompt: "Convert the image to high-contrast black and white photography." },
  { label: "NEGATIVE", prompt: "Invert the colors of the image to create a negative film effect." },
  { label: "NIGHT_VIS", prompt: "Apply a green night vision filter with scanlines and digital noise." },
  { label: "MERGE_DBL", prompt: "Create a double exposure effect merging the subject with a nature landscape." },
  { label: "SKETCH", prompt: "Convert the image into a detailed pencil sketch illustration." },
];

export const ImageEditView: React.FC = () => {
    const { playSound } = useSound();
    const [originalImage, setOriginalImage] = useState<File | null>(null);
    const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceInput((text) => {
        setPrompt((prev) => prev + (prev ? ' ' : '') + text);
    });

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            playSound('success');
            setOriginalImage(file);
            setOriginalImagePreview(URL.createObjectURL(file));
            setEditedImage(null);
            setError(null);
        }
    };

    const handleEdit = async () => {
        if (!originalImage || !prompt.trim()) {
            setError('INPUT_MISSING');
            playSound('error');
            return;
        }

        playSound('click');
        setIsLoading(true);
        setError(null);
        setEditedImage(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const base64Data = await fileToBase64(originalImage);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { data: base64Data, mimeType: originalImage.type } },
                        { text: prompt },
                    ],
                },
            });

            // Iterate through parts to find the image, as per SDK guidelines
            let foundImage = false;
            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        const base64ImageBytes = part.inlineData.data;
                        const mimeType = part.inlineData.mimeType || 'image/png';
                        const imageUrl = `data:${mimeType};base64,${base64ImageBytes}`;
                        setEditedImage(imageUrl);
                        foundImage = true;
                        break;
                    }
                }
            }
            
            if (foundImage) {
                playSound('success');
            } else {
                throw new Error('No image generated. The model might have refused the request or returned only text.');
            }

        } catch (err: any) {
            console.error('Image editing error:', err);
            setError(`PROCESS_FAILED: ${err.message || 'UNKNOWN_ERROR'}`);
            playSound('error');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="flex flex-col h-full p-4 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full pb-20">
                <h2 className="text-xl font-bold mb-6 text-alert border-b-2 border-alert inline-block pr-8 uppercase">
                    // IMAGE_MANIPULATION_UNIT
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Controls */}
                    <div className="term-panel p-4 md:col-span-2">
                         <div className="flex flex-col gap-4">
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                            <button
                                onClick={() => { fileInputRef.current?.click(); playSound('click'); }}
                                className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-dim hover:border-primary bg-bg text-primary hover:text-inv transition-colors group"
                            >
                                <span className="text-base font-bold uppercase tracking-wider">{originalImage ? 'REPLACE_SOURCE_FILE' : 'INSERT_SOURCE_MEDIA'}</span>
                                {originalImage && <span className="text-sm mt-1 text-secondary">{originalImage.name}</span>}
                            </button>

                            <div className="relative">
                                <label htmlFor="prompt" className="block text-sm font-bold text-primary mb-2 uppercase tracking-wide">MODIFICATION_SCRIPT</label>
                                <textarea
                                    id="prompt"
                                    rows={3}
                                    value={prompt}
                                    onChange={(e) => { setPrompt(e.target.value); playSound('type'); }}
                                    placeholder={isTranscribing ? "LISTENING..." : "Execute change command (e.g., 'Add neon lights')"}
                                    className="term-input w-full p-3 text-base font-bold placeholder-dim text-primary"
                                    disabled={!originalImage || isTranscribing}
                                />
                                <button 
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`absolute top-8 right-2 p-2 border transition-all ${isRecording ? 'bg-alert text-black border-alert animate-pulse' : 'border-dim text-primary hover:bg-dim bg-bg'}`}
                                    title="VOICE INPUT"
                                    disabled={!originalImage}
                                >
                                    {isRecording ? <StopCircleIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
                                </button>

                                {/* Shortcuts Grid */}
                                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {MODIFICATION_TEMPLATES.map((template) => (
                                        <button
                                            key={template.label}
                                            onClick={() => { setPrompt(template.prompt); playSound('click'); }}
                                            disabled={!originalImage}
                                            className="py-3 px-2 text-xs font-bold border border-dim text-primary hover:text-inv hover:border-primary hover:bg-dim disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_5px_rgba(0,0,0,0.1)] truncate"
                                            title={template.prompt}
                                        >
                                            [{template.label}]
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={handleEdit}
                                disabled={isLoading || !originalImage || !prompt}
                                className="term-btn w-full py-4 text-base font-bold flex items-center justify-center gap-2 mt-2"
                            >
                                {isLoading && <Spinner size="sm" />}
                                {isLoading ? 'PROCESSING_EDITS...' : 'EXECUTE_MANIPULATION'}
                            </button>
                             {error && (
                                <div className="p-3 bg-alert text-black font-bold uppercase text-sm border-2 border-white">
                                    ERR: {error}
                                </div>
                            )}
                         </div>
                    </div>
                    
                    {/* Display */}
                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-bold text-primary uppercase">[ INPUT_BUFFER ]</h3>
                        <div className="w-full aspect-square border-2 border-dim flex items-center justify-center overflow-hidden bg-bg relative">
                            {originalImagePreview ? (
                                <img src={originalImagePreview} alt="Original" className="w-full h-full object-contain" />
                            ) : (
                                <span className="text-primary text-sm font-bold opacity-50">NO_DATA</span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-bold text-primary uppercase">[ OUTPUT_BUFFER ]</h3>
                        <div className="w-full aspect-square border-2 border-primary flex items-center justify-center overflow-hidden bg-bg shadow-[0_0_15px_var(--c-dim)]">
                            {isLoading ? (
                                <div className="text-center text-primary">
                                    <Spinner size="md" />
                                </div>
                            ) : editedImage ? (
                                <div className="relative w-full h-full group">
                                    <img src={editedImage} alt="Edited" className="w-full h-full object-contain" />
                                    <a 
                                        href={editedImage} 
                                        download={`edited-${Date.now()}.png`}
                                        className="absolute bottom-2 right-2 bg-black/80 text-white p-2 rounded border border-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Download"
                                    >
                                        <ArrowPathIcon className="w-4 h-4" />
                                    </a>
                                </div>
                            ) : (
                                <span className="text-primary text-sm font-bold opacity-50">WAITING_FOR_PROCESS</span>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
