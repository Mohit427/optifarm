import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info } from 'lucide-react';

type Listener = (msg: string) => void;
const listeners = new Set<Listener>();

/** Show a short, polite notice (e.g. "no voice for this language"). */
// eslint-disable-next-line react-refresh/only-export-components
export function toast(msg: string) {
  listeners.forEach((l) => l(msg));
}

export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  useEffect(() => {
    const l: Listener = (msg) => {
      const id = Date.now() + Math.random();
      setItems((xs) => (xs.some((x) => x.msg === msg) ? xs : [...xs, { id, msg }]));
      window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4500);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-20 z-[1200] flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {items.map((x) => (
          <motion.div
            key={x.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto flex max-w-md items-start gap-2 rounded-xl bg-ink-900 px-4 py-3 text-sm text-white shadow-lift"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {x.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
