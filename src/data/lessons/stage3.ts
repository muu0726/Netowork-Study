import type { LessonArticle } from "./types";

export const STAGE3_LESSONS: LessonArticle[] = [
  {
    id: "stage3/troubleshooting-layers",
    stage: "stage-3",
    slug: "troubleshooting-layers",
    title: "レイヤ別障害切り分けメソドロジー",
    summary:
      "L1からL7へボトムアップ／分割統治で原因を最短特定する実務アプローチを学びます。",
    estimatedMinutes: 20,
    diagramVariant: "troubleshooting-layers",
    relatedHref: {
      href: "/labs/troubleshoot",
      label: "障害対応シミュレータでチケットを解決する",
    },
    glossary: [
      {
        term: "ボトムアップ方式",
        shortDef: "L1（物理）から L2 → L3 → L7 へと下層から順に確認する手法",
        detail:
          "ケーブル抜けやリンクダウンがある状態でアプリ設定を疑う無駄を防ぎ、確実に土台から健全性を確認できます。",
        layer: "運用",
      },
      {
        term: "分割統治",
        shortDef: "通信経路の中間地点（例: GWへのPing）を試し問題範囲を半分に絞る手法",
        detail:
          "L3（Ping）が通るなら L1〜L3 は正常と即断して上位層 (DNS/HTTP/Firewall) を調査でき、最も実務で多用されます。",
        layer: "運用",
      },
      {
        term: "非対称ルーティング",
        shortDef: "往路と復路が異なる経路を通ること（片側ルート欠落含む）",
        detail:
          "往路が通っても復路のルータに戻りルートが無ければ通信不可になり、ステートフルFWが間にあると片方向破棄の原因にもなります。",
        layer: "L3",
      },
    ],
    beginnerMode: {
      analogyTitle: "体調不良を「呼吸(L1) → 脈拍(L2) → 血液循環(L3) → 言語(L7)」の順に診る診察手順",
      analogyText:
        "『システムに繋がらない』と言われたとき、当てずっぽうで設定を書き換えると二次障害を起こします。プロのエンジニアはまず症状を聞き（「IP直打ちなら繋がるか？」「隣のPCはどうか？」）、分割統治 や ボトムアップ方式 を使って数回の確認コマンドで原因レイヤを特定します。",
      keyPoints: [
        {
          title: "症状の「比較対象」を聞くだけで8割絞れる",
          body: "「特定の1台だけNG・隣はOK」ならスイッチポート(VLAN)や端末設定、「全員NG」ならコア・ゲートウェイ・サーバ側を疑います。",
        },
        {
          title: "Ping は「IP直打ち」→「GW」→「ローカル」の順で撃つ",
          body: "まず宛先 IP へ Ping、次に自分のデフォルトゲートウェイへ Ping、さらに ホスト名 (`nslookup`) を試せば、L1-L3 か L7 かが一瞬で分離します。",
        },
        {
          title: "片道だけでなく「復路」を必ず意識する",
          body: "拠点間 Ping がタイムアウトするときは、送信元側ルータだけでなく宛先側ルータの `show ip route` も必ず確認します。",
        },
      ],
      steps: [
        "【情報収集】影響範囲（1台か全員か）と直近の変更作業（メンテナンス履歴）を確認します。",
        "【L1/L2確認】`show ip interface brief` で Link Up を確認し、VLAN 構成 (`show vlan brief`) に不整合が無いか見ます。",
        "【L3/L7確認】`show ip route`・`traceroute`・`nslookup` で往路/復路の経路と名前解決を検証し、最小限の修正で復旧確認します。",
      ],
    },
    examMode: {
      examTips: [
        "症状別の最短アプローチ: IP OK / URL NG → DNS (L7)、同一サブネット内の特定端末のみ NG → SWのVLAN/ポート状態 (L1/L2)、別拠点宛てタイムアウト → 往路/復路ルートまたは ACL/NAT (L3)。",
      ],
      referenceTable: {
        headers: ["典型的な症状", "最有力レイヤ", "最初に打つべき確認コマンド"],
        rows: [
          ["特定ポートのみ通信不可", "L1 / L2", "show ip interface brief / show vlan brief"],
          ["IP直打ちOK・ホスト名NG", "L7 (DNS)", "ipconfig / nslookup <host>"],
          ["別サブネット宛てタイムアウト", "L3 (Routing)", "traceroute / 双方ルータで show ip route"],
          ["接続瞬断 / Connection Refused", "L4 / ACL", "パケットキャプチャ (TCP RST確認) / show access-lists"],
        ],
      },
      commandBlocks: [
        {
          title: "実務の3点確認セット（端末 → SW → Router）",
          code: "PC$ ipconfig\nPC$ nslookup intranet.local\nPC$ traceroute 192.168.30.10\nSW1# show vlan brief\nR1# show ip route",
          note: "設定変更コマンド (`conf t`) を叩く前に、必ず読み取り専用コマンドで事実確認を完了させるのが鉄則です。",
        },
      ],
      pitfalls: [
        "原因を特定しないまま `no ip route` や `shutdown` を連発すると状況を悪化させます。変更前後で必ず差分を意識しましょう。",
      ],
    },
    quiz: [
      {
        id: "q-ts-1",
        question: "「昨日まで繋がっていたが、深夜メンテナンスの静的ルート追加後から拠点間 Ping がタイムアウトする」障害で最初に確認すべきコマンドの組み合わせはどれですか？",
        choices: [
          "PCのMACアドレス変更",
          "往路・復路両方のルータでの `show ip route` と `traceroute`",
          "スイッチの `vlan 1` 削除",
          "LANケーブルのCat6からCat5eへの交換",
        ],
        correctIndex: 1,
        explanation:
          "変更履歴が静的ルートであり拠点間通信がタイムアウトしているため、双方ルータのルーティングテーブルと経路途絶地点の確認が最短です。",
      },
      {
        id: "q-ts-2",
        question: "障害切り分けにおける「分割統治（Divide and Conquer）」の考え方として正しいものはどれですか？",
        choices: [
          "必ず物理ケーブルの交換から始める",
          "L3 Ping 等の中間層の疎通確認から始め、正常な層を一気に除外して調査範囲を絞る",
          "すべての機器を同時に再起動する",
          "L7 アプリケーションのソースコードから読む",
        ],
        correctIndex: 1,
        explanation:
          "分割統治は L3 (または L4) などの境界テストを行い、結果に応じて上層・下層のどちらに問題があるかを二分探索的に絞り込む手法です。",
      },
    ],
  },
  {
    id: "stage3/packet-analysis",
    stage: "stage-3",
    slug: "packet-analysis",
    title: "パケットキャプチャ読解と異常通信パターン",
    summary:
      "TCP RST、ARP無応答、DNS NXDOMAINなど現場で遭遇するパケット異常の読み解き方を解説。",
    estimatedMinutes: 25,
    diagramVariant: "packet-analysis",
    relatedHref: {
      href: "/tools?tab=wireshark",
      label: "Wireshark風パケット解析ドリルに挑戦する",
    },
    glossary: [
      {
        term: "TCP RST",
        shortDef: "TCPコネクションを即座に強制切断・拒否する制御フラグ",
        detail:
          "ポートが開いていない・FWが積極拒否した・セッション状態不整合などのときに送信されます。",
        layer: "L4",
      },
      {
        term: "キャプチャフィルタ / 表示フィルタ",
        shortDef: "必要なパケットだけを絞り込む2種類のフィルタ",
        detail:
          "BPF構文で保存対象を絞るのがキャプチャフィルタ、取得後に `tcp.flags.reset == 1` 等で見たい行だけ出すのが表示フィルタです。",
        layer: "解析",
      },
      {
        term: "TCP Retransmission",
        shortDef: "ACKが返ってこないため同じデータを再送している異常サイン",
        detail:
          "ネットワーク途中のパケットロス、輻輳、または受信側が応答不能になっている兆候を示します。",
        layer: "L4",
      },
    ],
    beginnerMode: {
      analogyTitle: "監視カメラと会話録音 (Wireshark) で『誰が最後に断ったか』を突き止める",
      analogyText:
        "サーバ担当者が『ネットワークが悪い』と言い、ネットワーク担当者が『サーバが悪い』と譲らないとき、動かぬ証拠になるのがパケットキャプチャです。もし PC から送った SYN にサーバから TCP RST が即座に返っていれば『ネットワークは往復届いているが、サーバの該当ポートが閉まっている』と一発で証明できます。",
      keyPoints: [
        {
          title: "3ペイン構造で「流れ → 詳細 → 生データ」を読む",
          body: "①一覧ペインで赤いエラー行（RST/NXDOMAIN等）を探し、②詳細ペインでIP/ポート/フラグを確認し、③16進ダンプで生バイト列を確かめます。",
        },
        {
          title: "「応答ゼロ (ARPリトライ / 再送)」と「拒否応答 (RST / NXDOMAIN)」を区別する",
          body: "相手から何らかのエラーパケットが返っているなら、そこまでの経路自体は疎通しています。",
        },
        {
          title: "ARP Who has の連打は L2/L1 遮断のサイン",
          body: "ゲートウェイの IP に対する ARP が何秒おきにも繰り返されるなら、VLAN 不一致や相手機器ダウンで同一セグメント通信が止まっています。",
        },
      ],
      steps: [
        "Wireshark の一覧ペインで表示フィルタ（例: `tcp.flags.reset == 1` や `dns`）を使い異常行に目星を付けます。",
        "該当パケットをクリックし、階層ツリーから送信元/宛先 IP・ポート・異常フラグを確認します。",
        "前後のシーケンス（SYN → RST なのか、SYN のみ無応答なのか）を時系列で繋げて原因を確定します。",
      ],
    },
    examMode: {
      examTips: [
        "Wireshark の代表的な表示フィルタ (`ip.addr == ...`, `tcp.port == 443`, `dns`, `arp`, `tcp.flags.reset == 1`) は実務スキルとして必須です。",
      ],
      referenceTable: {
        headers: ["キャプチャ上のパターン", "意味", "主な原因"],
        rows: [
          ["ARP Who has 連続・Reply なし", "L2到達不可", "VLAN不一致 / 相手NICダウン / IP誤設定"],
          ["TCP [SYN] に対し即 [RST, ACK]", "相手ポート閉塞", "宛先サービス停止 / ポート番号誤り / FW拒否"],
          ["TCP [SYN] のみ連続 (再送)", "途中サイレントドロップ", "FWの無言Drop / ルーティング片道欠落"],
          ["DNS response: No such name", "NXDOMAIN", "ホスト名タイポ / DNSレコード未登録"],
        ],
      },
      commandBlocks: [
        {
          title: "Linux/ネットワーク機器上の定番パケット取得コマンド",
          code: "$ tcpdump -i eth0 -nn host 192.168.20.10 and port 443 -w capture.pcap",
          note: "`-nn` を付けると名前解決でキャプチャが遅くなるのを防ぎ、生の IP とポート番号を記録できます。",
        },
      ],
      pitfalls: [
        "暗号化された HTTPS/TLS の通信中身はそのままでは平文で見えませんが、TCP ハンドシェイクや SNI、DNS、RST の有無だけで障害原因の多くは特定できます。",
      ],
    },
    quiz: [
      {
        id: "q-pcap-1",
        question: "Wireshark キャプチャで、クライアントの `TCP [SYN]` (宛先 443) に対してサーバから 1ms 後に `TCP [RST, ACK]` が返っていた場合、最も考えられる状況はどれですか？",
        choices: [
          "L2 スイッチで VLAN が不一致で届いていない",
          "パケットはサーバまで到達したが、443番ポートでサービスが待ち受けていない（または即拒否された）",
          "DNS サーバが停止している",
          "デフォルトゲートウェイが設定されていない",
        ],
        correctIndex: 1,
        explanation:
          "相手から RST, ACK が返っている時点で往復の L1〜L3 経路は通っています。宛先ポート閉塞（Webサーバプロセス停止等）やアクティブ拒否を示します。",
      },
      {
        id: "q-pcap-2",
        question: "同一セグメント内の通信開始時に `ARP Who has 192.168.10.1? Tell 192.168.10.10` ばかりが連続して出力され、応答が見当たらない場合に疑うべき異常はどれですか？",
        choices: [
          "HTTP 404 Not Found",
          "ゲートウェイ側ポートの Link Down または VLAN 不一致",
          "SSL 証明書の有効期限切れ",
          "NAT テーブルのポート番号枯渇",
        ],
        correctIndex: 1,
        explanation:
          "ARP 応答が全く返らないのは、同一 L2 セグメント内でゲートウェイまでフレームが届いていない（Link Down や VLAN 不一致等）典型サインです。",
      },
    ],
  },
  {
    id: "stage3/cloud-vpc-vpn",
    stage: "stage-3",
    slug: "cloud-vpc-vpn",
    title: "クラウドVPC設計・Security Group & VPN接続",
    summary:
      "オンプレミス知識をAWS/GCPのVPC・ルートテーブル・IPsec VPN設計へ接続します。",
    estimatedMinutes: 20,
    diagramVariant: "cloud-vpc-vpn",
    glossary: [
      {
        term: "VPC",
        shortDef: "クラウド上に作成する自分専用の仮想プライベートネットワーク",
        detail:
          "Virtual Private Cloud。CIDR ブロック（例: 10.10.0.0/16）を割り当て、Public/Private サブネットやルートテーブルを設計します。",
        layer: "Cloud L3",
      },
      {
        term: "Security Group",
        shortDef: "クラウドVMに適用するステートフル仮想ファイアウォール",
        detail:
          "インバウンドを許可すれば戻りトラフィックも自動許可される（ステートフル）点が、オンプレのステートレス ACL (Network ACL) との最大の違いです。",
        layer: "Cloud L4",
      },
      {
        term: "IPsec VPN",
        shortDef: "インターネット経由でオンプレとクラウドを暗号化接続するトンネル",
        detail:
          "Site-to-Site VPN。IKE (Phase 1/2) で鍵交換を行い、ESP で IP パケットを暗号化・認証して安全に拠点間通信を行います。",
        layer: "L3/VPN",
      },
    ],
    beginnerMode: {
      analogyTitle: "「オンプレのルータ・スイッチ・ACL」をクラウドの部品に翻訳する",
      analogyText:
        "AWS や GCP などのクラウドネットワークも、基礎はこれまで学んだ IP・サブネット・ルーティングそのものです。CIDR で部屋を区切るのが サブネット、玄関から外へ出す仕組みが Internet Gateway / NAT Gateway、そしてオンプレのルータの代わりに通信許可を管理するのが Security Group です。",
      keyPoints: [
        {
          title: "Public サブネットと Private サブネットの違いはルートテーブル",
          body: "デフォルトルート (0.0.0.0/0) が Internet Gateway (IGW) を向いているのが Public、NAT Gateway 等を向くか外へ出さないのが Private です。",
        },
        {
          title: "Security Group (ステートフル) vs Network ACL (ステートレス)",
          body: "Security Group は許可ルールのみ記述でき「戻り通信」を自動許可します。一方 Network ACL はオンプレの Cisco ACL と同様に「行き・帰り」の両方明記が必要です。",
        },
        {
          title: "ハイブリッドクラウドは CIDR 重複禁止が鉄則",
          body: "オンプレ (192.168.0.0/16) とクラウド VPC を IPsec VPN でつなぐとき、IP 範囲が被るとルーティング破綻するため設計段階で明確に分けます。",
        },
      ],
      steps: [
        "オンプレや他 VPC と重複しない CIDR（例: 10.20.0.0/16）で VPC を作成します。",
        "Web用の Public サブネットと DB 用の Private サブネットに分割し、ルートテーブルを紐づけます。",
        "Security Group で最小権限（Web→DB は 5432 のみ等）を設定し、必要なら IPsec VPN や専用線で本社と接続します。",
      ],
    },
    examMode: {
      examTips: [
        "ステートフル FW (Security Group) とステートレス ACL (NACL / Cisco標準拡張ACL) の違いはクラウド・CCNA双方で超頻出です。",
        "エフェメラルポート (例: 1024-65535) の許可忘れは、ステートレス ACL で戻り通信が止まる典型障害です。",
      ],
      referenceTable: {
        headers: ["比較項目", "Security Group (AWS等)", "Network ACL / Cisco ACL"],
        rows: [
          ["状態管理", "ステートフル（戻り通信を自動許可）", "ステートレス（行きと帰りを両方評価）"],
          ["ルール種別", "許可 (Allow) のみ記述可", "許可 (Permit) と拒否 (Deny) の両方"],
          ["評価方式", "全ルールを評価", "番号順に上から評価（暗黙のdenyあり）"],
          ["適用単位", "インスタンス (ENI) 単位", "サブネット / インターフェース単位"],
        ],
      },
      commandBlocks: [
        {
          title: "VPC ルートテーブル設計イメージ (JSON表現)",
          code: "{\n  \"PublicSubnetRouteTable\": [\n    { \"Destination\": \"10.20.0.0/16\", \"Target\": \"local\" },\n    { \"Destination\": \"0.0.0.0/0\",    \"Target\": \"igw-internet-gateway\" }\n  ],\n  \"PrivateSubnetRouteTable\": [\n    { \"Destination\": \"10.20.0.0/16\",  \"Target\": \"local\" },\n    { \"Destination\": \"192.168.0.0/16\", \"Target\": \"vgw-ipsec-vpn\" }\n  ]\n}",
          note: "クラウドでも内部のパケット転送は LPM (最長一致検索) に基づいて Target が選ばれます。",
        },
      ],
      pitfalls: [
        "Private サブネット内の DB へインターネットから直接つながないつもりが、誤って Public ルートテーブルを関連付けて公開してしまう設定ミス。",
      ],
    },
    quiz: [
      {
        id: "q-cloud-1",
        question: "オンプレミスの社内ネットワーク (192.168.0.0/16) とクラウド VPC を Site-to-Site IPsec VPN で相互接続する際、最も避けるべき設計ミスはどれですか？",
        choices: [
          "VPC 内に複数のサブネットを作ること",
          "オンプレミスとクラウド VPC で重複する IP CIDR を割り当てること",
          "Security Group で特定のポート番号だけ許可すること",
          "Private サブネットを別ルートテーブルに分けること",
        ],
        correctIndex: 1,
        explanation:
          "IP 範囲が重複すると双方のルータで宛先がローカルなのか VPN 先なのか曖昧になり、正常なルーティングができなくなります。",
      },
      {
        id: "q-cloud-2",
        question: "ステートフルな動作をする Security Group の特徴として正しいものはどれですか？",
        choices: [
          "インバウンドで許可したリクエストに対する戻りトラフィックは、アウトバウンドに明記しなくても自動許可される",
          "ルール番号の小さい順に評価し、最初に一致した時点で停止する",
          "特定の IP だけを明示的に Deny するルールが書ける",
          "サブネット単位にのみ適用できる",
        ],
        correctIndex: 0,
        explanation:
          "ステートフル検査では通信セッション状態を記憶するため、許可された入力の戻り応答は自動的に通過できます。",
      },
    ],
  },
  {
    id: "stage3/netops-automation",
    stage: "stage-3",
    slug: "netops-automation",
    title: "ネットワーク自動化・REST API・AI運用 (NetOps)",
    summary:
      "YAML/JSONによる構成管理、Ansible・RESTCONF、LLMを活用した次世代障害調査を展望します。",
    estimatedMinutes: 20,
    diagramVariant: "netops-automation",
    glossary: [
      {
        term: "NetOps / IaC",
        shortDef: "ネットワーク構成をコード (YAML/JSON等) で管理・自動展開する運用手法",
        detail:
          "手作業 CLI コピペによる設定ミス（ヒューマンエラー）をなくし、Git によるバージョン管理と冪等な自動適用を実現します。",
        layer: "NetOps",
      },
      {
        term: "RESTCONF / NETCONF",
        shortDef: "ネットワーク機器を API 経由で機械的に設定・取得するプロトコル",
        detail:
          "YANG データモデルに基づき、RESTCONF は HTTPS + JSON/XML で、NETCONF は SSH + XML で構造化データをやり取りします。",
        layer: "API",
      },
      {
        term: "冪等性 (Idempotency)",
        shortDef: "同じ自動実行を何度繰り返しても常に同じ正しい状態になる性質",
        detail:
          "Ansible 等の構成管理ツールで重視される特性で、既存設定との差分だけを安全に適用できます。",
        layer: "NetOps",
      },
    ],
    beginnerMode: {
      analogyTitle: "「1台ずつ手打ちする職人作業」から「設計図を全拠点へ自動配布する工場ライン (NetOps)」へ",
      analogyText:
        "ルータが100台ある環境で、1台ずつ手作業でコマンドを打てば必ずタイプミスや設定漏れ（今回の障害ラボのような事故）が起きます。現代の NetOps では設定を JSON や YAML の設計図として保存し、REST API や Ansible を使って全機器へ正確に自動反映し、障害時は AI/テレメトリで即時検知します。",
      keyPoints: [
        {
          title: "テキスト画面ではなく「JSON / YAML 構造化データ」で扱う",
          body: "人間向けの `show` 出力を無理やり文字列パースするのではなく、API で構造化された JSON として状態を取得すると自動化が安定します。",
        },
        {
          title: "ネットワークコアのイミュータブル設計との親和性",
          body: "本アプリのようにネットワーク状態が純粋な JSON として表現されていれば、変更前後の Diff 比較や自動検証テスト (CI) が容易になります。",
        },
        {
          title: "AI 運用でも「基礎プロトコルの理解」が武器になる",
          body: "AI にログ解析やコンフィグ生成を補助させる時代ほど、提示されたルートや ACL が本当に安全か見抜く人間のレビュー力が価値を持ちます。",
        },
      ],
      steps: [
        "機器のパラメータ（VLAN一覧・IP・静的ルート）を Git 管理下の YAML/JSON インベントリに定義します。",
        "変更時は Pull Request 上で自動テスト・Diff レビュー（単一障害点や暗黙のdeny漏れチェック）を通します。",
        "Ansible や RESTCONF API を通じて対象機器へ冪等にデプロイし、疎通テストを自動実行して完了を確認します。",
      ],
    },
    examMode: {
      examTips: [
        "CCNA 新範囲では REST API (GET/POST/PUT/PATCH/DELETE)、JSON 構造読解、Ansible/Puppet/Chef の比較（エージェントレス vs エージェント型）、コントローラベースネットワーキング (SDN) が問われます。",
      ],
      referenceTable: {
        headers: ["ツール / プロトコル", "方式・トランスポート", "データ形式", "特徴"],
        rows: [
          ["RESTCONF", "HTTPS (TCP 443)", "JSON / XML", "Web標準REST APIでCRUD操作"],
          ["NETCONF", "SSH (TCP 830)", "XML", "トランザクション・ロールバック対応"],
          ["Ansible", "Push型 / エージェントレス (SSH/API)", "YAML (Playbook)", "対象機器にエージェント不要で導入しやすい"],
          ["JSON", "テキスト形式データ交換", "{ \"key\": \"value\" }", "API連携・構成表現のデファクト標準"],
        ],
      },
      commandBlocks: [
        {
          title: "RESTCONF API によるインターフェース設定取得リクエスト例",
          code: "GET https://r1.internal/restconf/data/ietf-interfaces:interfaces/interface=Gig0%2F0\nAccept: application/yang-data+json\n\n{\n  \"ietf-interfaces:interface\": {\n    \"name\": \"Gig0/0\",\n    \"enabled\": true,\n    \"ietf-ip:ipv4\": {\n      \"address\": [{ \"ip\": \"192.168.10.1\", \"netmask\": \"255.255.255.0\" }]\n    }\n  }\n}",
          note: "CLIの人間向け出力と異なり、API応答はそのまま型チェックや自動検証に利用できます。",
        },
      ],
      pitfalls: [
        "「Ansible は管理対象ルータにエージェントソフトのインストールが必要」というひっかけに注意（Ansible はエージェントレスの Push 型です）。",
      ],
    },
    quiz: [
      {
        id: "q-netops-1",
        question: "Cisco IOS ルータ等の管理対象機器に専用エージェントをインストールせず、SSH や API 経由で YAML 定義を適用できる構成管理ツールはどれですか？",
        choices: ["Ansible", "Puppet (標準エージェント型)", "SNMP Trap", "TFTP"],
        correctIndex: 0,
        explanation:
          "Ansible はエージェントレス（Push型）で構成管理でき、ネットワーク機器の自動化で最も広く採用されています。",
      },
      {
        id: "q-netops-2",
        question: "RESTCONF プロトコルが標準でやり取りするデータフォーマットとトランスポートプロトコルの組み合わせはどれですか？",
        choices: [
          "SNMP / UDP 161",
          "JSON または XML / HTTPS",
          "YAML / TFTP",
          "バイナリ / ICMP",
        ],
        correctIndex: 1,
        explanation:
          "RESTCONF は HTTPS 上で JSON または XML 形式の構造化データ（YANGモデル）を操作します。",
      },
    ],
  },
  {
    id: "stage3/web-modern-network",
    stage: "stage-3",
    slug: "web-modern-network",
    title: "Webインフラとモダンネットワーク（TLS 1.3・LB・BGP・コンテナ網）",
    summary: "実務のWebサービスを支えるTLS 1.3ハンドシェイク、L4/L7ロードバランサ(XFFヘッダ・SSL終端)、インターネットBGP基礎、Dockerブリッジネットワークを学びます。",
    estimatedMinutes: 25,
    diagramVariant: "web-modern-network",
    relatedHref: {
      href: "/labs/cloud?scenario=cloud-igw-sg-https",
      label: "クラウドVPCラボで体験",
    },
    glossary: [
      {
        term: "TLS 1.3 (1-RTT)",
        shortDef: "TLS 1.2 の半分の往復回数 (1-RTT) で安全な暗号通信を確立する最新仕様。",
        detail: "ClientHello に鍵共有パラメータ (ECDHE) を同梱するため 1往復で暗号確立が完了し、脆弱な RSA 鍵交換や CBC 暗号は廃止され Forward Secrecy (PFS) が必須化されています。",
        layer: "L5 / L6 (TLS)",
      },
      {
        term: "L7 ロードバランサ & XFF",
        shortDef: "HTTP パス・Host ヘッダを見て振分や TLS 終端を行い、元IPを `X-Forwarded-For` で伝達する装置。",
        detail: "リバースプロキシ型 LB はバックエンドへの代理接続を行うため、Web サーバログ上の送信元IPが LB 自身に見えます。元クライアントIP知るために XFF ヘッダを参照します。",
        layer: "L7 (HTTP)",
      },
      {
        term: "BGP (eBGP / AS Path)",
        shortDef: "インターネット全体の AS（自律システム）間で経路を交換する唯一の Path Vector プロトコル。",
        detail: "OSPF が社内の最短コストを選ぶのに対し、BGP (TCP 179) はポリシー（AS_PATH長・Local Preference 等）ベースで経路制御を行います。",
        layer: "L3 (Inter-Domain)",
      },
      {
        term: "Container Network (veth / NAT)",
        shortDef: "Docker 等がホストOS内部に仮想ブリッジ (`docker0`) と veth ペアを作ってコンテナ間を接続する機構。",
        detail: "コンテナは独自の Network Namespace を持ち、iptables NAT による `-p 8080:80` ポートフォワードで外部へ公開されます。",
        layer: "Virtual L2/L3",
      },
    ],
    beginnerMode: {
      analogyTitle: "「暗号化・交通整理・巨大道路網・社内シェアハウス」を一つの地図に",
      analogyText:
        "モダンな Web サービスでは、ブラウザの暗号通信 (TLS 1.3) を玄関の L7 ロードバランサで受け止め、裏側の Docker コンテナ群へ振り分け、さらに外側では BGP が世界中の ISP を結んでいます。従来の CCNA 知識（L2/L3/NAT/TCP）がそのままアプリ基盤に応用されています。",
      keyPoints: [
        {
          title: "なぜ L7 ロードバランサで SSL/TLS 終端するのか",
          body: "証明書管理や復号のCPU負荷を LB（ALB や Nginx）へ集約でき、裏側のアプリサーバは平文 HTTP や内向き認証に専念でき、URL パス (`/api`, `/images`) ごとのルーティングも可能になるためです。",
        },
        {
          title: "コンテナも実体は Linux Network Namespace + veth + Bridge",
          body: "ブラックボックスに見えがちなコンテナ通信も、`veth` 仮想LANケーブルでホスト内の仮想L2スイッチ (`docker0` ブリッジ) に接続され、ホスト外へ出る際は NAPT (iptables MASQUERADE) されているだけです。",
        },
      ],
      steps: [
        "クライアントが DNS で名前解決し、LB と TCP 3ウェイ → TLS 1.3 ハンドシェイクを1往復で完了する",
        "LB が HTTP リクエストを受け取り、`X-Forwarded-For` ヘッダを付与して健全なヘルスチェック通過中のコンテナへ転送する",
        "クラウドやデータセンタ境界のインターネット通信は eBGP により冗長化されたマルチホーム ISP 経由で運ばれる",
      ],
    },
    examMode: {
      examTips: [
        "TLS 1.2 (2-RTT) と TLS 1.3 (1-RTT, 前方秘匿性必須) のハンドシェイク差、および eBGP (AD 20) vs iBGP (AD 200) は実務面接と資格双方の頻出項目です。",
        "リバースプロキシ・LB 構成における「バックエンドアプリでアクセス元IPがLBのプライベートIPになってしまう現象」→ `X-Forwarded-For` の仕組みは即答できるよう整理しましょう。",
      ],
      referenceTable: {
        headers: ["技術", "レイヤ / プロトコル", "代表的なチェックポイント"],
        rows: [
          ["TLS 1.3", "TCP 上 (443等)", "1-RTT 鍵交換 (ECDHE 必須)・0-RTT 再開・安全でない旧暗号廃止"],
          ["L4 LB vs L7 LB", "L4 TCP/UDP vs L7 HTTP", "L4: 高速パススルー / L7: TLS終端・URL振分・X-Forwarded-For付与"],
          ["BGP (eBGP / iBGP)", "TCP 179", "AS間制御、eBGP AD=20、AS_PATH でループ防止・最短AS選択"],
          ["Docker Bridge網", "Linux Namespace + NAT", "`docker0` ブリッジ + `veth` ペア、`-p ホスト:コンテナ` でNAPT公開"],
        ],
      },
      commandBlocks: [
        {
          title: "Nginx リバースプロキシ / TLS 1.3 / X-Forwarded-For 例",
          code: `server {
    listen 443 ssl;
    ssl_protocols TLSv1.3 TLSv1.2;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}`,
          note: "`curl -v https://...` を実行すると ALPN・TLSv1.3 ハンドシェイクとサーバ証明書検証の流れを直接観察できます。",
        },
      ],
      pitfalls: [
        "LB 配下でクライアントIP制限（ACL/WAF）を行いたい場合、直前の `remote_addr` ではなく LB が付与する信頼済み `X-Forwarded-For`（または AWS Proxy Protocol）を参照しないと全アクセスが LB の IP に見えてしまいます。",
      ],
    },
    quiz: [
      {
        id: "q-webmod-1",
        question: "TLS 1.3 が TLS 1.2 に比べて初期ハンドシェイクの往復回数 (RTT) を 2-RTT から 1-RTT へ半減できた最大の理由はどれですか？",
        choices: [
          "TCP 3ウェイハンドシェイクを完全に省略しているため",
          "最初の ClientHello に鍵共有パラメータ (Key Share / ECDHE) を同梱して送るため",
          "暗号化処理をすべてクライアント側のみに任せるため",
          "証明書検証を行わないため",
        ],
        correctIndex: 1,
        explanation:
          "TLS 1.3 では安全な鍵交換方式 (ECDHE) に絞り、クライアントが最初から予測した鍵共有パラメータを ClientHello に載せることで 1-RTT 接続を実現しました。",
      },
      {
        id: "q-webmod-2",
        question: "L7 リバースプロキシ / ALB の背後にあるアプリケーションサーバ側で、ロードバランサのIPではなく「元のクライアントIPアドレス」を取得したいときに参照する代表的な HTTP ヘッダはどれですか？",
        choices: [
          "Content-Type",
          "X-Forwarded-For",
          "Cache-Control",
          "WWW-Authenticate",
        ],
        correctIndex: 1,
        explanation:
          "L7 LB は一度コネクションを終端してバックエンドへ新規接続するため、元の送信元IPを `X-Forwarded-For` ヘッダに追記して引き継ぎます。",
      },
      {
        id: "q-webmod-3",
        question: "BGP ピア確立のためにルータ間（TCP 上）で使用されるポート番号と、異なる AS 間で動作する際のデフォルト AD 値 (Cisco IOS) の組み合わせはどれですか？",
        choices: [
          "UDP 520 / AD 120",
          "TCP 179 / AD 20 (eBGP)",
          "IP Protocol 89 / AD 110",
          "TCP 443 / AD 1",
        ],
        correctIndex: 1,
        explanation:
          "BGP は信頼性確保のため TCP ポート 179 を使用してネイバーを張り、別AS間の eBGP の AD 値は 20（同一AS内の iBGP は 200）です。",
      },
    ],
  },
  {
    id: "stage3/firewall-vpn-aaa",
    stage: "stage-3",
    slug: "firewall-vpn-aaa",
    title: "境界セキュリティ設計（FW / DMZ / IPS / AAA・TACACS+・RADIUS / IPsec VPN）",
    summary:
      "ステートフルFWとDMZ 3ゾーン設計、機器管理のAAA (TACACS+ vs RADIUS)、拠点間IPsec VPN (IKEv2/ESP) を体系的に学びます。",
    estimatedMinutes: 25,
    diagramVariant: "firewall-dmz-vpn",
    relatedHref: {
      href: "/labs/cloud?scenario=cloud-igw-sg-https",
      label: "クラウドVPCラボでステートフルFWを体験する",
    },
    glossary: [
      {
        term: "ステートフルFW",
        shortDef: "通信のセッション状態（行きと帰り）を記憶して戻り通信を自動許可する FW",
        detail:
          "単なる ACL（ステートレス）と違い、社内→外部の許可通信に対する戻りパケットを自動許可し、不正なセッション外通信を遮断します。",
        layer: "L3–L7",
      },
      {
        term: "DMZ",
        shortDef: "外部公開サーバを社内LAN (Trust) から隔離して置く緩衝地帯 (非武装地帯)",
        detail:
          "万一外部公開 Web サーバが乗っ取られても、DMZ から社内 DB への横展開 (Lateral Movement) を FW ポリシーで食い止めます。",
        layer: "設計",
      },
      {
        term: "AAA",
        shortDef: "認証 (Authentication)・認可 (Authorization)・記録 (Accounting) の 3 要素",
        detail:
          "ネットワーク機器への管理者ログインを中央サーバ (TACACS+ / RADIUS) で統制し、「誰が・いつ・何のコマンドを打ったか」を監査可能にします。",
        layer: "L7",
      },
      {
        term: "IPsec VPN",
        shortDef: "インターネット上に暗号化された仮想専用トンネルを張る技術 (IKEv2 / ESP)",
        detail:
          "拠点間接続 (Site-to-Site) に広く使われ、ESP プロトコル (IP番号 50) でデータの暗号化・完全性・認証を保護します。",
        layer: "L3",
      },
    ],
    beginnerMode: {
      analogyTitle: "「受付ロビー (DMZ)」で来客を止め、「役員室 (社内LAN)」へ絶対に入れない設計",
      analogyText:
        "外部から誰でもアクセスする Web サーバを、社内人事データのある LAN と同じ部屋に置くのは危険すぎます。そこで ファイアウォール を真ん中に立て、外部 (Untrust)・公開サーバ置き場 (DMZ)・社内LAN (Trust) の 3 つに部屋を分けます。また、ルータの設定変更をする作業者も AAA サーバで名簿チェックと操作ログ記録を行います。",
      keyPoints: [
        {
          title: "DMZ から社内 LAN への直接通信は原則禁止",
          body: "必要な API や DB 接続のみ、送信元・宛先・ポートを最小権限でピンポイント許可します。",
        },
        {
          title: "TACACS+ (機器管理向け) vs RADIUS (ネットワーク認証向け)",
          body: "TACACS+ は TCP 49 を使いパケット全体を暗号化し、コマンド単位の認可が得意です。RADIUS は UDP 1812/1813 で無線 802.1X 認証に定番です。",
        },
        {
          title: "IPsec VPN は IKE (鍵交換) + ESP (暗号データ転送) の 2 段階",
          body: "まず IKE (UDP 500/4500) で安全な鍵交換チャンネルを作り、次に ESP で実データを暗号化して拠点間を結びます。",
        },
      ],
      steps: [
        "ファイアウォールで Untrust / DMZ / Trust のセキュリティゾーンを定義し、デフォルト拒否ポリシーを設定します。",
        "管理者アクセス用に AAA (TACACS+) を構成し、サーバ障害時用のローカルフォールバックアカウントも残します。",
        "拠点間 VPN では IKEv2 パラメータと暗号化対象トラフィックを両拠点で完全一致させ、トンネルを確立します。",
      ],
    },
    examMode: {
      examTips: [
        "TACACS+ (TCP 49 / パケット全体暗号化 / 認証・認可を分離) と RADIUS (UDP 1812, 1813 / パスワード部のみ暗号化 / 認証と認可を一体化) の違いは超頻出です。",
        "IPS (自動遮断するインライン型) と IDS (検知・通知のみの監視型) の違いも押さえましょう。",
      ],
      referenceTable: {
        headers: ["項目", "TACACS+", "RADIUS"],
        rows: [
          ["トランスポート", "TCP 49", "UDP 1812 (認証) / 1813 (アカウンティング)"],
          ["暗号化範囲", "パケットボディ全体", "パスワード部分のみ"],
          ["コマンド単位認可", "対応（IOS機器管理に最適）", "非対応/限定的（802.1X・VPN認証に最適）"],
        ],
      },
      commandBlocks: [
        {
          title: "AAA (TACACS+) 認証設定の基本構造",
          code: "R1(config)# aaa new-model\nR1(config)# tacacs server TAC_MAIN\nR1(config-server-tacacs)# address ipv4 10.10.10.50\nR1(config-server-tacacs)# key StrongSecretKey\nR1(config)# aaa authentication login default group tacacs+ local",
          note: "最後に `local` を入れておくと、TACACS+ サーバが落ちた緊急時でもローカル認証でログインできロックアウトを防げます。",
        },
      ],
      pitfalls: [
        "`aaa authentication login` で `local` フォールバックを書き忘れると、管理サーバとの通信が切れた瞬間に全管理者が機器へ入れなくなります。",
      ],
    },
    quiz: [
      {
        id: "q-fw-1",
        question: "ネットワーク機器管理の AAA プロトコルとして、TCP ポート 49 を使用し、パケット全体を暗号化してコマンド単位の細かい認可制御が可能なものはどれですか？",
        choices: ["RADIUS", "TACACS+", "SNMPv2c", "TFTP"],
        correctIndex: 1,
        explanation:
          "TACACS+ は TCP 49・全体暗号化・AAA の 3 機能分離を特徴とし、ルータ/スイッチの CLI 運用統制に広く使われます。",
      },
      {
        id: "q-fw-2",
        question: "外部公開用の Web サーバを社内基幹 LAN から分離配置するネットワーク領域（ゾーン）の名称はどれですか？",
        choices: ["Loopback", "DMZ (非武装地帯)", "APIPA", "Native VLAN"],
        correctIndex: 1,
        explanation:
          "DMZ に公開サーバを分離することで、万一侵入されても社内 LAN への被害拡大をファイアウォールで阻止できます。",
      },
      {
        id: "q-fw-3",
        question: "ステートレスな標準/拡張 ACL と比較した、ステートフルファイアウォール最大の特徴はどれですか？",
        choices: [
          "通信セッションの状態を追跡し、許可された往路通信に対する戻りパケットを動的に許可する",
          "IP アドレスを見ずに MAC アドレスだけで転送する",
          "すべての通信を暗号化してから送信する",
          "L1 のケーブル断線を自動修復する",
        ],
        correctIndex: 0,
        explanation:
          "ステートフル FW はコネクションテーブルを保持するため、戻り通信用に広範なインバウンド穴開けを書く必要がありません。",
      },
      {
        id: "q-fw-4",
        question: "IPsec VPN でデータ本体の暗号化と改ざん検知（認証）を担う主要プロトコルはどれですか？",
        choices: ["ESP (Encapsulating Security Payload)", "ARP", "CDP", "SMTP"],
        correctIndex: 0,
        explanation:
          "IPsec では ESP (IP プロトコル番号 50) がペイロード暗号化と完全性保護を担当します（AH は暗号化なし）。",
      },
    ],
  },
  {
    id: "stage3/linux-network-ops",
    stage: "stage-3",
    slug: "linux-network-ops",
    title: "Linux ネットワーク実務調査（ip / ss / dig / curl / tcpdump / nftables）",
    summary:
      "本番サーバ障害時に欠かせない iproute2・ソケット待ち受け確認・DNS/TLS診断・パケット採取・Linux FW調査を網羅します。",
    estimatedMinutes: 20,
    diagramVariant: "linux-net-stack",
    relatedHref: {
      href: "/labs/troubleshoot?scenario=ts-linux-nginx-down",
      label: "Linux障害シミュレータでWeb停止を調査・復旧する",
    },
    glossary: [
      {
        term: "iproute2",
        shortDef: "現代の Linux でネットワーク設定・確認を行う標準コマンド群 (`ip a`, `ip r`)",
        detail:
          "古い `ifconfig` / `netstat` / `route` に代わる標準ツール群で、`ip addr` / `ip route` / `ip neigh` 等を使用します。",
        layer: "L2/L3",
      },
      {
        term: "ss -tulpn",
        shortDef: "Linux 上で待ち受け (LISTEN) 中の TCP/UDP ポートとプロセス名を表示するコマンド",
        detail:
          "`t`=TCP, `u`=UDP, `l`=LISTEN, `p`=プロセス, `n`=数字ポート。`127.0.0.1:80` で待機していないか（外部から繋がらない原因）も一目で分かります。",
        layer: "L4",
      },
      {
        term: "tcpdump",
        shortDef: "Linux CLI 上でリアルタイムにパケットをキャプチャ・保存する標準ツール",
        detail:
          "`tcpdump -ni eth0 port 443 -w cap.pcap` で採取し、Wireshark で開いて詳細調査する流れが実務の定番です。",
        layer: "L2–L7",
      },
    ],
    beginnerMode: {
      analogyTitle: "サーバという名の「お店」を上から下まで点検する 5 つの道具",
      analogyText:
        "Ping は通るのに Web サイトが表示されないとき、ネットワーク機器だけでなく『受け手側の Linux サーバ』の調査が必要です。お店の営業状態 (`systemctl`)、窓口が開いているか (`ss -tulpn`)、看板の住所案内 (`dig`)、来客時の受け答え (`curl -v`)、防犯カメラ (`tcpdump`) の順に確認すれば原因は必ず見つかります。",
      keyPoints: [
        {
          title: "`127.0.0.1:8080` の LISTEN は外部から繋がらない定番トラップ",
          body: "`ss -tulpn` の Local Address が `0.0.0.0:8080` ではなく `127.0.0.1:8080` の場合、同じサーバ内からしか接続できません。",
        },
        {
          title: "`curl -v` で DNS → TCP → TLS → HTTP を一気通貫チェック",
          body: "名前解決に失敗したのか、TCP で拒否されたのか、TLS 証明書で落ちたのか、HTTP 502 なのかが 1 コマンドで分かります。",
        },
        {
          title: "OS ファイアウォール (`nftables` / `ufw` / `firewalld`) も忘れず確認",
          body: "クラウド SG を開けても、OS 内部のファイアウォールで 443 番が閉じているケースは実務で非常に多いです。",
        },
      ],
      steps: [
        "`ip a` と `ip r` でサーバ自身の IP・NIC 状態・デフォルトルートが正しいか確認します。",
        "`ss -tulpn` と `systemctl status nginx` でアプリが対象ポートを LISTEN しているか確認します。",
        "`dig` / `curl -v` で外向き・自己通信を試し、必要なら `tcpdump` と `nft list ruleset` でパケットと OS FW を確認します。",
      ],
    },
    examMode: {
      examTips: [
        "`ss -tulpn` 各オプションの意味と、`tcpdump -ni <if> host <ip> and port <port>` の構文は実務・技術面接でも頻出です。",
        "`ip neigh` は Linux 上の ARP / NDP キャッシュ確認コマンドです。",
      ],
      referenceTable: {
        headers: ["コマンド", "確認対象", "実務での注目ポイント"],
        rows: [
          ["ip a / ip r / ip neigh", "IP / ルート / ARPテーブル", "NICが UP か、default via が正しいか"],
          ["ss -tulpn", "LISTEN ポートとプロセス", "0.0.0.0 か 127.0.0.1 か、PID 起動有無"],
          ["systemctl status <svc>", "systemd サービス稼働状態", "active (running) か inactive/failed か"],
          ["dig @<dns> <host>", "DNS 応答の詳細", "status: NOERROR / NXDOMAIN / timed out"],
          ["curl -v <url>", "TCP / TLS / HTTP 応答", "接続先IP・TLSハンドシェイク・Status Code"],
          ["tcpdump -ni eth0", "実際の送受信パケット", "SYNが着ているか、RSTを返していないか"],
        ],
      },
      commandBlocks: [
        {
          title: "Web 障害時の Linux 調査ゴールデンコマンド集",
          code: "srv$ ip -br a\nsrv$ ip r\nsrv$ ss -tulpn | grep -E '80|443'\nsrv$ sudo systemctl status nginx\nsrv$ curl -svI https://api.internal.local\nsrv$ sudo tcpdump -ni eth0 tcp port 443 -c 20",
          note: "`-n` (名前解決しない) と `-i` (IF指定) を付けた `tcpdump` は本番負荷を抑えつつ素早く確認する鉄則です。",
        },
      ],
      pitfalls: [
        "DNS 不通時に `tcpdump` で `-n` を付け忘れると、パケット1行ごとに逆引き DNS タイムアウトが発生して出力が極端に遅くなります。",
      ],
    },
    quiz: [
      {
        id: "q-lin-1",
        question: "Linux サーバ上で「現在 LISTEN している TCP/UDP ポートと、それを開いているプロセス名」を名前解決なしの高速表示で確認するコマンドはどれですか？",
        choices: ["ip route", "ss -tulpn", "dig -x", "systemctl enable"],
        correctIndex: 1,
        explanation:
          "`ss -tulpn` は TCP/UDP の待ち受けソケットをポート番号とプロセス情報付きで一覧表示します。",
      },
      {
        id: "q-lin-2",
        question: "`ss -tulpn` の出力で Web アプリが `127.0.0.1:8080` で LISTEN していました。他の PC からこのポートへ接続できない理由はどれですか？",
        choices: [
          "ループバックアドレスにのみバインドされており、外部 NIC からの接続を受け付けていないため",
          "8080 番ポートは UDP 専用であるため",
          "Linux カーネルが IPv4 を無効化しているため",
          "DNS Aレコードが必須であるため",
        ],
        correctIndex: 0,
        explanation:
          "外部からのアクセスを受けるには `0.0.0.0:8080`（または外部側 NIC の IP）で LISTEN させる必要があります。",
      },
      {
        id: "q-lin-3",
        question: "Linux で `tcpdump` を実行する際、DNS 逆引きによる表示遅延を防ぎつつ特定ポートだけを採取したいときに付けるべき定番オプションはどれですか？",
        choices: ["-n (数値表示)", "-r (ファイル読込)", "-k (Keepalive)", "-z (圧縮)"],
        correctIndex: 0,
        explanation:
          "`-n` を指定することで IP やポート番号を名前解決せずにそのまま数字で高速出力できます。",
      },
      {
        id: "q-lin-4",
        question: "従来の `arp -a` に代わり、現在の Linux `iproute2` で ARP / NDP キャッシュを確認するコマンドはどれですか？",
        choices: ["ip link", "ip neigh", "ip rule", "systemctl list-units"],
        correctIndex: 1,
        explanation:
          "`ip neigh` (ip neighbor) で同一リンク上の解決済み MAC アドレスキャッシュと状態 (REACHABLE / STALE / FAILED) を確認できます。",
      },
    ],
  },
  {
    id: "stage3/internet-bgp-dns-cdn",
    stage: "stage-3",
    slug: "internet-bgp-dns-cdn",
    title: "インターネット基盤の仕組み（BGP / AS・権威DNS・リバースプロキシ・CDN）",
    summary:
      "AS間ルーティング(eBGP/iBGP・AS_PATH)、Root〜権威DNSの反復問い合わせ、Anycast CDNとリバースプロキシの動作を理解します。",
    estimatedMinutes: 25,
    diagramVariant: "internet-bgp-cdn",
    relatedHref: {
      href: "/tools?tab=wireshark",
      label: "Wireshark風ドリルで実通信パケットを解析する",
    },
    glossary: [
      {
        term: "AS (自律システム)",
        shortDef: "ISPやクラウド事業者が運用する統一ポリシー下の巨大ネットワーク単位 (AS番号)",
        detail:
          "Autonomous System。それぞれの AS が固有の AS 番号 (ASN) を持ち、AS 同士を BGP で接続してインターネットが成り立っています。",
        layer: "L3",
      },
      {
        term: "eBGP / iBGP",
        shortDef: "異なる AS 間で経路交換するのが eBGP、同一 AS 内での経路共有が iBGP",
        detail:
          "パスベクタ型ルーティングプロトコルであり、経由した AS 番号のリスト (`AS_PATH`) を見てループを防ぎ、最適経路を選びます。",
        layer: "L3",
      },
      {
        term: "権威 DNS サーバ",
        shortDef: "特定ドメインの公式な DNS レコード（正解データ）を保持・応答するサーバ",
        detail:
          "PC が最初に聞く『再帰 DNS リゾルバ (8.8.8.8 等)』は、Root DNS → TLD DNS (.com等) → 権威 DNS へ順に問い合わせて答えを持ち帰ります。",
        layer: "L7",
      },
      {
        term: "Anycast CDN",
        shortDef: "世界中のエッジ拠点が同じ IP を BGP 広告し、ユーザーに最寄りの拠点で応答する仕組み",
        detail:
          "キャッシュ配信や DDoS 緩和、TLS 終端をユーザーに近いエッジで行うことで、表示速度向上とオリジンサーバ保護を両立します。",
        layer: "L3/L7",
      },
    ],
    beginnerMode: {
      analogyTitle: "「世界中の郵便局をつなぐ国際ルール (BGP)」と「最寄りのコンビニ受取 (CDN)」",
      analogyText:
        "社内ネットワークでは OSPF を使いますが、世界中のプロバイダやクラウド (AS) がつながるインターネット全体では、より大規模で政治的・契約的ルールも扱える BGP が使われます。また、海外の本社サーバまで毎回取りに行くと遅いため、世界各地のコンビニ (CDN エッジ) にコピーを置いて一番近い店舗へ案内するのが Anycast CDN です。",
      keyPoints: [
        {
          title: "OSPF は社内 (IGP)、BGP はインターネット・クラウド接続 (EGP)",
          body: "AWS Direct Connect や複数 ISP マルチホーミング構成では、企業側ルータでも BGP を設定します。",
        },
        {
          title: "DNS は「再帰問い合わせ」と「反復問い合わせ」の 2 段構え",
          body: "PC → リゾルバは再帰（答えをもらうまで待つ）、リゾルバ → Root/TLD/権威 は反復（次の案内先をたらい回しで辿る）で解決されます。",
        },
        {
          title: "リバースプロキシ / CDN はオリジンを守る盾にもなる",
          body: "静的コンテンツのキャッシュ、WAF による攻撃遮断、TLS 終端を前段で引き受けることでバックエンド負荷を大幅に下げます。",
        },
      ],
      steps: [
        "クライアントは再帰 DNS リゾルバへ問い合わせ、リゾルバは Root → TLD → 権威 DNS を辿って CDN エッジ IP を取得します。",
        "BGP の Anycast 経路制御により、クライアントのパケットは最も近い BGP 経路上の CDN エッジへ届きます。",
        "キャッシュヒットすればエッジから即応答し、動的 API リクエストのみリバースプロキシ経由でバックエンド (オリジン) へ転送します。",
      ],
    },
    examMode: {
      examTips: [
        "BGP のポート (TCP 179)、パス属性 (`AS_PATH`, `Local Preference`, `MED`)、eBGP (AD=20) vs iBGP (AD=200) は重要ポイントです。",
        "DNS のキャッシュ TTL 設計（レコード切り替え前に TTL を短くしておく実務定石）もよく問われます。",
      ],
      referenceTable: {
        headers: ["構成要素", "主なプロトコル/仕組み", "役割"],
        rows: [
          ["BGP (EGP)", "TCP 179 / AS_PATH", "AS間の大規模経路制御・クラウド専用線接続"],
          ["再帰リゾルバ", "UDP/TCP 53 (キャッシュ有)", "クライアントの代わりに Root〜権威DNS を巡回"],
          ["CDN / WAF", "Anycast BGP + HTTPS", "最寄り拠点からの高速配信・L7攻撃防御"],
          ["Reverse Proxy", "Nginx / Envoy / ALB", "SSL終端・負荷分散・X-Forwarded-For 付与"],
        ],
      },
      commandBlocks: [
        {
          title: "Cisco IOS eBGP ネイバー基本構成 & 権威DNSトレース",
          code: "R1(config)# router bgp 65001\nR1(config-router)# neighbor 203.0.113.2 remote-as 65002\nR1(config-router)# network 198.51.100.0 mask 255.255.255.0\nR1# show ip bgp summary\n!\n$ dig +trace example.com",
          note: "`dig +trace` を実行すると、Root (.) → TLD (.com) → 権威 DNS サーバへ辿る実際の反復問い合わせの流れを観察できます。",
        },
      ],
      pitfalls: [
        "DNS レコード変更前に TTL (例: 86400秒) を下げ忘れて切り替えると、旧 IP のキャッシュが世界中のリゾルバに最大 24 時間残り切り替わりません。",
      ],
    },
    quiz: [
      {
        id: "q-bgp-1",
        question: "BGP がルーティングループを検出し、またデフォルトで経路の近さを比較する際に参照する「経由した AS 番号の並び」を表す属性はどれですか？",
        choices: ["Cost", "AS_PATH", "Hop Count", "VLAN ID"],
        correctIndex: 1,
        explanation:
          "BGP はパスベクタ型であり、自分の AS 番号が `AS_PATH` に含まれている経路を受け取るとループ防止のため破棄します。",
      },
      {
        id: "q-bgp-2",
        question: "クライアント PC が 8.8.8.8 などの再帰 DNS リゾルバへ名前解決を依頼したとき、リゾルバがキャッシュを持っていない場合に最初に問い合わせに行く先はどこですか？",
        choices: ["クライアントのローカル hosts", "ルート DNS サーバ (.)", "CDN オリジンサーバ", "デフォルトゲートウェイの MAC"],
        correctIndex: 1,
        explanation:
          "キャッシュミス時はルート DNS (.) → トップレベルドメイン (.com 等) → 権威 DNS サーバの順に反復問い合わせを行います。",
      },
      {
        id: "q-bgp-3",
        question: "世界中の複数の CDN エッジ拠点に対して同一の IP アドレスを BGP 広告させ、ユーザーをネットワーク的に最も近い拠点へ自動誘導する技術はどれですか？",
        choices: ["Anycast", "Broadcast", "Token Ring", "DHCP Snooping"],
        correctIndex: 0,
        explanation:
          "Anycast は複数拠点から同じプレフィックスを広告し、BGP の経路選択によって最寄りのノードへトラフィックを届ける仕組みです。",
      },
      {
        id: "q-bgp-4",
        question: "Web サービスのサーバ移行などで DNS の A レコード IP を切り替える際、切り替えダウンタイムや旧サーバへの残留アクセスを減らすための実務定石はどれですか？",
        choices: [
          "切り替え作業の数日前〜前日までに、あらかじめ対象レコードの TTL 値を短く（例: 60〜300秒）変更しておく",
          "切り替え当日にルート DNS サーバを再起動する",
          "サブネットマスクを /8 に広げる",
          "DNS ではなく ARP キャッシュを書き換える",
        ],
        correctIndex: 0,
        explanation:
          "事前に TTL を短くして古いキャッシュを期限切れさせておくことで、本番切り替え後の新 IP 反映が速やかに行われます。",
      },
    ],
  },
];
