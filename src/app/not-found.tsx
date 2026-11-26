import { AlertTriangle, BookOpen, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4">
      <div className="w-full rounded-2xl border border-slate-800 bg-[#0d1322] p-8 text-center shadow-2xl shadow-black/50">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-cyan-400">
          404 Not Found
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-50">
          404 — ページが見つかりません
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          指定されたURLのページは存在しないか、移動された可能性があります。ダッシュボードまたはカリキュラム一覧から目的の学習コンテンツへ移動してください。
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>ダッシュボードへ戻る</span>
          </Link>
          <Link
            href="/learn"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#070b14] px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-cyan-200"
          >
            <BookOpen className="h-4 w-4 text-cyan-400" />
            <span>カリキュラム一覧を見る</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
