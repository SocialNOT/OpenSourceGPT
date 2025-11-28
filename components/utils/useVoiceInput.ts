
import { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useSound } from './SoundManager';

export const useVoiceInput = (onTranscription: (text: string) => void) => {
  const { playSound } = useSound();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    playSound('click');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please allow permissions in your browser settings.");
    }
  };

  const stopRecording = () => {
    playSound('click');
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' }); 
        await transcribeAudio(audioBlob);
        
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    if (!process.env.API_KEY || process.env.API_KEY.includes('Paste_Your_Key')) {
        onTranscription("SYS_ERR: API_KEY_MISSING_OR_INVALID");
        playSound('error');
        return;
    }
    
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string)?.split(',')[1];
        if (!base64Audio) {
            setIsTranscribing(false);
            return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              { inlineData: { mimeType: 'audio/wav', data: base64Audio } },
              { text: "Transcribe the audio exactly as spoken. Return only the text. Do not add any commentary." }
            ]
          }
        });
        
        const text = response.text;
        if (text) {
          onTranscription(text);
          playSound('success');
        }
        setIsTranscribing(false);
      };
    } catch (error) {
      console.error("Transcription error:", error);
      onTranscription("TRANSCRIPTION_FAILED");
      playSound('error');
      setIsTranscribing(false);
    }
  };

  return { isRecording, isTranscribing, startRecording, stopRecording };
};
