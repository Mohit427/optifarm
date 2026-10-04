import type { Lang } from './types';
import { BCP47 } from '../i18n';

// ------------------------------------------------------------------ text to speech

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

let voicesCache: SpeechSynthesisVoice[] = [];
if (ttsSupported()) {
  const load = () => (voicesCache = window.speechSynthesis.getVoices());
  load();
  window.speechSynthesis.addEventListener?.('voiceschanged', load);
}

export function voiceFor(lang: Lang): SpeechSynthesisVoice | undefined {
  if (!ttsSupported()) return undefined;
  const voices = voicesCache.length ? voicesCache : window.speechSynthesis.getVoices();
  const tag = BCP47[lang].toLowerCase();
  const base = lang.toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase().replace('_', '-') === tag) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base))
  );
}

export type SpeakResult = 'ok' | 'no-voice' | 'unsupported';

/**
 * Speak `text` in the UI language. Returns 'no-voice' when the device has no matching
 * voice, so callers can show a notice and leave the text on screen instead.
 */
export function speak(text: string, lang: Lang, onEnd?: () => void): SpeakResult {
  if (!ttsSupported()) return 'unsupported';
  const voice = voiceFor(lang);
  if (!voice && lang !== 'en') return 'no-voice';
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = BCP47[lang];
  if (voice) u.voice = voice;
  u.rate = 0.95;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  synth.speak(u);
  return 'ok';
}

export const stopSpeaking = () => ttsSupported() && window.speechSynthesis.cancel();

// ------------------------------------------------------------------ speech to text

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

const recognitionCtor = (): RecognitionCtor | undefined => {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const sttSupported = () => typeof window !== 'undefined' && !!recognitionCtor();

/** Listen once; resolves with the transcript (empty string if nothing was heard). */
export function listenOnce(lang: Lang): { promise: Promise<string>; stop: () => void } {
  const Ctor = recognitionCtor();
  if (!Ctor) return { promise: Promise.reject(new Error('unsupported')), stop: () => {} };
  const rec = new Ctor();
  rec.lang = BCP47[lang];
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  const promise = new Promise<string>((resolve, reject) => {
    let text = '';
    rec.onresult = (e) => {
      text = e.results[0]?.[0]?.transcript ?? '';
    };
    rec.onerror = (e) => reject(e);
    rec.onend = () => resolve(text);
  });
  rec.start();
  return { promise, stop: () => rec.stop() };
}
