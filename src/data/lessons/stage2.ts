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
      href: "/labs/cli",
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
      href: "/labs/troubleshoot",
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
      href: "/tools",
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
      href: "/labs/cli",
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
];
