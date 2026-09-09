"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window;
}

export function useVoice({
  onTranscript,
  getCurrentText,
}: {
  onTranscript: (updatedText: string) => void;
  getCurrentText: () => string;
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [synthesisSupported, setSynthesisSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const baseTextRef = useRef<string>("");

  useEffect(() => {
    setRecognitionSupported(isSpeechRecognitionSupported());
    setSynthesisSupported(isSpeechSynthesisSupported());

    return () => {
      // Clean up recognition on unmount
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      // Stop speech on unmount
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    setSpeechError(null);

    if (!isSpeechRecognitionSupported()) {
      setSpeechError("Speech-to-text is not supported in this browser. Chrome or Edge is recommended.");
      return;
    }

    // Stop speaking if question was being read aloud
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      const SpeechRecognitionConstructor =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognitionConstructor) {
        setSpeechError("Speech recognition is unavailable.");
        return;
      }

      // Record current text in the textarea as base
      const current = getCurrentText().trim();
      baseTextRef.current = current.length > 0 ? `${current} ` : "";

      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + " ";
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        const totalDictated = (finalTranscript + interimTranscript).trim();
        if (totalDictated) {
          onTranscript(`${baseTextRef.current}${totalDictated}`);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "no-speech") {
          // Silent timeout or brief pause; user can keep speaking or click stop
          return;
        }

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setSpeechError("Microphone access was denied. Please allow microphone access in your browser settings.");
        } else if (event.error === "audio-capture") {
          setSpeechError("No microphone found on your device.");
        } else if (event.error !== "aborted") {
          setSpeechError(`Speech recognition error: ${event.error}`);
        }

        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition", err);
      setSpeechError("Could not start microphone recording. Please try again.");
      setIsListening(false);
    }
  }, [getCurrentText, onTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        recognitionRef.current.abort();
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const speakText = useCallback((text: string) => {
    if (!isSpeechSynthesisSupported()) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Select natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha"))) ||
      voices.find((v) => v.lang.startsWith("en"));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (!isSpeechSynthesisSupported()) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    isListening,
    isSpeaking,
    speechError,
    recognitionSupported,
    synthesisSupported,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
  };
}

