# ネットワーク学習プラットフォーム 実装タスク管理

## Phase 1: プロジェクト基盤 & デザインシステム構築
- [x] Next.js (App Router) + TypeScript (`strict: true`) + Tailwind CSS v4 環境構築
- [x] Vitest + ESLint (Flat Config) + パスエイリアス (`@/*`) 設定
- [x] Zustand `persist` ストア (`useLearningStore`) と Hydration 対策フック (`useHydrated`) 実装
- [x] ダークモード・デザインシステム (`globals.css`, `Badge`, `Card`, `ProgressBar`)
- [x] 共通レイアウト (`AppShell`, `Sidebar`, `Header`) とダッシュボード (`/`)・ルート枠組み作成
- [x] `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build` の通過確認

## Phase 2: 仮想ネットワークコアエンジン & 単体テスト実装
- [x] コアエンジン型定義 (`src/lib/network-engine/types.ts`) — JSONシリアライズ可能・UI非依存設計
- [x] 32bit符号なしIP・サブネット計算モジュール (`src/lib/network-engine/ip-math.ts`) — 厳格バリデーション・LPM検索
- [x] パケット疎通 & DNS解決シミュレータ (`src/lib/network-engine/packet-simulator.ts`) — L2/VLAN/802.1Q/L3/TTL/往復検証/DNS
- [x] Cisco IOS & エンドホスト CLI パーサ (`src/lib/network-engine/cli-engine.ts`) — 階層モード・前方一致省略・`no`構文・`show`・サジェスト
- [x] シナリオ自動採点エンジン (`src/lib/network-engine/evaluator.ts`) & バレルエクスポート (`index.ts`)
- [x] Vitest 単体テストスイート作成（`ip-math.test.ts`, `cli-engine.test.ts`, `packet-simulator.test.ts`, `evaluator.test.ts`）
- [x] `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` の通過確認

## Phase 3: 仮想ラボ (`/labs/cli`) & 障害対応シミュレータ (`/labs/troubleshoot`) 実装
- [x] CLI構築ラボシナリオデータ作成（2本: 基本IP設定とL3ルーティング / VLAN分割とRouter-on-a-Stick）
- [x] 障害対応チケットシナリオデータ作成（3本: VLAN割当ミス / DNS設定ミス / 非対称ルーティング・誤ルート）
- [x] トポロジSVGコンポーネント（機器選択・Link Up/Down表示・`PacketTraceResult` 連動アニメーション・エラー吹き出し）
- [x] 高機能CLIターミナルコンポーネント（履歴・Tab補完・`?` ヘルプ・リセット・逆引きチートシート・3段階ヒント・クリア祝福UI）
- [x] `/labs/cli` および `/labs/troubleshoot` ページ統合・Zustandクリア連携・検証

## Phase 4: カリキュラム (`/learn`) & 実践ツール (`/tools`) 実装
- [x] 型定義された構造化レッスンデータ (`src/data/lessons/`) Stage 1〜3 作成
- [x] カリキュラム一覧 (`/learn`) & 記事詳細 (`/learn/[stage]/[slug]`) 実装（図解/コマンド切替タブ・用語ツールチップ・章末クイズ）
- [x] インタラクティブ・サブネット計算機＆ランダム出題ドリル
- [x] Wireshark風3ペイン・パケット解析ドリル
- [x] 構成図レビュー＆コンフィグDiff演習
- [x] リロード後 Hydration エラーなし永続化確認 & 最終ビルド検証
