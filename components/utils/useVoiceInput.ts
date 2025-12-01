
import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useSound } from './SoundManager';

export const useVoiceInput = (onTranscription: (text: string) => void) => {
  const { playSound } = useSound();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Gemini Fallback Logic
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
      // Check for Web Speech API support
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;
          recognitionRef.current.lang = 'en-US';

          recognitionRef.current.onstart = () => {
              setIsRecording(true);
          };

          recognitionRef.current.onend = () => {
              setIsRecording(false);
          };

          recognitionRef.current.onresult = (event: any) => {
              let interimTranscript = '';
              let finalTranscript = '';

              for (let i = event.resultIndex; i < event.results.length; ++i) {
                  if (event.results[i].isFinal) {
                      finalTranscript += event.results[i][0].transcript;
                  } else {
                      interimTranscript += event.results[i][0].transcript;
                  }
              }
              // Send final results to the callback
              if (finalTranscript) {
                  onTranscription(finalTranscript);
              }
          };

          recognitionRef.current.onerror = (event: any) => {
              console.error("Speech Recognition Error", event.error);
              if (event.error === 'not-allowed') {
                   alert("Permission denied. Please enable microphone access.");
              }
              setIsRecording(false);
          };
      }
  }, []);

  const startRecording = async () => {
    playSound('click');
    if (recognitionRef.current) {
        // Use Native Web Speech API
        try {
            recognitionRef.current.start();
        } catch(e) {
            console.warn("Speech API busy, restarting...");
            recognitionRef.current.stop();
            setTimeout(() => recognitionRef.current.start(), 100);
        }
    } else {
        // Fallback to Gemini Transcription
        startGeminiRecording();
    }
  };

  const stopRecording = () => {
    playSound('click');
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    } else {
        stopGeminiRecording();
    }
  };

  // --- GEMINI FALLBACK IMPLEMENTATION ---
  const startGeminiRecording = async () => {
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
      console.error("Error accessing microphone for Gemini fallback:", err);
    }
  };

  const stopGeminiRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' }); 
        await transcribeAudioGemini(audioBlob);
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudioGemini = async (audioBlob: Blob) => {
    if (!process.env.API_KEY || process.env.API_KEY.includes('Paste_Your_Key')) {
        onTranscription("SYS_ERR: API_KEY_MISSING");
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
      console.error("Gemini Transcription error:", error);
      onTranscription("TRANSCRIPTION_FAILED");
      playSound('error');
      setIsTranscribing(false);
    }
  };

  return { isRecording, isTranscribing, startRecording, stopRecording };
};
