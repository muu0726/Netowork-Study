export interface DiffLine {
  type: "context" | "add" | "remove";
  lineNo: number;
  text: string;
  highlight?: boolean;
}

export interface ConfigReviewCase {
  id: string;
  title: string;
  kind: "diff" | "topology";
  difficulty: "初級" | "中級" | "実践";
  scenario: string;
  diffLines?: DiffLine[];
  topologyDiagramId?: "spof-core";
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  fixedSnippet: string;
}

export const CONFIG_REVIEW_CASES: ConfigReviewCase[] = [
  {
    id: "cr-acl-implicit-deny",
    title: "ACL 投入 Diff レビュー（社内通信の全断リスク）",
    kind: "diff",
    difficulty: "初級",
    scenario:
      "外部委託先端末 (192.168.50.99) からの SSH (TCP/22) だけを禁止し、それ以外の業務通信は引き続き許可する目的で、本番ルータの社内LAN入口 (Gig0/0 in) へ投入予定のコンフィグ差分 (Diff) です。この変更を適用すると起きる重大事故を見抜いてください。",
    diffLines: [
      { type: "context", lineNo: 10, text: "interface Gig0/0" },
      {
        type: "context",
        lineNo: 11,
        text: " ip address 192.168.50.1 255.255.255.0",
      },
      {
        type: "add",
        lineNo: 12,
        text: " ip access-group BLOCK_VENDOR_SSH in",
        highlight: true,
      },
      { type: "context", lineNo: 13, text: "!" },
      {
        type: "add",
        lineNo: 14,
        text: "ip access-list extended BLOCK_VENDOR_SSH",
      },
      {
        type: "add",
        lineNo: 15,
        text: " deny tcp host 192.168.50.99 any eq 22",
        highlight: true,
      },
      { type: "context", lineNo: 16, text: "!" },
    ],
    question: "この Diff を本番適用した場合に発生する致命的な問題は何ですか？",
    options: [
      "末尾に `permit ip any any` が無いため「暗黙の deny」により 192.168.50.0/24 からの全通信が遮断される",
      "インターフェースに IP アドレスを 2 つ設定していないため通信が止まる",
      "`in` ではなく `out` に適用しないと SSH が止まらない",
      "拡張ACLでは `eq 22` というポート指定構文が使えない",
    ],
    correctOptionIndex: 0,
    explanation:
      "Cisco IOS の ACL は末尾に目に見えない `deny ip any any`（暗黙の deny）が存在します。`deny` ルールだけを記述して `permit ip any any` を書き忘れると、Gig0/0 に入ってくる他の全ユーザーの HTTP/DNS/業務トラフィックまで一斉に破棄されてしまいます。",
    fixedSnippet:
      "ip access-list extended BLOCK_VENDOR_SSH\n deny tcp host 192.168.50.99 any eq 22\n permit ip any any",
  },
  {
    id: "cr-spof-topology",
    title: "冗長化構成図レビュー（単一障害点 SPOF の特定）",
    kind: "topology",
    difficulty: "中級",
    scenario:
      "「どの機器・回線が1つ故障しても拠点〜データセンター間通信が途絶えない完全冗長構成」として設計レビューに提出されたトポロジ図です。この設計に潜む単一障害点 (SPOF) を指摘してください。",
    topologyDiagramId: "spof-core",
    question: "この構成図において、1箇所の故障で全通信が停止してしまう単一障害点 (SPOF) はどこですか？",
    options: [
      "Edge Router-1 と Edge Router-2 の2台構成部分",
      "中央に1台だけ直列配置されている FW-Main（ファイアウォール）",
      "Core-SW1 と Core-SW2 を結ぶ冗長L2リンク",
      "WAN回線が Primary / Backup の2本ある点",
    ],
    correctOptionIndex: 1,
    explanation:
      "上下の回線・ルータ・コアスイッチを2重化していても、その間に1台だけの FW-Main が直列に挟まっているため、FW-Main の故障やメンテナンス再起動で全通信が停止します。FW も HA クラスタ (Active/Standby 等) で2台冗長化し、クロス結線する必要があります。",
    fixedSnippet:
      "改善策: FW-Main を FW-1 / FW-2 の HA ペアへ冗長化し、Edge-R1/R2 と Core-SW1/SW2 の双方をクロス接続する。",
  },
  {
    id: "cr-trunk-overwrite",
    title: "L2スイッチ トランク設定変更 Diff レビュー（通信断リスク）",
    kind: "diff",
    difficulty: "実践",
    scenario:
      "既存の VLAN 10 (基幹業務) と VLAN 20 (開発) が通っているコアスイッチ接続トランクポート (Gig0/24) に、新しく構築した VLAN 30 (IoT監視) も通すための変更 Diff です。問題点を指摘してください。",
    diffLines: [
      { type: "context", lineNo: 40, text: "interface Gig0/24" },
      { type: "context", lineNo: 41, text: " switchport mode trunk" },
      {
        type: "remove",
        lineNo: 42,
        text: " switchport trunk allowed vlan 10,20",
      },
      {
        type: "add",
        lineNo: 42,
        text: " switchport trunk allowed vlan 30",
        highlight: true,
      },
      { type: "context", lineNo: 43, text: "!" },
    ],
    question: "このコマンド変更を投入すると現場でどのような障害が発生しますか？",
    options: [
      "`add` キーワードが無いため許可リストが上書きされ、稼働中の VLAN 10 と VLAN 20 の通信が即座に切断される",
      "Gig0/24 が自動的にアクセスポートへ戻ってしまう",
      "VLAN 30 の通信速度が 10Mbps に低下する",
      "Native VLAN 1 が削除されてスイッチが再起動する",
    ],
    correctOptionIndex: 0,
    explanation:
      "実務のメンテナンス事故として非常に多いミスです。`switchport trunk allowed vlan 30` と打つと既存リスト `(10,20)` が消えて `30` のみになります。既存の VLAN 通信を落とさず追加するには必ず `switchport trunk allowed vlan add 30` を使用します。",
    fixedSnippet:
      "interface Gig0/24\n switchport mode trunk\n switchport trunk allowed vlan add 30",
  },
];
