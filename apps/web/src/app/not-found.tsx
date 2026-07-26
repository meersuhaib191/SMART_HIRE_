import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white font-sans text-center">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-4 shadow-2xl">
        <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto font-black text-xl">
          404
        </div>
        <h2 className="text-xl font-black tracking-tight">Page Not Found</h2>
        <p className="text-xs text-zinc-400 font-medium">
          The requested page could not be located on SmartHire.
        </p>
        <Link
          href="/"
          className="inline-block w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-sm"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
