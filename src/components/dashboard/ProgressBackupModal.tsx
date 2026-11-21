"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  DatabaseBackup,
  Download,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { cn } from "@/lib/cn";
import {
  parseLearningProgressBackup,
  serializeLearningProgress,
  useLearningStore,
} from "@/store/useLearningStore";

interface ProgressBackupModalProps {
  open: boolean;
  onClose: () => void;
}

function ProgressBackupModalContent({ onClose }: { onClose: () => void }) {
  const completedLessonIds = useLearningStore(
    (state) => state.completedLessonIds,
  );
  const completedScenarioIds = useLearningStore(
    (state) => state.completedScenarioIds,
  );
  const quizScores = useLearningStore((state) => state.quizScores);
  const drillStats = useLearningStore((state) => state.drillStats);
  const diagnosticDomainScores = useLearningStore(
    (state) => state.diagnosticDomainScores,
  );
  const lastVisitedPath = useLearningStore((state) => state.lastVisitedPath);
  const importProgress = useLearningStore((state) => state.importProgress);
  const resetProgress = useLearningStore((state) => state.resetProgress);

  const [importText, setImportText] = useState("");
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const buildBackupJson = () =>
    serializeLearningProgress({
      completedLessonIds,
      completedScenarioIds,
      quizScores,
      drillStats,
      diagnosticDomainScores,
      lastVisitedPath,
    });

  const handleDownload = () => {
    const json = buildBackupJson();
    const datePart = new Date().toISOString().slice(0, 10);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `netforge-progress-${datePart}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setFeedback({
      kind: "success",
      message: `バックアップファイル (netforge-progress-${datePart}.json) をダウンロードしました。`,
    });
  };

  const handleCopyJson = async () => {
    const json = buildBackupJson();
    try {
      await navigator.clipboard.writeText(json);
      setCopiedJson(true);
      setImportText(json);
      window.setTimeout(() => setCopiedJson(false), 1800);
      setFeedback({
        kind: "success",
        message: "現在の学習データJSONをクリップボードへコピーしました。",
      });
    } catch {
      setImportText(json);
      setFeedback({
        kind: "success",
        message: "下のテキストエリアに現在のバックアップJSONを表示しました。",
      });
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setImportText(content);
      const parsed = parseLearningProgressBackup(content);
      if (!parsed.ok) {
        setFeedback({ kind: "error", message: parsed.error });
        return;
      }
      importProgress(parsed.data);
      setFeedback({
        kind: "success",
        message: `ファイルから復元しました（記事 ${parsed.summary.completedLessons}件 / ラボ ${parsed.summary.completedScenarios}件 / ドリル正解 ${parsed.summary.drillSolved}問）。`,
      });
    };
    reader.readAsText(file);
  };

  const handleImportText = () => {
    const parsed = parseLearningProgressBackup(importText);
    if (!parsed.ok) {
      setFeedback({ kind: "error", message: parsed.error });
      return;
    }
    importProgress(parsed.data);
    setFeedback({
      kind: "success",
      message: `JSONから復元しました（記事 ${parsed.summary.completedLessons}件 / ラボ ${parsed.summary.completedScenarios}件 / ドリル正解 ${parsed.summary.drillSolved}問）。`,
    });
  };

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    resetProgress();
    setConfirmReset(false);
    setFeedback({
      kind: "success",
      message: "すべての学習進捗を初期状態へリセットしました。",
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="学習進捗バックアップと復元"
    >
      <button
        type="button"
        aria-label="モーダルを閉じる"
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-xs"
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-[#080d19] shadow-2xl shadow-black/70">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <DatabaseBackup className="h-5 w-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                学習進捗のバックアップ / 復元
              </h3>
              <p className="text-xs text-slate-400">
                記事修了・クリア済みラボ・模試結果を JSON 形式で保存・移行できます
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="terminal-scroll flex-1 space-y-5 overflow-y-auto p-5">
          {/* Current Status Summary */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-[#05080f] p-3 text-center">
            <div>
              <p className="text-[11px] text-slate-400">修了記事</p>
              <p className="font-mono text-base font-bold text-cyan-300">
                {completedLessonIds.length} 件
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">クリア課題</p>
              <p className="font-mono text-base font-bold text-emerald-300">
                {completedScenarioIds.length} 件
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">クイズ/模試記録</p>
              <p className="font-mono text-base font-bold text-violet-300">
                {Object.keys(quizScores).length} 件
              </p>
            </div>
          </div>

          {feedback && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs",
                feedback.kind === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200",
              )}
            >
              {feedback.kind === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Export Section */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              1. エクスポート (JSON保存)
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
              >
                <Download className="h-3.5 w-3.5" />
                <span>JSONをダウンロード</span>
              </button>
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0d1322] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-500/50"
              >
                {copiedJson ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>コピー済み</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>JSONをコピー / 表示</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              2. インポート (ファイルまたはJSON貼り付け)
            </h4>

            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="progress-import-file"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0d1322] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50"
              >
                <Upload className="h-3.5 w-3.5 text-cyan-400" />
                <span>JSONファイルを選択して復元</span>
              </label>
              <input
                id="progress-import-file"
                name="progressImportFile"
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="sr-only"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="progress-import-text"
                className="block text-xs text-slate-400"
              >
                またはバックアップ JSON テキストを貼り付け:
              </label>
              <textarea
                id="progress-import-text"
                name="progressImportText"
                rows={5}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{"version": 1, "data": { ... }}'
                className="w-full rounded-lg border border-slate-700 bg-[#05080f] p-3 font-mono text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleImportText}
                disabled={!importText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>貼り付けたJSONから復元を実行</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                  confirmReset
                    ? "border-rose-500 bg-rose-500 text-slate-950 font-bold"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
                )}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>
                  {confirmReset
                    ? "本当によろしいですか？(もう一度クリック)"
                    : "進捗をリセット"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProgressBackupModal({
  open,
  onClose,
}: ProgressBackupModalProps) {
  if (!open) {
    return null;
  }
  return <ProgressBackupModalContent key="open" onClose={onClose} />;
}
