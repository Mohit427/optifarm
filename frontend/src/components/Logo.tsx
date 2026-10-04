import { Link } from 'react-router-dom';

export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#15803D" />
      <path
        d="M32 52C32 36 20 30 14 28c2 12 8 22 18 24zm0 0c0-18 10-28 20-30-1 16-8 27-20 30z"
        fill="#DCFCE7"
      />
      <circle cx="32" cy="20" r="7" fill="none" stroke="#FACC15" strokeWidth="3.5" />
      <path d="M37 25l5 5" stroke="#FACC15" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ to = '/', markOnlyOnMobile = false }: { to?: string; markOnlyOnMobile?: boolean }) {
  return (
    <Link to={to} className="flex shrink-0 items-center gap-2 rounded-lg" aria-label="OptiFarm home">
      <LogoMark />
      <span className={`text-xl font-extrabold tracking-tight text-green-900 ${markOnlyOnMobile ? 'hidden sm:inline' : ''}`}>
        Opti<span className="text-green-600">Farm</span>
      </span>
    </Link>
  );
}
