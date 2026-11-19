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
      href: "/tools",
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
];
