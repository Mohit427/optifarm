import { useState } from 'react';
import { CloudOff, Wifi, BotOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/AppState';

export function ConnectivityBadge() {
  const { t } = useTranslation();
  const { connectivity } = useApp();
  const [open, setOpen] = useState(false);
  const offline = !connectivity.online;
  const aiOff = connectivity.online && !(connectivity.backend && connectivity.ai);

  const { Icon, label, cls, help } = offline
    ? { Icon: CloudOff, label: t('status.offline'), cls: 'bg-slate-800 text-white', help: t('status.offlineHelp') }
    : aiOff
      ? { Icon: BotOff, label: t('status.aiOff'), cls: 'bg-amber-100 text-amber-900', help: t('status.aiOffHelp') }
      : { Icon: Wifi, label: t('status.online'), cls: 'bg-green-100 text-green-900', help: null };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => help && setOpen((o) => !o)}
        className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${cls}`}
        aria-expanded={help ? open : undefined}
        aria-label={help ? `${label}. ${help}` : label}
      >
        <Icon className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && help && (
        <div className="card absolute right-0 top-12 z-[1100] w-72 p-4 text-sm" role="note">
          {help}
        </div>
      )}
    </div>
  );
}
