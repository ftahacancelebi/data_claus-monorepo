import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <div className="max-w-md w-full text-center">
        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
          404
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          We couldn&apos;t find that page
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          The link may be outdated, or you may have typed the URL wrong.
        </p>
        <div className="flex justify-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
          >
            Go home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
