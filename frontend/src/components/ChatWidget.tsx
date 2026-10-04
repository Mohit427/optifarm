import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Bot, Mic, MicOff, Send, Trash2, Volume2, VolumeX, X, Loader2, WifiOff } from 'lucide-react';
import { useApp } from '../state/AppState';
import { currentLang } from '../i18n';
import { askAssistant, buildChatContext, faqAnswer, type ChatMessage } from '../lib/chat';
import { listenOnce, speak, stopSpeaking, sttSupported } from '../lib/voice';
import { toast } from './Toast';

const MAX_MESSAGES = 10; // client memory only; nothing is stored on the server

export default function ChatWidget() {
  const { t } = useTranslation();
  const lang = currentLang();
  const app = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const inApp = location.pathname.startsWith('/app');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [listening, setListening] = useState(false);
  const stopListen = useRef<() => void>(() => {});
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    if (!open) stopSpeaking();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const ctx = {
    crop: app.crop,
    field: app.field,
    plan: app.plan,
    weather: app.weather,
    sowingDate: app.sowingDate,
    pump: app.pump,
    page: location.pathname,
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history: ChatMessage[] = [...messages, { role: 'user' as const, content: q }].slice(-MAX_MESSAGES);
    setMessages(history);
    setInput('');
    setBusy(true);
    let reply: ChatMessage;
    const aiAvailable = app.connectivity.online && app.connectivity.backend && app.connectivity.ai;
    try {
      if (!aiAvailable) throw new Error('offline');
      const res = await askAssistant(history, lang, buildChatContext(ctx));
      reply = { role: 'assistant', content: res.reply, action: res.action, source: 'ai' };
    } catch {
      const res = faqAnswer(q, t, lang, ctx);
      reply = { role: 'assistant', content: res.reply, action: res.action, source: 'fallback' };
    }
    setMessages((m) => [...m, reply].slice(-MAX_MESSAGES));
    setBusy(false);
    if (speaker) {
      const r = speak(reply.content, lang);
      if (r !== 'ok') toast(r === 'no-voice' ? t('voice.noVoice') : t('voice.unsupported'));
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const mic = async () => {
    if (!sttSupported()) return toast(t('chat.noStt'));
    if (listening) return stopListen.current();
    try {
      setListening(true);
      const l = listenOnce(lang);
      stopListen.current = l.stop;
      const text = await l.promise;
      if (text) await send(text);
    } catch {
      toast(t('chat.noStt'));
    } finally {
      setListening(false);
    }
  };

  const starters = [t('chat.s1'), t('chat.s2'), t('chat.s3'), t('chat.s4')];

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setOpen(true)}
            className={`no-print fixed right-4 z-[1100] flex h-16 w-16 items-center justify-center rounded-full bg-green-700 text-white shadow-lift hover:bg-green-900 ${
              inApp ? 'bottom-24 md:bottom-6' : 'bottom-6'
            }`}
            aria-label={t('chat.open')}
          >
            <Bot className="h-8 w-8" aria-hidden />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-modal="false"
            aria-labelledby="chat-title"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.2 }}
            className="no-print fixed inset-0 z-[1700] flex flex-col bg-white sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[620px] sm:max-h-[calc(100vh-3rem)] sm:w-[400px] sm:rounded-2xl sm:shadow-lift"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <header className="flex items-center gap-2 border-b border-green-100 bg-green-700 px-3 py-2 text-white sm:rounded-t-2xl">
              <Bot className="h-6 w-6" aria-hidden />
              <h2 id="chat-title" className="flex-1 text-lg font-bold text-white">
                {t('chat.title')}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSpeaker((s) => !s);
                  stopSpeaking();
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/15"
                aria-pressed={speaker}
                aria-label={speaker ? t('chat.speakerOn') : t('chat.speakerOff')}
                title={speaker ? t('chat.speakerOn') : t('chat.speakerOff')}
              >
                {speaker ? <Volume2 className="h-5 w-5" aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}
              </button>
              <button
                type="button"
                onClick={() => setMessages([])}
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/15"
                aria-label={t('chat.clear')}
                title={t('chat.clear')}
              >
                <Trash2 className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/15"
                aria-label={t('common.close')}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-green-50 p-3" aria-live="polite">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white p-3 shadow-soft">{t('chat.hello')}</div>
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {starters.map((s) => (
                    <button key={s} type="button" onClick={() => void send(s)} className="chip min-h-[44px] border border-green-500/40 bg-white text-left hover:bg-green-100">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl p-3 ${
                      m.role === 'user' ? 'rounded-tr-sm bg-green-700 text-white' : 'rounded-tl-sm bg-white shadow-soft'
                    }`}
                  >
                    {m.content}
                    {m.source === 'fallback' && (
                      <p className="mt-2 flex items-start gap-1 text-xs text-amber-800">
                        <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {t('chat.offlineNote')}
                      </p>
                    )}
                    {m.action && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/app/${m.action!.target}`);
                          if (window.innerWidth < 640) setOpen(false);
                        }}
                        className="btn-secondary mt-2 min-h-[40px] w-full text-sm"
                      >
                        {t('common.goTo', { page: t(`nav.${m.action.target}`) })} <ArrowRight className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('chat.thinking')}
                </p>
              )}
            </div>

            <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-green-100 p-2">
              <button
                type="button"
                onClick={() => void mic()}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                  listening ? 'animate-pulse bg-danger-500 text-white' : 'bg-green-100 text-green-900'
                }`}
                aria-label={listening ? t('chat.listening') : t('chat.mic')}
                aria-pressed={listening}
              >
                {listening ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
              </button>
              <label htmlFor="chat-input" className="sr-only">
                {t('chat.placeholder')}
              </label>
              <input
                id="chat-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={listening ? t('chat.listening') : t('chat.placeholder')}
                className="input min-w-0 flex-1"
                autoComplete="off"
                maxLength={500}
              />
              <button type="submit" className="btn-primary h-12 w-12 shrink-0 px-0" disabled={!input.trim() || busy} aria-label={t('chat.send')}>
                <Send className="h-5 w-5" aria-hidden />
              </button>
            </form>
            <p className="px-3 pb-2 text-[11px] leading-snug text-slate-500">{t('chat.disclaimer')}</p>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
