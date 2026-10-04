import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';
import { fmt } from '../lib/data';

interface Props {
  value: number;
  digits?: number;
  prefix?: string;
  suffix?: string;
  /** Start counting only once scrolled into view (landing counters). */
  onView?: boolean;
  format?: (n: number) => string;
}

/** Counts smoothly to `value`; jumps straight there when reduced motion is requested. */
export function AnimatedNumber({ value, digits = 0, prefix = '', suffix = '', onView, format }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(onView ? 0 : value);
  const from = useRef(shown);

  useEffect(() => {
    if (onView && !inView) return;
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => setShown(v),
      onComplete: () => (from.current = value),
    });
    return () => {
      from.current = value;
      controls.stop();
    };
  }, [value, inView, onView, reduce]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {format ? format(shown) : fmt(shown, digits)}
      {suffix}
    </span>
  );
}
