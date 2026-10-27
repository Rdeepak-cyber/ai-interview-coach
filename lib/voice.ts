"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

type VoiceDebugInfo = {
  enabled: boolean;
  isNativePlatform: boolean;
  path: string;
  languages: string[];
  voices: string[];
  lastError: string | null;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
  const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
  return TextToSpeech;
}

export function findBestEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const normalize = (lang: string) => lang.toLowerCase().replace(/_/g, "-");
  const enInVoice = voices.find((voice) => normalize(voice.lang) === "en-in");
  if (enInVoice) return enInVoice;

  const enUsVoice =
    voices.find(
      (voice) =>
        normalize(voice.lang) === "en-us" &&
        (voice.name.includes("Google") || voice.name.includes("Natural") || voice.name.includes("Samantha"))
    ) || voices.find((voice) => normalize(voice.lang) === "en-us");
  if (enUsVoice) return enUsVoice;

  return (
    voices.find(
      (voice) =>
        normalize(voice.lang).startsWith("en") &&
        (voice.name.includes("Google") || voice.name.includes("Natural") || voice.name.includes("Samantha"))
    ) || voices.find((voice) => normalize(voice.lang).startsWith("en")) || null
  );
}

const NO_ENGLISH_VOICE_ERROR =
  "No English voice was found on your device. Please install or select an English text-to-speech voice in Android Settings, or read the question and type your answer.";

export function useVoice({
  onTranscript,
  getCurrentText,
  questionKey,
}: {
  onTranscript: (updatedText: string) => void;
  getCurrentText: () => string;
  questionKey?: string | number | null;
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [synthesisSupported, setSynthesisSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [interimText, setInterimText] = useState("");
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugIsNative, setDebugIsNative] = useState(false);
  const [debugPath, setDebugPath] = useState("Not used");
  const [debugLanguages, setDebugLanguages] = useState<string[]>([]);
  const [debugVoices, setDebugVoices] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const getCurrentTextRef = useRef(getCurrentText);
  getCurrentTextRef.current = getCurrentText;
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const recognitionStartingRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedTextRef = useRef("");
  const lastCommittedChunkRef = useRef("");
  const speechRunRef = useRef(0);
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRecognitionRef = useRef<() => void>(() => {});

  useEffect(() => {
    setRecognitionSupported(isSpeechRecognitionSupported());
    setSynthesisSupported(isSpeechSynthesisSupported());

    const enabled = new URLSearchParams(window.location.search).get("debug") === "1";
    setDebugEnabled(enabled);
    if (enabled) {
      try {
        setDebugIsNative(Capacitor.isNativePlatform());
      } catch (error) {
        setLastError(getErrorMessage(error));
      }

      void getNativeTTS()
        .then(async (tts) => {
          if (!tts) return;
          const [languageResult, voiceResult] = await Promise.allSettled([
            tts.getSupportedLanguages(),
            tts.getSupportedVoices(),
          ]);
          if (languageResult.status === "fulfilled") {
            setDebugLanguages(languageResult.value.languages);
          } else {
            setLastError(getErrorMessage(languageResult.reason));
          }
          if (voiceResult.status === "fulfilled") {
            setDebugVoices(
              voiceResult.value.voices.map((voice) => `${voice.name} (${voice.lang})`)
            );
          } else {
            setLastError(getErrorMessage(voiceResult.reason));
          }
        })
        .catch((error: unknown) => setLastError(getErrorMessage(error)));
    }

    if ("speechSynthesis" in window) {
      const updateVoices = () => {
        const available = window.speechSynthesis.getVoices();
        if (available.length > 0) setVoices(available);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      shouldListenRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      speechRunRef.current += 1;
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.abort();
        } catch {
          // Recognition may already have stopped.
        }
        recognitionRef.current = null;
      }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      void getNativeTTS()
        .then((tts) => tts?.stop())
        .catch(() => {});
    };
  }, []);

  useEffect(() => {
    setInterimText("");
    lastCommittedChunkRef.current = "";
    committedTextRef.current = getCurrentTextRef.current();
  }, [questionKey]);

  const resetTranscript = useCallback(() => {
    setInterimText("");
    setSpeechError(null);
    lastCommittedChunkRef.current = "";
    committedTextRef.current = getCurrentTextRef.current();
  }, []);

  const stopSpeaking = useCallback(() => {
    speechRunRef.current += 1;
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    setIsSpeaking(false);
    if (typeof window !== "undefined") {
      void getNativeTTS()
        .then((tts) => tts?.stop())
        .catch(() => {});
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    }
  }, []);

  const startRecognitionSession = useCallback(() => {
    if (
      !shouldListenRef.current ||
      recognitionRef.current ||
      recognitionStartingRef.current
    ) {
      return;
    }

    const SpeechRecognitionConstructor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      shouldListenRef.current = false;
      setIsListening(false);
      setSpeechError("Speech recognition is unavailable.");
      return;
    }

    let recognition: SpeechRecognition;
    try {
      recognition = new SpeechRecognitionConstructor();
    } catch (error) {
      shouldListenRef.current = false;
      setIsListening(false);
      setInterimText("");
      setSpeechError(`Could not create speech recognition: ${getErrorMessage(error)}`);
      return;
    }
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionStartingRef.current = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      recognitionStartingRef.current = false;
      setIsListening(true);
      setSpeechError(null);
      setInterimText("");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let currentInterim = "";
      let currentText = getCurrentTextRef.current();
      if (currentText !== committedTextRef.current) committedTextRef.current = currentText;

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (!result.isFinal) {
          currentInterim += `${transcript} `;
          continue;
        }

        const finalChunk = transcript.trim().replace(/\s+/g, " ");
        if (
          !finalChunk ||
          finalChunk === lastCommittedChunkRef.current ||
          currentText.trimEnd().endsWith(finalChunk)
        ) {
          continue;
        }

        const trimmedCurrent = currentText.trimEnd();
        currentText = trimmedCurrent ? `${trimmedCurrent} ${finalChunk}` : finalChunk;
        committedTextRef.current = currentText;
        lastCommittedChunkRef.current = finalChunk;
        onTranscriptRef.current(currentText);
      }

      setInterimText(currentInterim.trim().replace(/\s+/g, " "));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") return;

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSpeechError("Microphone access was denied. Please allow microphone access in your browser settings.");
      } else if (event.error === "audio-capture") {
        setSpeechError("No microphone found on your device.");
      } else {
        setSpeechError(`Speech recognition error: ${event.error}`);
      }
      shouldListenRef.current = false;
      setIsListening(false);
      setInterimText("");
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      recognitionStartingRef.current = false;
      setInterimText("");

      if (shouldListenRef.current) {
        setIsListening(true);
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          startRecognitionRef.current();
        }, 250);
      } else {
        setIsListening(false);
      }
    };

    try {
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      recognitionStartingRef.current = false;
      const alreadyStarted =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "InvalidStateError";
      if (alreadyStarted && shouldListenRef.current) {
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          startRecognitionRef.current();
        }, 250);
        return;
      }

      shouldListenRef.current = false;
      setIsListening(false);
      setInterimText("");
      setSpeechError("Could not start microphone recording. Please try again.");
    }
  }, []);
  startRecognitionRef.current = startRecognitionSession;

  const startListening = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setSpeechError("Speech-to-text is not supported in this browser. Chrome or Edge is recommended.");
      return;
    }
    if (shouldListenRef.current) return;

    shouldListenRef.current = true;
    setSpeechError(null);
    setInterimText("");
    lastCommittedChunkRef.current = "";
    committedTextRef.current = getCurrentTextRef.current();
    setIsListening(true);
    stopSpeaking();
    startRecognitionRef.current();
  }, [stopSpeaking]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          // The recognition session may already have ended.
        }
      }
    }
    setIsListening(false);
    setInterimText("");
  }, []);

  const speakText = useCallback(
    (text: string, options?: { onEnd?: () => void; onError?: () => void }) => {
      const speechRun = ++speechRunRef.current;
      setSpeechError(null);
      setLastError(null);
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
        speechTimerRef.current = null;
      }

      const startWebSpeech = () => {
        setDebugPath("Web Speech");
        if (!isSpeechSynthesisSupported() || !("speechSynthesis" in window)) {
          const message = "Text-to-speech is not supported in this browser. You can still read and type your answer.";
          setSpeechError(message);
          setIsSpeaking(false);
          options?.onError?.();
          return false;
        }

        window.speechSynthesis.cancel();
        const currentVoices = window.speechSynthesis.getVoices();
        const voiceList = currentVoices.length > 0 ? currentVoices : voices;
        const englishVoice = findBestEnglishVoice(voiceList);
        if (voiceList.length > 0 && !englishVoice) {
          setSpeechError(NO_ENGLISH_VOICE_ERROR);
          setIsSpeaking(false);
          options?.onError?.();
          return false;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.lang = englishVoice?.lang || "en-IN";
        if (englishVoice) utterance.voice = englishVoice;

        let finished = false;
        const timeoutMs = Math.min(45000, Math.max(10000, text.length * 120));
        speechTimerRef.current = setTimeout(() => {
          if (finished || speechRun !== speechRunRef.current) return;
          finished = true;
          speechTimerRef.current = null;
          window.speechSynthesis.cancel();
          const message = `Web Speech playback timed out after ${timeoutMs} ms.`;
          setLastError(message);
          setSpeechError(message);
          setIsSpeaking(false);
          options?.onError?.();
        }, timeoutMs);

        utterance.onstart = () => {
          if (speechRun === speechRunRef.current) setIsSpeaking(true);
        };
        utterance.onend = () => {
          if (finished || speechRun !== speechRunRef.current) return;
          finished = true;
          if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
          speechTimerRef.current = null;
          setIsSpeaking(false);
          options?.onEnd?.();
        };
        utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
          if (finished || speechRun !== speechRunRef.current) return;
          finished = true;
          if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
          speechTimerRef.current = null;
          setLastError(event.error);
          setSpeechError(`Text-to-speech playback failed: ${event.error}. You can still read and type your answer.`);
          setIsSpeaking(false);
          options?.onError?.();
        };

        setIsSpeaking(true);
        try {
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          finished = true;
          if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
          speechTimerRef.current = null;
          const message = getErrorMessage(error);
          setLastError(message);
          setSpeechError(`Text-to-speech playback failed: ${message}. You can still read and type your answer.`);
          setIsSpeaking(false);
          options?.onError?.();
          return false;
        }
        return true;
      };

      let isNative = false;
      try {
        isNative =
          typeof window !== "undefined" &&
          Capacitor.isNativePlatform() &&
          Capacitor.isPluginAvailable("TextToSpeech");
      } catch (error) {
        setLastError(getErrorMessage(error));
      }

      if (!isNative) return startWebSpeech();

      setDebugPath("Native plugin");
      setIsSpeaking(true);
      const timeoutMs = Math.min(45000, Math.max(10000, text.length * 120));
      void (async () => {
        let nativeTTS: Awaited<ReturnType<typeof getNativeTTS>> = null;
        try {
          nativeTTS = await getNativeTTS();
          if (!nativeTTS) throw new Error("Native TextToSpeech plugin is unavailable.");
          void nativeTTS.stop().catch(() => {});

          let timeout: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              nativeTTS.speak({
                text,
                lang: "en-IN",
                rate: 0.95,
                pitch: 1,
                volume: 1,
              }),
              new Promise<never>((_, reject) => {
                timeout = setTimeout(
                  () => reject(new Error(`Native TTS playback timed out after ${timeoutMs} ms.`)),
                  timeoutMs
                );
              }),
            ]);
          } finally {
            if (timeout) clearTimeout(timeout);
          }

          if (speechRun !== speechRunRef.current) return;
          setIsSpeaking(false);
          options?.onEnd?.();
        } catch (error) {
          if (speechRun !== speechRunRef.current) return;
          const exactError = getErrorMessage(error);
          setLastError(exactError);
          setSpeechError(`Native text-to-speech failed: ${exactError}. Trying browser speech instead.`);
          if (nativeTTS) void nativeTTS.stop().catch(() => {});
          if (!startWebSpeech()) {
            setIsSpeaking(false);
          }
        }
      })();
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
    debugInfo: {
      enabled: debugEnabled,
      isNativePlatform: debugIsNative,
      path: debugPath,
      languages: debugLanguages,
      voices: debugVoices,
      lastError,
    } satisfies VoiceDebugInfo,
  };
}
