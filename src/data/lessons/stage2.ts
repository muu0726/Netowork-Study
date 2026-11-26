import type { LessonArticle } from "./types";

export const STAGE2_LESSONS: LessonArticle[] = [
  {
    id: "stage2/vlan-trunk",
    stage: "stage-2",
    slug: "vlan-trunk",
    title: "VLAN・802.1Qトランク & Router-on-a-Stick",
    summary:
      "ブロードキャストドメイン分割とタグ付きトランク、サブインターフェース構成を学びます。",
    estimatedMinutes: 20,
    diagramVariant: "vlan-trunk",
    relatedHref: {
      href: "/labs/cli?scenario=cli-vlan-roas",
      label: "Router-on-a-Stick 構築ラボへ進む",
    },
    glossary: [
      {
        term: "VLAN",
        shortDef: "1台のスイッチ内で仮想的にネットワークを分割する技術",
        detail:
          "Virtual LAN。物理配線を変えずにポートごとにブロードキャストドメイン（部署単位など）を分離できます。",
        layer: "L2",
      },
      {
        term: "802.1Q",
        shortDef: "Ethernetフレームに4バイトのVLANタグを埋め込むIEEE標準",
        detail:
          "IEEE 802.1Q。トランクポートを通過するフレームに VLAN ID タグを付与し、1本のケーブルで複数VLANを運べます。",
        layer: "L2",
      },
      {
        term: "Router-on-a-Stick",
        shortDef: "1本の物理トランク回線とサブIFでVLAN間ルーティングを行う構成",
        detail:
          "ルータの物理IF (Gig0/0) 配下に Gig0/0.10 や Gig0/0.20 のようなサブインターフェースを作り、encapsulation dot1Q でタグを識別します。",
        layer: "L2/L3",
      },
    ],
    beginnerMode: {
      analogyTitle: "1つのオフィスフロアを「透明な仕切り (VLAN)」と「名札付きエレベータ (802.1Q)」で分ける",
      analogyText:
        "同じ L2スイッチ につないだPC同士は通常すべて同じ部屋にいますが、営業部と開発部を分けたいときに使う仮想の壁が VLAN です。別々の部屋の通信を1本のケーブルでルータまで運ぶときは、荷物に『10号室用』『20号室用』という名札（802.1Q タグ）を貼るトランクポートを使います。",
      keyPoints: [
        {
          title: "アクセスポート（端末側）とトランクポート（スイッチ間/ルータ側）",
          body: "PC 側はタグ無しの1つの VLAN 専用（access）、スイッチ同士やルータとはタグ付きで複数 VLAN を運ぶ（trunk）設定にします。",
        },
        {
          title: "VLAN が異なると L2 では通信できない",
          body: "同じIPサブネットを設定しても、スイッチのポートの VLAN が不一致ならフレームが遮断されます（VLAN Mismatch）。",
        },
        {
          title: "VLAN 間をつなぐのが Router-on-a-Stick",
          body: "異なる VLAN は異なるサブネットに対応させるため、L3 のルータ（サブインターフェース）が橋渡し役を担います。",
        },
      ],
      steps: [
        "スイッチに `vlan 10` / `vlan 20` を作成し、端末接続ポートを `switchport mode access` + `switchport access vlan <id>` で割り当てます。",
        "ルータ接続ポートを `switchport mode trunk` にし、`switchport trunk allowed vlan 10,20` で通過を許可します。",
        "ルータ側で親IFを `no shutdown` し、`interface Gig0/0.10` 等に `encapsulation dot1Q 10` とゲートウェイIPを設定します。",
      ],
    },
    examMode: {
      examTips: [
        "Native VLAN（デフォルト VLAN 1）のフレームはトランク上でもタグ無しで送られるため、対向機器と Native VLAN が不一致だと通信障害やセキュリティリスクになります。",
        "`switchport trunk allowed vlan 30` と打つと既存リストが上書きされます。追加時は必ず `add 30` を使いましょう。",
      ],
      referenceTable: {
        headers: ["ポート種別", "タグ有無", "用途", "主要IOSコマンド"],
        rows: [
          ["Access", "タグ無し (Untagged)", "PC / サーバ接続", "switchport mode access / access vlan 10"],
          ["Trunk", "802.1Qタグ付き (Native除く)", "SW間 / Router-on-a-Stick", "switchport mode trunk / trunk allowed vlan"],
          ["Subinterface", "802.1Qタグ識別", "ルータ側のVLANゲートウェイ", "interface Gig0/0.10 / encapsulation dot1Q 10"],
        ],
      },
      commandBlocks: [
        {
          title: "スイッチ & ルータの Router-on-a-Stick 基本設定",
          code: "SW1(config)# interface Fa0/24\nSW1(config-if)# switchport mode trunk\nSW1(config-if)# switchport trunk allowed vlan 10,20\n\nR1(config)# interface Gig0/0\nR1(config-if)# no shutdown\nR1(config-if)# interface Gig0/0.10\nR1(config-subif)# encapsulation dot1Q 10\nR1(config-subif)# ip address 192.168.10.1 255.255.255.0",
          note: "親IF (Gig0/0) が shutdown だとサブインターフェース (.10/.20) も全て down になる点に注意。",
        },
      ],
      pitfalls: [
        "サブインターフェースで `encapsulation dot1Q` を設定せずに `ip address` を設定すると L2/L3 転送が成立しません。",
        "VLAN 自体を作成・active にしていないとポートに割り当てても転送できません。",
      ],
    },
    quiz: [
      {
        id: "q-vlan-1",
        question: "トランクポート上で既存の許可 VLAN (10, 20) を残したまま VLAN 30 を追加したい場合、正しいコマンドはどれですか？",
        choices: [
          "switchport trunk allowed vlan 30",
          "switchport trunk allowed vlan add 30",
          "switchport access vlan add 30",
          "encapsulation dot1Q 30",
        ],
        correctIndex: 1,
        explanation:
          "`add` を省略して `vlan 30` と指定すると、VLAN 10, 20 の許可設定が消えて VLAN 30 のみに上書きされてしまいます。",
      },
      {
        id: "q-vlan-2",
        question: "Router-on-a-Stick 構成で、ルータのサブインターフェースが802.1Qタグを識別するために必須となるコマンドはどれですか？",
        choices: [
          "switchport mode trunk",
          "encapsulation dot1Q <vlan-id>",
          "ip route 0.0.0.0 0.0.0.0",
          "spanning-tree portfast",
        ],
        correctIndex: 1,
        explanation:
          "ルータのサブインターフェースでは `encapsulation dot1Q <vlan-id>` で対応する VLAN タグ番号を紐づけます。",
      },
    ],
  },
  {
    id: "stage2/stp-etherchannel",
    stage: "stage-2",
    slug: "stp-etherchannel",
    title: "STP (スパニングツリー) と EtherChannel",
    summary:
      "L2ループ防止のルートブリッジ選出と、複数リンク束ねによる帯域・冗長性向上を理解します。",
    estimatedMinutes: 20,
    diagramVariant: "stp-etherchannel",
    glossary: [
      {
        term: "STP",
        shortDef: "L2冗長構成でブロードキャストストームを防ぐループ防止プロトコル",
        detail:
          "Spanning Tree Protocol (IEEE 802.1D / RSTP 802.1w)。冗長ポートの一部を論理的に Blocking 状態にしてループを遮断します。",
        layer: "L2",
      },
      {
        term: "ルートブリッジ",
        shortDef: "STPトポロジの中心となる基準スイッチ",
        detail:
          "BPDU を交換し、ブリッジID（プライオリティ + MACアドレス）が最も小さいスイッチが選出されます。",
        layer: "L2",
      },
      {
        term: "EtherChannel",
        shortDef: "複数の物理リンクを論理的に1本の太いリンクへ束ねる技術",
        detail:
          "STP に1本のリンクと認識させることで全リンクをアクティブに使いながら冗長性と帯域を確保します（LACP / PAgP）。",
        layer: "L2",
      },
    ],
    beginnerMode: {
      analogyTitle: "「非常口を普段は閉めておく警備員 (STP)」と「複数車線の合流高速 (EtherChannel)」",
      analogyText:
        "ケーブルが1本切れても止まらないようスイッチ同士を輪っか状につなぐと、ブロードキャストが永遠にグルグル回る「L2ループ」が起きて網全体がパンクします。STP は非常用の1本を論理的に閉じてループを防ぎ、障害時だけ開ける仕組みです。一方 EtherChannel は、2本のケーブルを1本の2車線道路として束ねて両方同時に使う技術です。",
      keyPoints: [
        {
          title: "L2ヘッダには TTL が無いからループが致命的",
          body: "L3 (IP) は TTL でループを止められますが、L2 フレームには寿命カウンタが無いため、STP によるループ防止が不可欠です。",
        },
        {
          title: "ブリッジIDが最小のスイッチがルートブリッジになる",
          body: "デフォルトプライオリティは 32768。意図したコアスイッチをルートにしたい場合はプライオリティを下げます（4096単位）。",
        },
        {
          title: "LACP (802.3ad) で異なるメーカ間でもリンク集約",
          body: "Active / Passive モードでネゴシエーションを行い、両端の速度・Duplex・VLAN設定を完全に一致させる必要があります。",
        },
      ],
      steps: [
        "STP 開始時、全スイッチが BPDU を送信して最小ブリッジIDの ルートブリッジ を選出します。",
        "非ルートスイッチはルートに最も近いポートをルートポート(RP)に選び、残りの冗長ポートをBlockingしてループを断ちます。",
        "EtherChannel を使う場合は LACP (active/passive) で複数ポートを Port-Channel インターフェースにまとめます。",
      ],
    },
    examMode: {
      examTips: [
        "RSTP (802.1w) のポート状態は Discarding / Learning / Forwarding の3つ。従来の Blocking / Listening が Discarding に統合された点が出題されます。",
        "LACP の組み合わせ: Active-Active 〇 / Active-Passive 〇 / Passive-Passive ✕（成立しない）。",
      ],
      referenceTable: {
        headers: ["技術 / 項目", "標準規格 / パラメータ", "ポイント"],
        rows: [
          ["STP / RSTP", "802.1D / 802.1w", "BPDU で最小 Bridge ID (Priority + MAC) が Root"],
          ["PortFast / BPDU Guard", "アクセスポート向け最適化", "PC接続ポートを即Forwarding化し、不正SW接続を遮断"],
          ["LACP (標準)", "802.3ad (active / passive)", "少なくとも片方が active である必要あり"],
          ["PAgP (Cisco独自)", "desirable / auto", "少なくとも片方が desirable である必要あり"],
        ],
      },
      commandBlocks: [
        {
          title: "ルートブリッジ指定 & LACP EtherChannel 設定例",
          code: "SW1(config)# spanning-tree vlan 10 priority 4096\nSW1(config)# interface range Gig0/1 - 2\nSW1(config-if-range)# channel-group 1 mode active\nSW1(config-if-range)# interface port-channel 1\nSW1(config-if)# switchport mode trunk",
          note: "EtherChannel のメンバーポート間で速度・Duplex・トランク許可VLANが不一致だと Err-disable やバンドル失敗になります。",
        },
      ],
      pitfalls: [
        "PortFast をスイッチ間トランクポートに誤って有効化すると一時的なL2ループを引き起こす恐れがあります。",
      ],
    },
    quiz: [
      {
        id: "q-stp-1",
        question: "STP においてルートブリッジ選出の基準となるブリッジIDの比較ルールはどれですか？",
        choices: [
          "プライオリティ値が最も大きいスイッチが選ばれる",
          "プライオリティ値（同じならMACアドレス）が最も小さいスイッチが選ばれる",
          "接続ポート数が最も多いスイッチが選ばれる",
          "IPアドレスが最も大きいスイッチが選ばれる",
        ],
        correctIndex: 1,
        explanation:
          "ブリッジIDは「小さいほど優先」です。プライオリティ値が同じ場合は最小の MAC アドレスを持つスイッチがルートブリッジになります。",
      },
      {
        id: "q-stp-2",
        question: "LACP を使った EtherChannel が正常に形成されないモードの組み合わせはどれですか？",
        choices: ["active と active", "active と passive", "passive と passive", "desirable と auto (PAgP)"],
        correctIndex: 2,
        explanation:
          "passive 同士は互いに相手のネゴシエーション開始を待ち続けるため、EtherChannel が確立しません。",
      },
    ],
  },
  {
    id: "stage2/static-ospf",
    stage: "stage-2",
    slug: "static-ospf",
    title: "スタティックルートとOSPF・最長一致 (LPM)",
    summary:
      "ルーティングテーブルの参照優先度（LPM・AD値）とOSPFネイバー形成の基礎を学びます。",
    estimatedMinutes: 25,
    diagramVariant: "static-ospf",
    relatedHref: {
      href: "/labs/troubleshoot?scenario=ts-routing-asymmetric",
      label: "拠点間Pingタイムアウト（ルート不整合）を復旧する",
    },
    glossary: [
      {
        term: "LPM",
        shortDef: "最もプレフィックス長が長い（具体的な）ルートを優先選ぶ原則",
        detail:
          "Longest Prefix Match（最長一致検索）。たとえば /16 と /24 の両方にマッチする宛先なら、より具体的な /24 の経路が使われます。",
        layer: "L3",
      },
      {
        term: "AD値",
        shortDef: "経路情報源（Connected/Static/OSPF等）の信頼度を表す数値",
        detail:
          "Administrative Distance。同じプレフィックスに対する経路が複数あるとき、値が小さい方がルーティングテーブルに採用されます（Connected=0, Static=1, OSPF=110）。",
        layer: "L3",
      },
      {
        term: "OSPF",
        shortDef: "リンク状態とコストで最適経路を自動計算する動的ルーティング",
        detail:
          "Open Shortest Path First。帯域幅に基づくコストをメトリックに使い、SPFアルゴリズムでループのない最短経路を自動算出します。",
        layer: "L3",
      },
    ],
    beginnerMode: {
      analogyTitle: "「手書きの道案内 (スタティック)」と「リアルタイム渋滞ナビ (OSPF)」",
      analogyText:
        "小規模拠点なら『東京行きは右の橋へ』と手動で道標を立てるスタティックルートで十分ですが、拠点が増えると1本切れたときの書き換えが大変です。OSPF はルータ同士が自動で道路マップを交換し、最適なルートを即座に再計算してくれるナビゲーションです。道案内を選ぶときは、常に「一番細かい番地まで一致する案内 (LPM)」が最優先されます。",
      keyPoints: [
        {
          title: "最長一致 (LPM) は AD値・メトリックより優先される",
          body: "たとえ AD=1 のスタティックルート (/16) があっても、OSPF (/24) の方が宛先に長く一致するなら /24 が選ばれます。",
        },
        {
          title: "L3通信は「行き」と「帰り」が揃って初めて成功する",
          body: "往路の静的ルートだけ設定して復路のルータに戻りルートを忘れると、宛先に届いても Ping がタイムアウトします。",
        },
        {
          title: "デフォルトルート (0.0.0.0/0) は最後の受け皿",
          body: "他のどのルートにも一致しなかったパケットをインターネット等へ流す /0 のルートです。",
        },
      ],
      steps: [
        "ルータは宛先 IP に対し、ルーティングテーブル内の全エントリとマスクを照合し、最も長いプレフィックス (LPM) を選びます。",
        "複数プロトコルから同じプレフィックスを学習した場合は、AD値（Connected 0 < Static 1 < OSPF 110）で採用経路を決めます。",
        "OSPF では Area 0 をバックボーンとし、Hello/Dead タイマーやサブネットマスク等の一致条件を満たすと FULL ネイバーになります。",
      ],
    },
    examMode: {
      examTips: [
        "「LPM（マスク長が最長のものを選ぶ）」→「同一マスク長なら AD値が最小のものを選ぶ」→「同一プロトコル内ならメトリック最小を選ぶ」の優先順序を絶対に混同しないでください。",
        "OSPF のデフォルト AD値は 110、EIGRP は 90、RIP は 120、Static は 1、Connected は 0 です。",
      ],
      referenceTable: {
        headers: ["経路種別", "コード", "デフォルトAD値", "特徴"],
        rows: [
          ["Connected", "C", "0", "稼働中インターフェースの直結サブネット"],
          ["Static", "S", "1", "管理者が手動で登録 (`ip route`)"],
          ["EIGRP", "D", "90", "Cisco拡張ディスタンスベクタ"],
          ["OSPF", "O", "110", "リンクステート型 (Cost = 参照帯域/実帯域)"],
          ["RIP", "R", "120", "ホップ数ベース (最大15ホップ)"],
        ],
      },
      commandBlocks: [
        {
          title: "スタティックルート設定 & OSPF 基本設定",
          code: "R1(config)# ip route 192.168.20.0 255.255.255.0 10.0.0.2\nR1(config)# no ip route 192.168.99.0 255.255.255.0 10.0.0.99\n\nR1(config)# router ospf 1\nR1(config-router)# router-id 1.1.1.1\nR1(config-router)# network 10.0.0.0 0.0.0.3 area 0",
          note: "OSPF の network 文ではサブネットマスクではなくワイルドカードマスク (例: /30 -> 0.0.0.3) を使います。",
        },
      ],
      pitfalls: [
        "OSPF ネイバーが EXSTART/INIT のまま進まない場合、Area番号・Hello/Dead間隔・MTU・ネットワークマスク不一致を疑います。",
      ],
    },
    quiz: [
      {
        id: "q-route-1",
        question: "ルーティングテーブルに ① `0.0.0.0/0` (Static, AD=1)、② `192.168.0.0/16` (Static, AD=1)、③ `192.168.10.0/24` (OSPF, AD=110) があるとき、宛先 `192.168.10.55` に選ばれる経路はどれですか？",
        choices: ["① 0.0.0.0/0", "② 192.168.0.0/16", "③ 192.168.10.0/24", "AD値比較のためパケットは破棄される"],
        correctIndex: 2,
        explanation:
          "AD値よりも先に 最長一致 (LPM) が適用されます。/24 が最も長く一致するため ③ の OSPF 経路が選択されます。",
      },
      {
        id: "q-route-2",
        question: "片方向の静的ルートだけ設定され、対向ルータに戻りルートが無い場合に起きる現象として正しいものはどれですか？",
        choices: [
          "往路で ARP Timeout になる",
          "宛先まで届いても Echo Reply が送信元へ戻れず Ping が失敗する",
          "スイッチで VLAN Mismatch が起きる",
          "OSPF の AD値が 0 に下がる",
        ],
        correctIndex: 1,
        explanation:
          "ICMP Ping は要求と応答の双方向通信です。往路が成功しても復路ルートが無ければ応答が途中で破棄されます。",
      },
    ],
  },
  {
    id: "stage2/nat-napt",
    stage: "stage-2",
    slug: "nat-napt",
    title: "NAT / NAPT (PAT) によるアドレス変換",
    summary:
      "プライベートIPとグローバルIPの変換方式（Static / Dynamic / PAT）を実践的に整理します。",
    estimatedMinutes: 15,
    diagramVariant: "nat-napt",
    glossary: [
      {
        term: "プライベートIP",
        shortDef: "社内LAN等の閉域で自由に使えるIP範囲 (RFC 1918)",
        detail:
          "10.0.0.0/8、172.16.0.0/12、192.168.0.0/16。インターネット上へそのまま流すことはできません。",
        layer: "L3",
      },
      {
        term: "NAT",
        shortDef: "1対1またはプール単位でIPアドレスを相互変換する技術",
        detail:
          "Network Address Translation。Inside Local (社内プライベートIP) を Inside Global (外部公開グローバルIP) へ変換します。",
        layer: "L3",
      },
      {
        term: "PAT (NAPT)",
        shortDef: "IPに加えてポート番号も変換し、1つのグローバルIPを全社員で共有する方式",
        detail:
          "Port Address Translation（Cisco設定では overload キーワード）。家庭や企業のインターネット出口で最も多く使われます。",
        layer: "L3/L4",
      },
    ],
    beginnerMode: {
      analogyTitle: "代表電話番号 1つで全社員の外線発着信を捌く「会社の内線交換機」",
      analogyText:
        "社内（Inside）で使う内線番号が プライベートIP、外線に出るときに名乗る会社の代表番号がグローバルIPです。社員100人全員に100個の外線番号を買うのは高コストなので、PAT (NAPT) を使えば「代表番号＋どの内線担当かの識別札（ポート番号）」の組み合わせで、たった1つのグローバルIPから全社員が同時にネットへ出られます。",
      keyPoints: [
        {
          title: "Static NAT は公開サーバ向け (1対1固定)",
          body: "外部から特定ポートへ常にアクセスさせたい Web サーバ等には固定の 1対1 変換を使います。",
        },
        {
          title: "PAT / NAPT (overload) は多数の社内端末向け (多対1)",
          body: "送信元 IP だけでなく送信元ポート番号を変換テーブルに記録し、戻り通信を正しい社内 PC へ振り分けます。",
        },
        {
          title: "Inside / Outside の境界指定が必須",
          body: "ルータのどのインターフェースが社内 (`ip nat inside`) でどれが社外 (`ip nat outside`) かを必ず指定します。",
        },
      ],
      steps: [
        "ルータの LAN 側ポートに `ip nat inside`、WAN/ISP 側ポートに `ip nat outside` を設定します。",
        "変換対象となる社内サブネットを ACL で指定します。",
        "`ip nat inside source list 1 interface Gig0/1 overload` のように PAT を有効化します。",
      ],
    },
    examMode: {
      examTips: [
        "CiscoのNAT4用語（Inside Local / Inside Global / Outside Local / Outside Global）は定義を正確に区別しましょう。",
        "`overload` キーワードを忘れると PAT にならず、プール内のグローバルIP数だけしか同時接続できなくなります。",
      ],
      referenceTable: {
        headers: ["NAT用語", "意味", "典型例"],
        rows: [
          ["Inside Local", "変換前の社内プライベートIP", "192.168.10.10"],
          ["Inside Global", "インターネットから見える社内側の変換後IP", "203.0.113.5"],
          ["Outside Global", "外部サーバの実際のグローバルIP", "198.51.100.80"],
          ["Outside Local", "社内から見た外部サーバのIP (通常Globalと同値)", "198.51.100.80"],
        ],
      },
      commandBlocks: [
        {
          title: "PAT (NAPT / overload) の標準設定例",
          code: "R1(config)# access-list 1 permit 192.168.10.0 0.0.0.255\nR1(config)# interface Gig0/0\nR1(config-if)# ip nat inside\nR1(config-if)# interface Gig0/1\nR1(config-if)# ip nat outside\nR1(config-if)# exit\nR1(config)# ip nat inside source list 1 interface Gig0/1 overload\nR1# show ip nat translations",
          note: "トラブル時は `show ip nat translations` で変換テーブルが生成されているか、inside/outside 指定漏れが無いかを確認します。",
        },
      ],
      pitfalls: [
        "Inside / Outside の指定が逆、または片方抜けていると `show ip nat translations` が空のまま変換されません。",
      ],
    },
    quiz: [
      {
        id: "q-nat-1",
        question: "社内PC (192.168.10.10) が WAN インターフェースの単一グローバルIP (203.0.113.1) を共有してインターネットへ出る PAT 設定で必須となるキーワードはどれですか？",
        choices: ["static", "overload", "encapsulation", "trunk"],
        correctIndex: 1,
        explanation:
          "Cisco IOS の `ip nat inside source ...` の末尾に `overload` を付けることでポート番号を使った多対1変換 (PAT/NAPT) が有効になります。",
      },
      {
        id: "q-nat-2",
        question: "変換前における、社内 LAN 上の PC 自身のプライベート IP アドレスを指す Cisco NAT 用語はどれですか？",
        choices: ["Inside Global", "Inside Local", "Outside Local", "Outside Global"],
        correctIndex: 1,
        explanation:
          "社内(Inside)のローカル側で使われている変換前アドレスなので Inside Local と呼びます。",
      },
    ],
  },
  {
    id: "stage2/acl-security",
    stage: "stage-2",
    slug: "acl-security",
    title: "ACL (アクセス制御リスト) と暗黙のdeny",
    summary:
      "標準ACLと拡張ACLの記述順序、ワイルドカードマスク、適用方向の落とし穴を解説します。",
    estimatedMinutes: 20,
    diagramVariant: "acl-security",
    relatedHref: {
      href: "/tools?tab=config-review",
      label: "コンフィグDiff演習で暗黙のdeny漏れをレビューする",
    },
    glossary: [
      {
        term: "ACL",
        shortDef: "パケットの通過許可(permit)・拒否(deny)を条件で制御するリスト",
        detail:
          "Access Control List。インターフェースの in / out 方向に適用し、ルールを上から順番に評価して最初に一致した行を実行します。",
        layer: "L3/L4",
      },
      {
        term: "暗黙のdeny",
        shortDef: "ACLの末尾に自動的に隠れて存在する「すべて拒否 (deny any)」ルール",
        detail:
          "明示的な permit 行が1つも書かれていない、あるいはどの条件にも一致しないパケットは、最後に暗黙の deny により全破棄されます。",
        layer: "L3",
      },
      {
        term: "ワイルドカードマスク",
        shortDef: "ACLで「どのビットをチェックするか (0=一致必須, 1=無視)」を指定する値",
        detail:
          "サブネットマスクをビット反転させた値です（例: 255.255.255.0 の反転は 0.0.0.255）。host は 0.0.0.0、any は 255.255.255.255 に相当します。",
        layer: "L3",
      },
    ],
    beginnerMode: {
      analogyTitle: "上から順に照合して「名簿に載っていなければ全員入館お断り」にする警備ゲート",
      analogyText:
        "ACL は上から1行ずつチェックするフィルタです。一致した時点で即座に許可か拒否が決まり、下の行は見ません。そして最大の注意点が 暗黙のdeny です。リストの最後に『それ以外の人は全員通す (permit any)』と書き忘れると、目的の通信を1つ止めたつもりが社内の全通信を止めてしまう事故が起きます。",
      keyPoints: [
        {
          title: "上から順・ファーストマッチ原則",
          body: "範囲の狭い具体的なルールを上、範囲の広いルールを下に書かないと、上の行に吸い込まれて下のルールが効きません。",
        },
        {
          title: "標準ACL (1-99) と拡張ACL (100-199)",
          body: "標準ACLは「送信元IP」のみ見られるため宛先近くに配置、拡張ACLは「送信元・宛先IP・プロトコル・ポート番号」まで見られるため送信元近くに配置するのが原則です。",
        },
        {
          title: "in と out の適用方向を間違えない",
          body: "ルータに入る瞬間を止めるなら `in`、ルータから出る瞬間を止めるなら `out` に適用します。",
        },
      ],
      steps: [
        "要件に合わせて標準ACLまたは拡張ACLを作成し、順番（具体→汎用）と末尾の `permit ip any any` 有無を確認します。",
        "ルータの適切なインターフェースで `ip access-group <番号|名前> in|out` を適用します。",
        "`show access-lists` で各行のヒットカウントが増えているか検証します。",
      ],
    },
    examMode: {
      examTips: [
        "標準ACLは宛先の近く、拡張ACLは送信元の近く（不要なトラフィックを早めに落とすため）に適用するセオリーは頻出です。",
        "`deny` だけの ACL に末尾 `permit any` を入れ忘れる設定ミスは実務・試験ともに鉄板問題です。",
      ],
      referenceTable: {
        headers: ["ACL種別", "番号範囲", "判定できる条件", "推奨配置場所"],
        rows: [
          ["標準 ACL", "1–99 / 1300–1999", "送信元 IP のみ", "宛先に最も近いインターフェース"],
          ["拡張 ACL", "100–199 / 2000–2699", "送信元/宛先 IP, L4プロトコル, ポート番号", "送信元に最も近いインターフェース"],
        ],
      },
      commandBlocks: [
        {
          title: "特定ホストからのHTTPのみ許可する安全でない例 vs 正しい例",
          code: "! 特定トラフィックだけ拒否し他を通す場合の正しい末尾記述\nR1(config)# ip access-list extended BLOCK_TELNET\nR1(config-ext-nacl)# deny tcp any any eq 23\nR1(config-ext-nacl)# permit ip any any\nR1(config)# interface Gig0/0\nR1(config-if)# ip access-group BLOCK_TELNET in",
          note: "`permit ip any any` を書かないと Telnet 以外の通信もすべて暗黙の deny で遮断されます。",
        },
      ],
      pitfalls: [
        "ワイルドカードマスク `0.0.0.255` を `255.255.255.0` と逆にしてしまうミス。",
        "ACL はそのルータ自身が発生させるトラフィックには原則効かず、通過 (transit) トラフィックに対して作用します。",
      ],
    },
    quiz: [
      {
        id: "q-acl-1",
        question: "特定のホスト (192.168.10.50) からのアクセスだけを拒否し、それ以外の全通信は許可する標準 ACL で必須となる記述はどれですか？",
        choices: [
          "`deny host 192.168.10.50` の1行だけ書く",
          "`deny host 192.168.10.50` の後に `permit any` を書く",
          "`permit any` を先頭に書き、その後に `deny host 192.168.10.50` を書く",
          "ワイルドカードマスクに `255.255.255.0` を指定する",
        ],
        correctIndex: 1,
        explanation:
          "末尾に暗黙の deny があるため、2行目に `permit any` を書かないと全員拒否になります。また `permit any` を1行目に書くとファーストマッチにより下の deny が評価されません。",
      },
      {
        id: "q-acl-2",
        question: "`172.16.0.0/22` 全体を一致させるワイルドカードマスクとして正しいものはどれですか？",
        choices: ["0.0.255.255", "0.0.3.255", "0.0.7.255", "255.255.252.0"],
        correctIndex: 1,
        explanation:
          "/22 のサブネットマスクは 255.255.252.0 です。255.255.255.255 から引くと 0.0.3.255 になります。",
      },
    ],
  },
  {
    id: "stage2/cisco-ios",
    stage: "stage-2",
    slug: "cisco-ios",
    title: "Cisco IOS 基本操作と階層コマンド体系",
    summary:
      "EXEC・コンフィグモード遷移、省略入力、showコマンド、running-config管理を体得します。",
    estimatedMinutes: 15,
    diagramVariant: "cisco-ios",
    relatedHref: {
      href: "/labs/cli?scenario=cli-basic-routing",
      label: "仮想CLIラボでコマンドを実践入力する",
    },
    glossary: [
      {
        term: "EXECモード",
        shortDef: "状態確認や運用操作を行うモード（User `>` / Privileged `#`）",
        detail:
          "User EXEC (`Router>`) では限られた確認のみ可能。`enable` で Privileged EXEC (`Router#`) に入ると `show running-config` 等が使えます。",
        layer: "IOS",
      },
      {
        term: "running-config",
        shortDef: "現在 RAM 上で動作中の設定ファイル",
        detail:
          "コマンド変更は即座に running-config に反映されますが、再起動で消えないよう実機では `copy running-config startup-config` で保存します。",
        layer: "IOS",
      },
      {
        term: "no 構文",
        shortDef: "既存の設定を取り消したりデフォルト状態に戻す接頭辞",
        detail:
          "例: `no shutdown`（有効化）、`no ip route ...`（経路削除）、`no ip address`（IP削除）。",
        layer: "IOS",
      },
    ],
    beginnerMode: {
      analogyTitle: "「受付ロビー (>)」「バックヤード (#)」「作業部屋 ((config)#)」の階層構造",
      analogyText:
        "Cisco IOS では誤操作を防ぐため、今どの階層にいるかプロンプト記号で区別します。まずは確認だけのロビー `>` から `enable` で管理者部屋 `#` へ入り、さらに `configure terminal` で設定作業室 `(config)#` へ移動します。特定のポートを触るときはその中の個室 `(config-if)#` に入ります。",
      keyPoints: [
        {
          title: "一意に特定できるなら省略入力できる",
          body: "`show ip interface brief` を `sh ip int br`、`configure terminal` を `conf t` のように短く打てます（曖昧なときは `% Ambiguous command`）。",
        },
        {
          title: "`?` ヘルプと `Tab` 補完を味方にする",
          body: "コマンドを暗記しきれなくても、`?` を打てば現在モードの有効コマンド一覧を確認できます。",
        },
        {
          title: "`exit` は1階層戻る、`end` は特権EXEC (`#`) へ一気に戻る",
          body: "深いコンフィグ階層から即座に `show` コマンドで確認したいときは `end`（またはコンフィグ内で `do show ...`）が便利です。",
        },
      ],
      steps: [
        "`enable` で `#` モードに入り、`show ip interface brief` や `show running-config` で現状を把握します。",
        "`configure terminal` で `(config)#` へ入り、`interface Gig0/0` や `ip route ...` を設定します。",
        "設定を削除・有効化したいときは先頭に `no` を付け、`end` で `#` に戻って状態確認します。",
      ],
    },
    examMode: {
      examTips: [
        "User EXEC (`>`) と Privileged EXEC (`#`) で許可されるコマンドの違い、`exit` と `end` の戻り先の違いが頻出です。",
        "コンフィグモードのまま確認系を打つ `do show ...` はラボ試験で大幅に時間を節約できます。",
      ],
      referenceTable: {
        headers: ["プロンプト", "モード名", "遷移コマンド", "主な操作"],
        rows: [
          ["Router>", "User EXEC", "初期ログイン時", "ping, traceroute, 限定的な show"],
          ["Router#", "Privileged EXEC", "enable / end", "show running-config, 機器保存・診断"],
          ["Router(config)#", "Global Config", "configure terminal", "hostname, ip route, vlan, interface選択"],
          ["Router(config-if)#", "Interface Config", "interface <name>", "ip address, shutdown / no shutdown, switchport"],
          ["Router(config-subif)#", "Subinterface Config", "interface Gig0/0.10", "encapsulation dot1Q, ip address"],
        ],
      },
      commandBlocks: [
        {
          title: "実務・試験で最頻出の短縮確認コマンド集",
          code: "R1> en\nR1# sh ip int br\nR1# sh ip ro\nR1# sh run\nR1# conf t\nR1(config)# int g0/0\nR1(config-if)# no sh\nR1(config-if)# do sh ip int br",
          note: "当アプリの仮想ネットワークエンジンもこれらの前方一致短縮入力と `do` コマンドに完全対応しています。",
        },
      ],
      pitfalls: [
        "インターフェースを `no shutdown` し忘れていつまでも `administratively down` のままにしてしまうのは初学者が最も多く踏むミスです。",
      ],
    },
    quiz: [
      {
        id: "q-ios-1",
        question: "プロンプトが `R1(config-if)#` の状態から、1コマンドで `R1#`（Privileged EXECモード）へ戻るコマンドはどれですか？",
        choices: ["exit", "disable", "end", "no shutdown"],
        correctIndex: 2,
        explanation:
          "`exit` は1つ上の `(config)#` に戻りますが、`end` は階層に関わらず一気に特権EXECモード (`#`) へ戻ります。",
      },
      {
        id: "q-ios-2",
        question: "Global Config モード `(config)#` にいるまま、`show ip route` を実行したいときに使う接頭辞はどれですか？",
        choices: ["enable", "do", "run", "set"],
        correctIndex: 1,
        explanation:
          "`do show ip route` のように `do` を先頭に付けることで、コンフィグモードを抜けずに特権EXECコマンドを実行できます。",
      },
    ],
  },
  {
    id: "stage2/ipv6-fundamentals",
    stage: "stage-2",
    slug: "ipv6-fundamentals",
    title: "IPv6基礎（アドレス構造・圧縮ルール・SLAAC / NDP）",
    summary: "128bitのIPv6アドレス表記、RFC 5952準拠のゼロ圧縮、GUA/リンクローカル/ULA、およびARPに代わるNDPの仕組みを学びます。",
    estimatedMinutes: 25,
    diagramVariant: "ipv6-fundamentals",
    relatedHref: {
      href: "/tools?tab=ipv6",
      label: "IPv6 圧縮・展開ツールを開く",
    },
    glossary: [
      {
        term: "GUA (2000::/3)",
        shortDef: "Global Unicast Address。インターネット全体で到達可能なIPv6グローバルアドレス。",
        detail: "IPv4のグローバルIPに相当し、先頭3bitが `001`（`2000::` 〜 `3fff:...`）から始まります。組織への割り当て標準は `/48`、LANサブネット標準は `/64` です。",
        layer: "L3 (IPv6)",
      },
      {
        term: "Link-Local (FE80::/10)",
        shortDef: "同一リンク内でのみ通信可能な自動割り当てアドレス。",
        detail: "ルータを越えて転送されません。IPv6を有効にした全インターフェースに必ず生成され、NDPやデフォルトゲートウェイ指定（`fe80::1` など）に使用されます。",
        layer: "L3 (IPv6)",
      },
      {
        term: "Unique Local (FC00::/7)",
        shortDef: "IPv4のプライベートIPに相当する閉域網用IPv6アドレス。",
        detail: "実務ではランダムな40bit Global IDを含む `FD00::/8` が使われます。NATなしで社内網やVPC間接続で重複しにくい設計が可能です。",
        layer: "L3 (IPv6)",
      },
      {
        term: "SLAAC & NDP",
        shortDef: "Stateless Address Autoconfiguration / Neighbor Discovery Protocol。",
        detail: "IPv6にはARPとブロードキャストが存在しません。ICMPv6ベースのNDP（RS/RA, NS/NA）により、ルータ情報を受け取ってDHCPサーバなしでも自動的にIPv6アドレス(SLAAC)を生成できます。",
        layer: "L3 (ICMPv6)",
      },
    ],
    beginnerMode: {
      analogyTitle: "長い番地を賢く省略する次世代アドレス体系",
      analogyText:
        "IPv4（約43億個）の枯渇を解決するため、IPv6は128bit（実質無限大）の住所空間を持ちます。32文字もの16進数は人間が読みにくいため、2つの省略ルール（①ブロック先頭の0を消す、②連続する0ブロック1箇所を `::` にする）でスッキリ表記します。",
      keyPoints: [
        {
          title: "ゼロ省略の2大ルール（RFC 5952）",
          body: "各ブロックの先頭の0（例: `0db8` → `db8`）は省略できます。さらに連続する複数の `0000` ブロックは **最も長い1箇所だけ** `::` に圧縮できます（2回 `::` を書くと何ブロック省略されたか逆算できなくなるため禁止）。",
        },
        {
          title: "ブロードキャスト廃止とマルチキャスト活用",
          body: "IPv6では全員宛てのブロードキャストを廃止し、必要なノード群だけが届くマルチキャスト（`FF00::/8`）と、ルータが配下の端末へプレフィックスを通知する RA（Router Advertisement）により効率的に通信します。",
        },
      ],
      steps: [
        "例 `2001:0db8:0000:0000:0000:0000:0000:0001` の各ブロック先頭ゼロを削除 → `2001:db8:0:0:0:0:0:1`",
        "連続する最も長い `0` の並びを1箇所だけ `::` に置き換え → `2001:db8::1`",
        "1つだけの `0` ブロック（例: `2001:db8:0:1::1` の第3ブロック）は `::` にせず `0` と書きます。",
      ],
    },
    examMode: {
      examTips: [
        "CCNAでは「正しい短縮表記はどれか」「このIPv6アドレスの種類は何か」「EUI-64によるMACアドレス変換」が頻出です。",
        "EUI-64 では 48bit MAC の中央に `fffe` を挿入し、先頭から7bit目（U/Lビット）を反転させます。",
      ],
      referenceTable: {
        headers: ["IPv6 アドレス種別", "プレフィックス / 先頭", "IPv4 での相当・用途"],
        rows: [
          ["Global Unicast (GUA)", "2000::/3 (2001:...等)", "パブリックIP（インターネットルーティング可）"],
          ["Unique Local (ULA)", "FC00::/7 (実務は FD00::/8)", "プライベートIP (RFC 1918相当・閉域網用)"],
          ["Link-Local (LLA)", "FE80::/10", "APIPA (169.254.0.0/16)＋NDP・ルーティング次ホップ"],
          ["Multicast", "FF00::/8 (ff02::1 全ノード)", "ブロードキャスト代替・OSPFv3 (ff02::5)"],
          ["Loopback / Unspecified", "::1/128 , ::/128", "127.0.0.1 / 0.0.0.0"],
        ],
      },
      commandBlocks: [
        {
          title: "Cisco IOS IPv6 ルーティング有効化と設定",
          code: `R1(config)# ipv6 unicast-routing
R1(config)# interface Gig0/0
R1(config-if)# ipv6 address 2001:db8:10::1/64
R1(config-if)# ipv6 address fe80::1 link-local
R1(config-if)# no shutdown`,
          note: "ルータで IPv6 パケット転送や RA 送信を行うにはグローバル設定で `ipv6 unicast-routing` が必須です。",
        },
        {
          title: "IPv6 確認コマンド",
          code: `R1# show ipv6 interface brief
R1# show ipv6 route
R1# show ipv6 neighbors`,
          note: "`show ipv6 neighbors` は IPv4 の `show arp` に相当し、NDP で解決された隣接 MAC アドレスを表示します。",
        },
      ],
      pitfalls: [
        "1つのIPv6アドレス内に `::` を2回以上含める表記（例 `2001::1::1`）は完全に不正です。",
        "ルータの `ipv6 unicast-routing` を有効化し忘れると、IF に IPv6 を振ってもパケットが転送されません。",
      ],
    },
    quiz: [
      {
        id: "q-ipv6-1",
        question: "完全表記 `2001:0db8:0000:0001:0000:0000:0000:0050` を RFC 5952 準拠で正しく最短圧縮した表記はどれですか？",
        choices: [
          "2001:db8::1::50",
          "2001:db8::1:0:0:0:50",
          "2001:db8:0:1::50",
          "2001:db8:0:1::5",
        ],
        correctIndex: 2,
        explanation:
          "後半の連続3つのゼロブロックを `::` に圧縮するのが最長であり、単一のゼロである第3ブロックは `0` のまま、末尾の `0050` は先頭ゼロのみ削って `50` とします。",
      },
      {
        id: "q-ipv6-2",
        question: "アドレス `FE80::20C:29FF:FE10:1` の種別と特徴として正しいものはどれですか？",
        choices: [
          "Global Unicast (インターネット上で公開可能)",
          "Link-Local (同一サブネット内限定・ルータ越え不可)",
          "Unique Local (閉域網向け・別サブネット間ルーティング可)",
          "Multicast (全ルータ宛て)",
        ],
        correctIndex: 1,
        explanation:
          "`FE80::/10` はリンクローカルアドレスです。同一データリンク内の通信や NDP / ダイナミックルーティングの次ホップとして使われ、ルータを越えて転送されません。",
      },
      {
        id: "q-ipv6-3",
        question: "IPv6 ネットワークにおいて、IPv4 の ARP に代わってIPアドレスから MAC アドレスを解決する仕組みはどれですか？",
        choices: [
          "RARP",
          "NDP (ICMPv6 NS / NA)",
          "DHCPv4 Relay",
          "IGMP Snooping",
        ],
        correctIndex: 1,
        explanation:
          "IPv6 ではブロードキャストと ARP を廃止し、ICMPv6 の Neighbor Solicitation (NS) と Neighbor Advertisement (NA) を使った NDP でアドレス解決を行います。",
      },
    ],
  },
  {
    id: "stage2/network-management",
    stage: "stage-2",
    slug: "network-management",
    title: "ネットワーク管理・監視（SSH・CDP/LLDP・NTP・Syslog・SNMP）",
    summary: "機器への安全なSSH接続設定、隣接機器発見(CDP/LLDP)、時刻同期(NTP)、ログ管理(Syslog)、およびSNMP監視の実務設定を学びます。",
    estimatedMinutes: 20,
    diagramVariant: "network-management",
    glossary: [
      {
        term: "SSH (TCP 22)",
        shortDef: "公開鍵・共通鍵暗号で通信内容を保護する安全なリモートログインプロトコル。",
        detail: "Telnet (TCP 23) は平文でパスワードが盗聴されるため本番環境では禁止され、`transport input ssh` で VTY 回線を SSH 限定にします。",
        layer: "L7 (Management)",
      },
      {
        term: "CDP / LLDP",
        shortDef: "隣接スイッチ・ルータの機器名や対向ポート番号をL2で自動検出するプロトコル。",
        detail: "CDP は Cisco 独自、LLDP (IEEE 802.1AB) はマルチベンダ対応の標準規格です。物理配線図がない現場での接続確認 (`show cdp neighbors`) に不可欠です。",
        layer: "L2",
      },
      {
        term: "NTP (UDP 123)",
        shortDef: "ネットワーク機器やサーバの時刻を基準時計 (Stratum) と精密に同期するプロトコル。",
        detail: "複数機器の時刻がズレていると、障害発生時の Syslog 相関調査が不可能になるため全機器で統一します。",
        layer: "L7 (UDP 123)",
      },
      {
        term: "Syslog / SNMPv3",
        shortDef: "イベントログ転送 (UDP 514) と MIB ベース監視・トラップ通知 (UDP 161/162)。",
        detail: "Syslog には緊急度 0 (Emergencies)〜7 (Debugging) があり、SNMPv3 では認証＋暗号化 (authPriv) によりセキュアな状態監視が可能です。",
        layer: "L7 (Monitoring)",
      },
    ],
    beginnerMode: {
      analogyTitle: "システム運用・障害調査の「目・耳・腕時計」を揃える",
      analogyText:
        "ネットワークは構築して終わりではありません。遠隔から安全に操作する『鍵（SSH）』、誰と繋がっているか見る『目（CDP/LLDP）』、ログの時刻を揃える『腕時計（NTP）』、異変を知らせる『警報機（Syslog/SNMP）』があって初めて実務運用できます。",
      keyPoints: [
        {
          title: "Telnet を塞いで SSHv2 に一本化する",
          body: "Cisco IOS で SSH を有効化するには ①ホスト名設定 ②`ip domain-name` 設定 ③RSA 鍵生成 (`crypto key generate rsa`) ④`username`/`login local` ⑤`line vty` で `transport input ssh` の5ステップが必要です。",
        },
        {
          title: "Syslog 重要度レベル 0〜7 と NTP の連携",
          body: "Syslog は数字が **小さいほど深刻**（0=Emergency, 3=Error, 4=Warning, 5=Notification, 6=Informational, 7=Debug）です。NTP で時刻を揃えて中央サーバへ送るのが基本です。",
        },
      ],
      steps: [
        "全ルータ・スイッチで `hostname` と `ip domain-name` を設定し 2048bit RSA 鍵を生成して SSH を有効化する",
        "`line vty 0 4` で `transport input ssh` を指定し Telnet の待受を完全に遮断する",
        "`ntp server`・`logging host`・`snmp-server` を構成し、運用監視基盤からタイムスタンプ付きログとポーリングを受信する",
      ],
    },
    examMode: {
      examTips: [
        "Syslog Severity (0=Emergency 〜 7=Debugging) の語呂合わせ・数値と名称、および `logging trap informational`（指定レベル **以下＝0〜6すべて** を送信する仕様）が頻出です。",
        "CDP のセキュリティリスク（外部ISP向きIFでは `no cdp enable` で情報漏洩を防ぐ）もよく問われます。",
      ],
      referenceTable: {
        headers: ["管理プロトコル", "トランスポート / ポート", "主な確認・設定用途"],
        rows: [
          ["SSH v2", "TCP 22", "暗号化 CLI ログイン (`ip ssh version 2`)"],
          ["NTP", "UDP 123", "Stratum 0(原子時計)〜15(最大ホップ), `show ntp associations`"],
          ["Syslog", "UDP 514", "Severity 0(最重)〜7(Debug), `service timestamps log datetime`"],
          ["SNMP v2c/v3", "UDP 161 (Query) / 162 (Trap)", "NMS によるポーリング監視 (authPriv推奨)"],
          ["CDP / LLDP", "L2 マルチキャスト", "隣接機器ホスト名・対向ポート特定 (`show cdp neighbors detail`)"],
        ],
      },
      commandBlocks: [
        {
          title: "Cisco IOS SSHv2 & 時刻同期・ログ基本セット",
          code: `R1(config)# ip domain-name netforge.local
R1(config)# crypto key generate rsa modulus 2048
R1(config)# ip ssh version 2
R1(config)# username admin privilege 15 secret StrongPass!
R1(config)# line vty 0 4
R1(config-line)# login local
R1(config-line)# transport input ssh
R1(config)# ntp server 192.168.100.10
R1(config)# logging host 192.168.100.20
R1(config)# logging trap informational`,
          note: "既定ホスト名 (`Router`) のままでは RSA 鍵が生成できないため、必ず事前に `hostname` と `ip domain-name` を設定します。",
        },
        {
          title: "隣接機器・システム監視の確認コマンド",
          code: `SW1# show cdp neighbors detail
SW1# show lldp neighbors
SW1# show ntp status
SW1# show logging`,
          note: "対向装置の管理IPアドレスやIOSバージョンまで確認したい場合は `show cdp neighbors detail` が強力です。",
        },
      ],
      pitfalls: [
        "`crypto key generate rsa` を実行する前に `hostname` と `ip domain-name` が未設定だと鍵生成に失敗します。",
        "`logging trap warnings` (レベル4) を設定した場合、送信されるのは 0〜4（Emergency〜Warning）であり、数値の大きい 5〜7 は送信されません。",
      ],
    },
    quiz: [
      {
        id: "q-mgmt-1",
        question: "Cisco IOS ルータで `logging trap errors`（Severity 3）を設定したとき、Syslog サーバへ送信されるログレベルの組み合わせはどれですか？",
        choices: [
          "レベル 3 (Errors) のみ",
          "レベル 0, 1, 2, 3（最も重大〜Errors）",
          "レベル 3, 4, 5, 6, 7",
          "レベル 7 (Debugging) のみ",
        ],
        correctIndex: 1,
        explanation:
          "Syslog は数値が小さいほど重大度が高く、`logging trap <level>` は指定値 **以下（0 〜 指定レベル）** のすべての重大度を送信します。",
      },
      {
        id: "q-mgmt-2",
        question: "Cisco 製スイッチと他社製スイッチが直接接続されている環境で、双方のデバイス名や対向ポートを自動検出するために有効化すべきプロトコルはどれですか？",
        choices: ["CDP", "LLDP", "ARP", "SNMP"],
        correctIndex: 1,
        explanation:
          "CDP は Cisco 独自規格であるため、他社製品との相互接続環境では IEEE 802.1AB 標準の LLDP (`lldp run`) を使用します。",
      },
      {
        id: "q-mgmt-3",
        question: "SSH 接続を有効化した Cisco IOS の `line vty 0 4` において、暗号化なしの Telnet 接続を拒否して SSH のみ許可するコマンドはどれですか？",
        choices: [
          "transport input all",
          "transport input ssh",
          "no login local",
          "ip ssh deny telnet",
        ],
        correctIndex: 1,
        explanation:
          "`transport input ssh` を設定することで、VTY 回線での着信プロトコルを SSH (TCP 22) のみに限定し Telnet (TCP 23) を禁止できます。",
      },
    ],
  },
  {
    id: "stage2/l2-security-wireless",
    stage: "stage-2",
    slug: "l2-security-wireless",
    title: "L2セキュリティと無線LAN（Port Security・DHCP Snooping・WLC/WPA3）",
    summary: "スイッチポートレベルでの不正PC接続防御（Port Security・DHCP Snooping・DAI）と、法人無線LAN（WLC/CAPWAP・WPA2/WPA3）のアーキテクチャを学びます。",
    estimatedMinutes: 25,
    diagramVariant: "l2-security-wireless",
    glossary: [
      {
        term: "Port Security",
        shortDef: "スイッチの各ポートで接続を許可する MAC アドレス数やアドレス自体を制限する機能。",
        detail: "違反時の動作として `shutdown` (err-disabled 状態), `restrict` (破棄+警告カウント), `protect` (無言破棄) の3モードがあり、既定は `shutdown` です。",
        layer: "L2 (Security)",
      },
      {
        term: "DHCP Snooping",
        shortDef: "偽DHCPサーバ（不正GW誘導）を防ぐため、Switch ポートを Trusted / Untrusted に分ける防御機能。",
        detail: "アクセスポートを Untrusted（デフォルト）にすることで、端末側からの不正な DHCP Offer/Ack を遮断し、正当なリース記録（Binding Table）を生成します。",
        layer: "L2 (Security)",
      },
      {
        term: "DAI (Dynamic ARP Inspection)",
        shortDef: "DHCP Snooping の Binding Table と照合し、ARP スプーフィング攻撃を遮断する機能。",
        detail: "IPとMACの対応が Binding Table にない不正 ARP パケットを Untrusted ポートで即座にドロップします。",
        layer: "L2 (Security)",
      },
      {
        term: "CAPWAP & WLC",
        shortDef: "複数の軽量APを WLC（無線コントローラ）から一括集中管理するためのトンネリング規格。",
        detail: "管理制御（UDP 5246）とユーザデータ転送（UDP 5247）をカプセル化し、電波出力調整・SSID設定・WPA2/WPA3認証を全APへ自動展開します。",
        layer: "L2 (Wireless)",
      },
    ],
    beginnerMode: {
      analogyTitle: "会議室のLANポートやWi-Fiに「入館証チェック」を付ける",
      analogyText:
        "誰でも空いているLANケーブルを挿せば社内ネットワークに入れる環境や、偽ルータ（偽DHCPサーバ）を置かれたら通信を盗み見られる環境は危険です。スイッチ自身が『登録済みのPCか』『本物のDHCP・ARPか』を検証するのが L2 セキュリティです。",
      keyPoints: [
        {
          title: "3点セットで守る L2 セキュリティ",
          body: "① **Port Security** で無断のHUBやPC増設を止め、② **DHCP Snooping** で偽DHCPサーバを防ぎ、③ **DAI** で同一LAN内のARPなりすまし（中間者攻撃）をブロックします。",
        },
        {
          title: "法人無線LANは「軽量AP＋WLC集中管理」が基本",
          body: "家庭用Wi-Fiルータを何十台も個別に設定変更するのは破綻します。オフィスでは **WLC** に全APを CAPWAP トンネルで収容し、セキュリティも企業認証 **WPA2/WPA3-Enterprise (802.1X)** を用います。",
        },
      ],
      steps: [
        "端末を繋ぐ Access ポートへ `switchport port-security` を設定し最大 MAC 数を制限する",
        "`ip dhcp snooping` を有効化し、正規 DHCP サーバ繋がるアップリンクのみ `ip dhcp snooping trust` とする",
        "`ip arp inspection vlan <id>` (DAI) を有効化して不正 ARP 応答を自動ドロップする",
      ],
    },
    examMode: {
      examTips: [
        "Port Security 違反時の3アクション（`protect` / `restrict` / `shutdown`）における SNMP/Syslog 通知有無・ポート状態の差は CCNA 最頻出表です。",
        "DHCP Snooping においてデフォルト全ポートが Untrusted であり、正規 DHCP サーバ方向とスイッチ間トランクだけ `trust` を付ける点を必ず押さえてください。",
      ],
      referenceTable: {
        headers: ["違反モード / 機能", "パケット処理", "エラーログ / SNMP", "ポート状態"],
        rows: [
          ["Port-Security: shutdown (既定)", "破棄", "カウント＋Syslog/Trap送信", "err-disabled (停止)"],
          ["Port-Security: restrict", "破棄", "カウント＋Syslog/Trap送信", "up のまま維持"],
          ["Port-Security: protect", "破棄", "ログ・カウント無し", "up のまま維持"],
          ["WPA2 vs WPA3 (Personal)", "暗号化規格", "WPA2: AES-CCMP (PSK) / WPA3: SAE + GCMP", "SAE で辞書攻撃耐性強化"],
        ],
      },
      commandBlocks: [
        {
          title: "Port Security + DHCP Snooping + DAI 設定例",
          code: `SW1(config)# interface Fa0/1
SW1(config-if)# switchport mode access
SW1(config-if)# switchport port-security
SW1(config-if)# switchport port-security maximum 2
SW1(config-if)# switchport port-security mac-address sticky
SW1(config)# ip dhcp snooping
SW1(config)# ip dhcp snooping vlan 10
SW1(config)# interface Gig0/1
SW1(config-if)# ip dhcp snooping trust
SW1(config)# ip arp inspection vlan 10`,
          note: "アップリンク側 (`Gig0/1`) に `trust` を入れ忘れると、正規の DHCP サーバからの IP 配布まで遮断されてしまうので注意が必要です。",
        },
      ],
      pitfalls: [
        "DHCP Snooping を有効にした後、上位ルータ（DHCP サーバ）側のポートへ `ip dhcp snooping trust` を設定し忘れる障害が現場で非常に多く発生します。",
        "`shutdown` 違反モードで `err-disabled` になったポートを復旧するには、原因を取り除いた後 `shutdown` → `no shutdown`（または `errdisable recovery`）が必要です。",
      ],
    },
    quiz: [
      {
        id: "q-l2sec-1",
        question: "Port Security の違反アクションにおいて、不正MACフレームを破棄し、違反カウンターを増加させてSyslog通知も行うが、ポート自体は err-disabled（ダウン）にしないモードはどれですか？",
        choices: ["protect", "restrict", "shutdown", "disable"],
        correctIndex: 1,
        explanation:
          "`restrict` は通信を遮断しつつログ通知とカウンター記録を行いポートは稼働維持します。`protect` はログ通知なし、`shutdown` は err-disabled に落とします。",
      },
      {
        id: "q-l2sec-2",
        question: "Cisco スイッチで DHCP Snooping を有効化した直後、すべてのクライアントが IP アドレスを取得できなくなりました。最初に疑うべき設定漏れはどれですか？",
        choices: [
          "クライアント側アクセスポートに trust 設定が抜けている",
          "DHCP サーバが接続されたアップリンクポートに `ip dhcp snooping trust` が抜けている",
          "VLAN 1 の STP プライオリティが 32768 のままである",
          "Port Security の maximum が 1 である",
        ],
        correctIndex: 1,
        explanation:
          "DHCP Snooping 有効化時は既定で全ポートが Untrusted になるため、正規の DHCP サーバが居る側のポートに `trust` を付けないと Offer/Ack が破棄されます。",
      },
      {
        id: "q-l2sec-3",
        question: "集中型無線LAN構成において、軽量AP (Lightweight AP) と WLC の間で制御トラフィックおよびデータトラフィックをトンネル伝送するプロトコルはどれですか？",
        choices: ["CAPWAP (UDP 5246/5247)", "HSRP (UDP 1985)", "802.1Q Trunk", "RADIUS (UDP 1812)"],
        correctIndex: 0,
        explanation:
          "CAPWAP は WLC と軽量 AP 間で制御チャネル (UDP 5246) とデータチャネル (UDP 5247) を確立する標準プロトコルです。",
      },
    ],
  },
];
