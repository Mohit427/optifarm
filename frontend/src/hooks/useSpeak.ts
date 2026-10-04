import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { speak, stopSpeaking } from '../lib/voice';
import { currentLang } from '../i18n';
import { toast } from '../components/Toast';

/** Read text aloud in the UI language, with a visible notice when no voice exists. */
export function useSpeak() {
  const { t } = useTranslation();
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => () => void stopSpeaking(), []);

  const say = useCallback(
    (text: string, id = 'default') => {
      if (speakingId === id) {
        stopSpeaking();
        setSpeakingId(null);
        return;
      }
      const res = speak(text, currentLang(), () => setSpeakingId(null));
      if (res === 'ok') setSpeakingId(id);
      else toast(res === 'no-voice' ? t('voice.noVoice') : t('voice.unsupported'));
    },
    [speakingId, t],
  );

  return { say, speakingId, stop: () => (stopSpeaking(), setSpeakingId(null)) };
}
