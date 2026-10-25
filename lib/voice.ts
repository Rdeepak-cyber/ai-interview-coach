"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  if ("speechSynthesis" in window) return true;
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("TextToSpeech");
  } catch {
    return false;
  }
}

async function getNativeTTS() {
  if (typeof window === "undefined") return null;
  try {
    const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
    return TextToSpeech;
  } catch {
    return null;
  }
}

export function findBestEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const normalize = (lang: string) => lang.toLowerCase().replace(/_/g, "-");

  // Priority 1: Indian English (en-IN)
  const enInVoice = voices.find((v) => normalize(v.lang) === "en-in");
  if (enInVoice) return enInVoice;

  // Priority 2: US English (en-US), preferring natural/high-quality voices
  const enUsVoice =
    voices.find(
      (v) =>
        normalize(v.lang) === "en-us" &&
        (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha"))
    ) || voices.find((v) => normalize(v.lang) === "en-us");
  if (enUsVoice) return enUsVoice;

  // Priority 3: Any English voice (starts with "en")
  const anyEnVoice =
    voices.find(
      (v) =>
        normalize(v.lang).startsWith("en") &&
        (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha"))
    ) || voices.find((v) => normalize(v.lang).startsWith("en"));

  return anyEnVoice || null;
}

const NO_ENGLISH_VOICE_ERROR =
  "No English voice was found on your device. Please install or select an English text-to-speech voice in Android Settings, or read the question and type your answer.";

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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [interimText, setInterimText] = useState("");

  const getCurrentTextRef = useRef(getCurrentText);
  getCurrentTextRef.current = getCurrentText;

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechRunRef = useRef(0);

  useEffect(() => {
    setRecognitionSupported(isSpeechRecognitionSupported());
    setSynthesisSupported(isSpeechSynthesisSupported());

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const updateVoices = () => {
        const available = window.speechSynthesis.getVoices();
        if (available && available.length > 0) {
          setVoices(available);
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      // Clean up recognition on unmount
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      // Stop speech on unmount
      if (typeof window !== "undefined") {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        try {
          if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("TextToSpeech")) {
            getNativeTTS().then((tts) => tts?.stop().catch(() => {}));
          }
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const resetTranscript = useCallback(() => {
    setInterimText("");
    setSpeechError(null);
  }, []);

  const stopSpeaking = useCallback(() => {
    speechRunRef.current += 1;
    setIsSpeaking(false);

    if (typeof window !== "undefined") {
      try {
        if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("TextToSpeech")) {
          getNativeTTS().then((tts) => tts?.stop().catch(() => {}));
        }
      } catch {
        // ignore
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  }, []);

  const startListening = useCallback(() => {
    setSpeechError(null);
    setInterimText("");

    if (!isSpeechRecognitionSupported()) {
      setSpeechError("Speech-to-text is not supported in this browser. Chrome or Edge is recommended.");
      return;
    }

    // Stop speaking if question was being read aloud
    stopSpeaking();

    try {
      const SpeechRecognitionConstructor =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognitionConstructor) {
        setSpeechError("Speech recognition is unavailable.");
        return;
      }

      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        setInterimText("");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalChunk = "";
        let currentInterim = "";

        // 1. Rebuild the transcript from event.results starting at event.resultIndex
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript || "";
          if (result.isFinal) {
            finalChunk += text + " ";
          } else {
            currentInterim += text;
          }
        }

        // 2. Add only results with isFinal === true to the stored answer text
        const trimmedFinal = finalChunk.trim();
        if (trimmedFinal) {
          const currentText = getCurrentTextRef.current().trim();
          const updated = currentText ? `${currentText} ${trimmedFinal}` : trimmedFinal;
          onTranscriptRef.current(updated);
        }

        // 3. Show the current interim text separately and never save it into the answer
        setInterimText(currentInterim.trim());
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
        setInterimText("");
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText("");
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition", err);
      setSpeechError("Could not start microphone recording. Please try again.");
      setIsListening(false);
      setInterimText("");
    }
  }, [stopSpeaking]);

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
    setInterimText("");
  }, []);

  const speakText = useCallback(
    (text: string, options?: { onEnd?: () => void; onError?: () => void }) => {
      const speechRun = ++speechRunRef.current;
      setSpeechError(null);

      // 1. If running natively in Capacitor, use native TextToSpeech plugin
      const isNative =
        typeof window !== "undefined" &&
        Capacitor.isNativePlatform() &&
        Capacitor.isPluginAvailable("TextToSpeech");

      if (isNative) {
        setIsSpeaking(true);
        (async () => {
          const NativeTTS = await getNativeTTS();
          if (!NativeTTS) {
            setIsSpeaking(false);
            setSpeechError(NO_ENGLISH_VOICE_ERROR);
            options?.onError?.();
            return;
          }

          try {
            await NativeTTS.stop();
          } catch {
            // ignore stop errors
          }

          // Try en-IN first, then fall back to en-US
          try {
            await NativeTTS.speak({
              text,
              lang: "en-IN",
              rate: 0.95,
              pitch: 1.0,
              category: "playback",
            });
            if (speechRun === speechRunRef.current) {
              setIsSpeaking(false);
              options?.onEnd?.();
            }
          } catch (errIn) {
            console.warn("Native TTS en-IN failed, falling back to en-US", errIn);
            try {
              await NativeTTS.speak({
                text,
                lang: "en-US",
                rate: 0.95,
                pitch: 1.0,
                category: "playback",
              });
              if (speechRun === speechRunRef.current) {
                setIsSpeaking(false);
                options?.onEnd?.();
              }
            } catch (errUs) {
              console.error("Native TTS en-US also failed", errUs);
              if (speechRun === speechRunRef.current) {
                setIsSpeaking(false);
                setSpeechError(NO_ENGLISH_VOICE_ERROR);
                options?.onError?.();
              }
            }
          }
        })();
        return true;
      }

      // 2. Standard Web Speech Synthesis (browser or webview fallback)
      if (!isSpeechSynthesisSupported()) {
        setSpeechError("Text-to-speech is not supported in this browser. You can still read and type your answer.");
        options?.onError?.();
        return false;
      }

      window.speechSynthesis.cancel();

      const currentVoices = window.speechSynthesis.getVoices();
      const voiceList = currentVoices && currentVoices.length > 0 ? currentVoices : voices;
      const englishVoice = findBestEnglishVoice(voiceList);

      // If voices list is populated (> 0) and NO English voice was found on device:
      if (voiceList.length > 0 && !englishVoice) {
        setSpeechError(NO_ENGLISH_VOICE_ERROR);
        options?.onError?.();
        return false;
      }

      const playUtterance = (targetLang: "en-IN" | "en-US", isRetry = false) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        if (englishVoice) {
          utterance.voice = englishVoice;
          utterance.lang = englishVoice.lang || targetLang;
        } else {
          utterance.lang = targetLang;
        }

        utterance.onstart = () => {
          if (speechRun === speechRunRef.current) {
            setIsSpeaking(true);
            setSpeechError(null);
          }
        };

        utterance.onend = () => {
          if (speechRun !== speechRunRef.current) return;
          setIsSpeaking(false);
          options?.onEnd?.();
        };

        utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
          if (speechRun !== speechRunRef.current) return;

          // If en-IN failed without an explicit voice, retry once with en-US
          if (!isRetry && !englishVoice && targetLang === "en-IN") {
            console.warn("SpeechSynthesis en-IN failed, retrying with en-US");
            playUtterance("en-US", true);
            return;
          }

          setIsSpeaking(false);
          setSpeechError(NO_ENGLISH_VOICE_ERROR);
          options?.onError?.();
        };

        window.speechSynthesis.speak(utterance);
      };

      playUtterance("en-IN");
      return true;
    },
    [voices]
  );

  return {
    isListening,
    isSpeaking,
    speechError,
    recognitionSupported,
    synthesisSupported,
    interimText,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
    resetTranscript,
  };
}
