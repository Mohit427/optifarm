import { Volume2, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSpeak } from '../hooks/useSpeak';

interface Props {
  text: string;
  label?: string;
  id?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'icon';
}

export function SpeakButton({ text, label, id = 'btn', className = '', variant = 'secondary' }: Props) {
  const { t } = useTranslation();
  const { say, speakingId } = useSpeak();
  const active = speakingId === id;
  const Icon = active ? Square : Volume2;
  const text_ = active ? t('common.stop') : (label ?? t('common.listen'));
  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={() => say(text, id)}
        className={`inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-900 hover:bg-green-500/30 ${className}`}
        aria-label={text_}
        aria-pressed={active}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => say(text, id)}
      className={`${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} ${className}`}
      aria-pressed={active}
    >
      <Icon className="h-5 w-5" aria-hidden />
      {text_}
    </button>
  );
}
