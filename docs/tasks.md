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

## Phase 5: ACL・NAT/NAPT・DHCP のエンジン拡張と実践シナリオ
- [x] L4 TCP/UDP パケット追跡 & ホストコマンド (`curl`, `nc -zv`) 実装
- [x] 標準/拡張/名前付き ACL・32bit ワイルドカードビット演算・暗黙の deny・ヒットカウンター・`show access-lists` 実装
- [x] NAT / NAPT (overload) 変換・逆NAT・ホップ変換履歴 (`natTranslation`)・トポロジ視覚化
- [x] DHCP サーバプール・除外設定・バインディング・`ipconfig /renew` 実装
- [x] 追加シナリオ 3本 (`cli-nat-acl-web`, `ts-acl-web-blocked`, `ts-dhcp-failure`) & Vitest 単体テスト実装
- [x] `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` 通過確認

## Phase 6: OSPF・STP・HSRP（動的ルーティング＆冗長化）
- [x] シングルエリア OSPF (ダイクストラ最短経路・ネイバー・`show ip ospf neighbor`)
- [x] STP (ブリッジID比較・ルートブリッジ選出・ブロッキングポート可視化)
- [x] HSRP (仮想IP/Active/Standby・優先度プリエンプト・フェイルオーバー)
- [x] 冗長化ラボ＆障害チケット 4本 (`cli-ospf-cost`, `cli-stp-root-bridge`, `ts-ospf-neighbor-down`, `ts-hsrp-failover-broken`) & 単体テスト追加
- [x] `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` 通過確認

## Phase 7: 実務OS（Linux）・Webインフラ・クラウドVPC統合ラボ
- [x] Linux Host モード (`ip addr`, `ip route`, `ss -tulpn`, `dig`, `systemctl`, `curl -v`) & 障害チケット (`ts-linux-nginx-down`)
- [x] L7 Web・TLSハンドシェイク段階出力 & デーモン状態管理
- [x] クラウドVPC (IGW/NAT GW/Security Group/NACL/Route Table) 純粋エンジン & `/labs/cloud` ラボ (3シナリオ)
- [x] `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` 通過確認

## Phase 8: IPv6・管理プロトコル・セキュリティ完全網羅 & 総合実力診断
- [x] IPv6 純粋演算モジュール (`ipv6-math.ts`) & `/tools` インタラクティブ圧縮/展開・識別クイズツール (`Ipv6Tool.tsx`)
- [x] Stage 2〜3 カリキュラム完全拡充（IPv6基礎 / 管理監視 SSH・CDP・NTP・Syslog・SNMP / L2セキュリティ・無線LAN / Web・TLS 1.3・LB・BGP・コンテナ網 全20レッスン）
- [x] 総合実力診断エンジン (`diagnostic-engine.ts`)・6分野レーダーチャート (`SkillRadarSection.tsx`)・模擬試験 & ランダム障害対応 (`/exam`)
- [x] 全テスト・型チェック・ESLint・Next.js 本番ビルド最終確認 (`npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`)
