import { Link } from 'react-router-dom';
import { ArrowRight, Sprout } from 'lucide-react';

export function NeedSetup({ message, to, cta }: { message: string; to: string; cta: string }) {
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
        <Sprout className="h-8 w-8" aria-hidden />
      </span>
      <p className="mt-4 text-lg font-semibold text-green-900">{message}</p>
      <Link to={to} className="btn-primary mt-6">
        {cta} <ArrowRight className="h-5 w-5" aria-hidden />
      </Link>
    </div>
  );
}
