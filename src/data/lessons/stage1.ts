import type { LessonArticle } from "./types";

export const STAGE1_LESSONS: LessonArticle[] = [
  {
    id: "stage1/lan-wan",
    stage: "stage-1",
    slug: "lan-wan",
    title: "LAN / WAN とネットワークの全体像",
    summary:
      "社内ネットワークとインターネットの境界、ルータ・スイッチの役割を図解で学びます。",
    estimatedMinutes: 10,
    diagramVariant: "lan-wan",
    relatedHref: {
      href: "/labs/cli?scenario=cli-first-steps",
      label: "超入門CLIラボでルータとの疎通を体験する",
    },
    glossary: [
      {
        term: "LAN",
        shortDef: "社内や家庭など限定された範囲のネットワーク",
        detail:
          "Local Area Network の略。オフィス・自宅・データセンターの1フロアなど、自社や個人で管理・敷設できる閉域ネットワークです。",
        layer: "全体",
      },
      {
        term: "WAN",
        shortDef: "拠点間やインターネットを結ぶ広域ネットワーク",
        detail:
          "Wide Area Network の略。東京本社と大阪支社を通信事業者の回線で結ぶなど、地理的に離れた拠点間をつなぎます。",
        layer: "全体",
      },
      {
        term: "スイッチ",
        shortDef: "同じLAN内のPCやサーバ同士をつなぐ集線装置",
        detail:
          "L2スイッチは MAC アドレスを見て、同一ネットワーク内の正しいポートへフレームを転送します。",
        layer: "L2",
      },
      {
        term: "ルータ",
        shortDef: "異なるネットワーク (LANとWAN等) を中継する機器",
        detail:
          "宛先 IP アドレスとルーティングテーブルに基づき、別のネットワークへの最適な経路を選びます。",
        layer: "L3",
      },
      {
        term: "デフォルトゲートウェイ",
        shortDef: "別のネットワークへ出る際の「玄関口」となるルータのIP",
        detail:
          "PCが自分のLANの外（他拠点やインターネット）へ通信するとき、最初にデータを渡す出口のルータアドレスです。",
        layer: "L3",
      },
      {
        term: "サブネット",
        shortDef: "ルータやスイッチで区切られた1つのネットワーク単位",
        detail:
          "同じLANに所属する機器のグループのこと。同じサブネット同士ならルータを通さず直接会話できます。",
        layer: "L3",
      },
      {
        term: "IPアドレス",
        shortDef: "ネットワーク上の機器に割り当てる論理的な住所",
        detail:
          "192.168.10.1 のような数字の並びで、どのネットワークのどの機器かを識別します。",
        layer: "L3",
      },
      {
        term: "MACアドレス",
        shortDef: "LANカードなどの機器に工場出荷時から刻まれた固有番号",
        detail:
          "同じLANの中で隣の機器へデータを届けるときに使われる物理的な識別番号です。",
        layer: "L2",
      },
      {
        term: "フレーム",
        shortDef: "L2（LAN内）でやり取りされるデータの単位",
        detail:
          "宛先・送信元のMACアドレスなどをヘッダとして付けた、LAN内の通信パッケージです。",
        layer: "L2",
      },
    ],
    beginnerMode: {
      analogyTitle: "「建物内の内線」が LAN、「都市間の高速道路」が WAN",
      analogyText:
        "ネットワークは郵便と道路に似ています。同じオフィスビル内のやり取りは自分でルールを決められる LAN で、フロア内の配線をまとめるのが スイッチ です。一方、別の支社やインターネットへ荷物を送り出す出口の関所が ルータ であり、拠点同士を結ぶ長距離道路が WAN にあたります。",
      keyPoints: [
        {
          title: "スイッチは「同じ部屋（同一サブネット）」担当",
          body: "PC、プリンタ、社内サーバをケーブルで束ね、同じ LAN の中でデータを高速に受け渡します。",
        },
        {
          title: "ルータは「別の世界への玄関口（デフォルトゲートウェイ）」",
          body: "LAN と WAN、あるいは部署ごとのネットワーク境界に立ち、宛先に応じた配送先を判断します。",
        },
        {
          title: "なぜ分ける必要があるのか？",
          body: "全社員の通信が1つの LAN に混ざると不要な一斉通信で混雑するため、ルータで境界を作って整理します。",
        },
      ],
      steps: [
        "PC から社内サーバ（同じ LAN 内）へ送る場合は、スイッチ経由で直接届きます。",
        "インターネットや他拠点（WAN 経由）へ送る場合は、まず玄関口である ルータ（デフォルトゲートウェイ）へ渡します。",
        "ルータが宛先ネットワークを確認し、次のルータや目的地の LAN へ送り届けます。",
      ],
    },
    examMode: {
      examTips: [
        "SOHO / 企業網における L2スイッチ（同一ブロードキャストドメイン内転送）とルータ（ブロードキャストドメイン分割・L3経路制御）の役割差は頻出です。",
        "デフォルトゲートウェイは「異なるサブネットへ送る際の出口となるルータのインターフェースIP」と正確に押さえましょう。",
      ],
      referenceTable: {
        headers: ["区分", "主なスコープ", "中核機器", "アドレス基準", "ブロードキャスト"],
        rows: [
          ["LAN", "同一フロア / 建物", "L2スイッチ", "MACアドレス (L2)", "同一ドメイン内に届く"],
          ["WAN", "拠点間 / ISP接続", "ルータ", "IPアドレス (L3)", "ルータを越えて届かない"],
        ],
      },
      commandBlocks: [
        {
          title: "ルータのインターフェース状態確認 (LAN/WAN境界確認)",
          code: "R1# show ip interface brief\nInterface              IP-Address      OK? Method Status                Protocol\nGig0/0                 192.168.10.1    YES manual up                    up\nGig0/1                 10.0.0.1        YES manual up                    up",
          note: "Gig0/0 が社内 LAN 側ゲートウェイ、Gig0/1 が対向拠点への WAN リンク側といった境界構成を読み取れます。",
        },
      ],
      pitfalls: [
        "家庭用Wi-Fiルータは「ルータ＋L2スイッチ＋無線AP」の複合機であるため、役割の切り分けを混同しやすい点に注意。",
        "PCにデフォルトゲートウェイが未設定だと、同一 LAN 内とは通信できても他ネットワーク（WAN先）へ一切出られません。",
      ],
    },
    quiz: [
      {
        id: "q-lan-1",
        question: "異なるネットワーク（LAN と WAN）の境界で、IPアドレスを元に経路選択を行う機器はどれですか？",
        choices: ["L2スイッチ", "ルータ", "リピータハブ", "パッチパネル"],
        correctIndex: 1,
        explanation:
          "ルータは L3（ネットワーク層）で動作し、異なるネットワーク間で IP パケットをルーティングします。",
      },
      {
        id: "q-lan-2",
        question: "社内 LAN 内で PC 同士が直接データをやり取りする際、経路の中継を担う主役はどれですか？",
        choices: ["DNSサーバ", "スイッチ", "デフォルトゲートウェイ外のISP", "ファイアウォールWAN口"],
        correctIndex: 1,
        explanation:
          "同一 LAN（同一サブネット）内の通信は L2スイッチが MAC アドレスを元に直接フレームを転送します。",
      },
    ],
  },
  {
    id: "stage1/osi-tcpip",
    stage: "stage-1",
    slug: "osi-tcpip",
    title: "OSI参照モデル & TCP/IP カプセル化",
    summary:
      "7階層・4階層の役割分担と、データにヘッダが付与・解除される流れを追跡します。",
    estimatedMinutes: 15,
    diagramVariant: "osi-tcpip",
    glossary: [
      {
        term: "OSI参照モデル",
        shortDef: "通信の役割を7階層に整理した標準モデル",
        detail:
          "物理層(L1)〜アプリケーション層(L7)の7段階に分割して定義されており、障害切り分けや技術議論の共通言語になります。",
        layer: "L1–L7",
      },
      {
        term: "カプセル化",
        shortDef: "上位データに各層のヘッダを順番に付与して送信すること",
        detail:
          "アプリケーションデータに TCP/UDPヘッダ（セグメント）、IPヘッダ（パケット）、Ethernetヘッダ（フレーム）を順に包んで送信します。",
        layer: "L2–L7",
      },
      {
        term: "PDU",
        shortDef: "各層で扱うデータの呼び名（セグメント/パケット/フレーム）",
        detail:
          "Protocol Data Unit。L4=セグメント、L3=パケット、L2=フレーム、L1=ビットという名称の使い分けが重要です。",
        layer: "L1–L4",
      },
      {
        term: "ポート番号",
        shortDef: "1台のPC内で「どのアプリ宛てか」を示す番号",
        detail:
          "Webブラウザやメールなど複数アプリが同時に通信しても、ポート番号 (80, 443 等) で正しく振り分けられます。",
        layer: "L4",
      },
      {
        term: "IPアドレス",
        shortDef: "最終目的地まで届けるためのネットワーク上の住所",
        detail:
          "ルータが経路を判断するときに参照する論理アドレスです（例: 192.168.10.1）。",
        layer: "L3",
      },
      {
        term: "MACアドレス",
        shortDef: "同じLAN内の隣の機器へ渡すための固有ハードウェア番号",
        detail:
          "Ethernet フレームに付与され、ケーブルで直結された同じLAN内の機器を識別します。",
        layer: "L2",
      },
      {
        term: "Ethernet",
        shortDef: "有線LANで広く使われるL1/L2の通信規格",
        detail:
          "LANケーブルや光ファイバ上で MACアドレス を使ってフレームを送受信する標準規格です。",
        layer: "L1–L2",
      },
      {
        term: "TCP",
        shortDef: "再送や順序確認を行い確実に届ける通信方式",
        detail:
          "Web閲覧やファイル転送など、データが欠けては困る通信で使われます。",
        layer: "L4",
      },
      {
        term: "UDP",
        shortDef: "確認を省いて高速・低遅延にデータを送る通信方式",
        detail:
          "音声通話、動画配信、DNS問い合わせなど速さを重視する通信で使われます。",
        layer: "L4",
      },
    ],
    beginnerMode: {
      analogyTitle: "手紙を「封筒」に入れて「段ボール」に詰めるリレー",
      analogyText:
        "OSI参照モデル は通信の分業表です。送る側は書いた手紙（データ）を内袋（ポート番号付き＝L4）、宛先住所入りの封筒（IPアドレス付き＝L3）、トラック配送伝票（MACアドレス付き＝L2）と順番に重ねて梱包します。これが カプセル化 です。受け取った側は外側から1枚ずつ剥がして中身を取り出します。",
      keyPoints: [
        {
          title: "L1・L2 は「隣の機器まで運ぶ物理と隣人ルール」",
          body: "ケーブルの電気/光信号 (L1) と、同じ LAN 内の隣の機器までの受け渡し (L2) を担当します。",
        },
        {
          title: "L3 は「最終目的地までの住所案内」",
          body: "IP アドレスを使い、ルータを何度またいでも迷わず宛先ネットワークへ導きます。",
        },
        {
          title: "L4〜L7 は「アプリ同士の会話と品質保証」",
          body: "どのアプリ宛てか（ポート番号）や再送制御 (L4)、HTTP/DNS などの手順 (L7) を担当します。",
        },
      ],
      steps: [
        "送信元でアプリデータを作成し、L4 (TCP/UDP) がポート番号ヘッダを付けて「セグメント」にします。",
        "L3 (IP) が送信元/宛先 IP ヘッダを付けて「パケット」にします。",
        "L2 (Ethernet) が MAC ヘッダとFCSトレーラを付けて「フレーム」にし、L1 が電気・光信号のビット列として送出します。",
      ],
    },
    examMode: {
      examTips: [
        "OSI 7層と TCP/IP 4層の対応、および各層の PDU 名称（L4=セグメント、L3=パケット、L2=フレーム、L1=ビット）は必ず即答できるようにしてください。",
        "L2スイッチは L2 ヘッダ（MAC）、ルータは L3 ヘッダ（IP）を参照し、フレームはホップごとに書き換わるが IP アドレス（NAT除く）は終端まで維持されます。",
      ],
      referenceTable: {
        headers: ["OSI層", "名称", "TCP/IP層", "PDU", "代表プロトコル / 機器"],
        rows: [
          ["L7–L5", "アプリ / プレゼン / セッション", "アプリケーション層", "データ", "HTTP, DNS, SSH"],
          ["L4", "トランスポート層", "トランスポート層", "セグメント", "TCP, UDP (ポート番号)"],
          ["L3", "ネットワーク層", "インターネット層", "パケット", "IP, ICMP / ルータ"],
          ["L2", "データリンク層", "ネットワークインタフェース層", "フレーム", "Ethernet / L2スイッチ"],
          ["L1", "物理層", "ネットワークインタフェース層", "ビット", "UTP, 光ファイバ"],
        ],
      },
      commandBlocks: [
        {
          title: "L1/L2 状態と L3 状態を同時に見る定番確認",
          code: "R1# show ip interface brief\n! Status = L1物理状態 (up / administratively down)\n! Protocol = L2データリンク状態 (up / down)",
          note: "Status が up で Protocol が down なら L1 は接続済みで L2（カプセル化やリンクネゴシエーション等）の異常、といった切り分けに使えます。",
        },
      ],
      pitfalls: [
        "「L3ヘッダがルータを通るたびに書き換わる」は誤り。書き換わるのは主に L2 フレームヘッダの送信元/宛先 MAC アドレス（と L3 の TTL 減算）です。",
      ],
    },
    quiz: [
      {
        id: "q-osi-1",
        question: "カプセル化の過程で、L3（ネットワーク層）が扱うデータの単位（PDU）の名称はどれですか？",
        choices: ["ビット", "フレーム", "パケット", "セグメント"],
        correctIndex: 2,
        explanation:
          "L1=ビット、L2=フレーム、L3=パケット、L4=セグメント です。",
      },
      {
        id: "q-osi-2",
        question: "送信側のPCから受信側のWebサーバへパケットが届く際、途中のルータを越えるたびに付け替えられるアドレスはどれですか？",
        choices: ["宛先IPアドレス", "送信元・宛先MACアドレス", "宛先ポート番号", "ドメイン名"],
        correctIndex: 1,
        explanation:
          "MACアドレス（L2）は同一リンク内の次ホップに届けるための住所なので、ルータを通過するたびに新しいL2ヘッダへ付け替えられます。",
      },
    ],
  },
  {
    id: "stage1/ip-mac",
    stage: "stage-1",
    slug: "ip-mac",
    title: "IPアドレスとMACアドレス・ARPの仕組み",
    summary:
      "L3の論理住所とL2の物理住所がARPによってどう結びつくかを実例で理解します。",
    estimatedMinutes: 15,
    diagramVariant: "ip-mac",
    relatedHref: {
      href: "/tools?tab=wireshark",
      label: "Wireshark風ドリルでARP失敗パケットを見る",
    },
    glossary: [
      {
        term: "IPアドレス",
        shortDef: "ネットワーク上の論理的な住所（L3）",
        detail:
          "IPv4 では 32bit を8bitずつ4つに区切って 192.168.10.1 のように表記します。ネットワークの移動に応じて割り当て直せます。",
        layer: "L3",
      },
      {
        term: "MACアドレス",
        shortDef: "ネットワーク機器(NIC)固有の物理アドレス（L2）",
        detail:
          "48bit（16進数12桁、例: 00:11:22:33:44:55）で表され、前半24bitがベンダ識別子(OUI)、後半24bitが固有番号です。",
        layer: "L2",
      },
      {
        term: "ARP",
        shortDef: "IPアドレスからMACアドレスを調べる仕組み",
        detail:
          "Address Resolution Protocol。同一LAN内にブロードキャストで『このIPのMACは誰？』と尋ね、ユニキャストで応答を受け取り ARPテーブル にキャッシュします。",
        layer: "L2/L3",
      },
      {
        term: "デフォルトゲートウェイ",
        shortDef: "別ネットワークへ通信するときの出口となるルータIP",
        detail:
          "宛先が別サブネットのとき、PCは直接相手のMACを調べられないため、まずデフォルトゲートウェイのMACをARPで調べます。",
        layer: "L3",
      },
      {
        term: "サブネット",
        shortDef: "同じLANとして区切られたIPアドレスの範囲",
        detail:
          "ARPの問い合わせは同じサブネット内にだけ届くため、サブネット外へはルータが中継します。",
        layer: "L3",
      },
      {
        term: "ブロードキャスト",
        shortDef: "同じLAN内のすべての機器へ一斉に送信する通信",
        detail:
          "宛先MACアドレスに FF:FF:FF:FF:FF:FF を指定し、LAN内の全機器に『誰宛てか』を問いかけます。",
        layer: "L2",
      },
      {
        term: "ユニキャスト",
        shortDef: "特定の1台の機器だけに向けて送信する1対1の通信",
        detail:
          "ARPの返答(Reply)や通常のWeb通信など、相手が特定できているときに使います。",
        layer: "L2/L3",
      },
      {
        term: "ARPテーブル",
        shortDef: "調べた「IPアドレス ↔ MACアドレス」の対応表キャッシュ",
        detail:
          "毎回ブロードキャストしなくて済むよう、各機器のメモリに一定時間記憶される一覧表です（`show arp` 等で確認できます）。",
        layer: "L2/L3",
      },
    ],
    beginnerMode: {
      analogyTitle: "「住民票の住所 (IP)」と「本人の指紋・名札 (MAC)」",
      analogyText:
        "引っ越せば変わる住所が IPアドレス で、生まれた時からカードに刻まれている固有IDが MACアドレス です。データを同じ LAN 内の相手に渡すには、最終的な MACアドレス が分からないと Ethernet フレームを作れません。そこで「192.168.10.1 の人、名乗り出てください！」と部屋中に声をかけるのが ARP です。",
      keyPoints: [
        {
          title: "通信には IP と MAC の両方が必要",
          body: "アプリやルーティングは IPアドレス を使いますが、実際のケーブル送出時は MACアドレス 宛てのフレームに包みます。",
        },
        {
          title: "別ネットワーク宛ては「ゲートウェイの MAC」を ARP で引く",
          body: "宛先 IP が Google など遠い場所でも、PC はまず玄関口であるルータ（デフォルトゲートウェイ）の IP に対して ARP を投げます。",
        },
        {
          title: "一度聞いた相手は ARPキャッシュ に記憶",
          body: "毎回全員に聞き直すと非効率なため、一定時間 ARPテーブル に保存して再利用します。",
        },
      ],
      steps: [
        "送信元 PC は宛先 IP が同じサブネットか、ゲートウェイ越えかを判定し、次ホップ IP を決めます。",
        "自分の ARPテーブル を確認し、次ホップ IP の MACアドレス が無ければ ARP Request（ブロードキャスト FF:FF:FF:FF:FF:FF）を送信します。",
        "該当機器が自分の MACアドレス を ARP Reply（ユニキャスト）で返し、双方がテーブルを更新した後にデータ通信が始まります。",
      ],
    },
    examMode: {
      examTips: [
        "ARP Request は宛先 MAC = FF:FF:FF:FF:FF:FF のブロードキャスト、ARP Reply はユニキャストで返る点が出題定番です。",
        "他サブネット宛てのフレームでも、L2 宛先 MAC は「デフォルトゲートウェイの MAC」、L3 宛先 IP は「最終宛先の IP」になります。",
      ],
      referenceTable: {
        headers: ["項目", "IPv4アドレス", "MACアドレス"],
        rows: [
          ["OSI階層", "L3 (ネットワーク層)", "L2 (データリンク層)"],
          ["ビット長", "32 bit (10進4オクテット)", "48 bit (16進6バイト)"],
          ["有効範囲", "エンドツーエンド (ルーティング可)", "同一ブロードキャストドメイン内"],
          ["変更可否", "設計により自由に割当変更可", "NIC工場出荷時に焼込み (BIA)"],
        ],
      },
      commandBlocks: [
        {
          title: "ARPテーブル & スイッチMACテーブルの確認",
          code: "R1# show arp\nProtocol  Address          Age (min)  Hardware Addr   Type   Interface\nInternet  192.168.10.10    0          0011.2233.4401  ARPA   Gig0/0\n\nSW1# show mac address-table\nVlan    Mac Address       Type        Ports\n  10    0011.2233.4401    DYNAMIC     Fa0/1",
          note: "ARP は「IP ↔ MAC」、MACテーブルは「MAC ↔ 物理ポート」を紐づけている違いを意識しましょう。",
        },
      ],
      pitfalls: [
        "ARP はブロードキャストを使うため、VLAN が食い違っていたりデフォルトゲートウェイが不通だと ARP Timeout になります。",
      ],
    },
    quiz: [
      {
        id: "q-ipmac-1",
        question: "PC1 (192.168.10.10/24, GW: 192.168.10.1) が別セグメントの Web サーバ (203.0.113.50) へ送信する際、ARP で問い合わせる対象の IP はどれですか？",
        choices: ["203.0.113.50", "192.168.10.1", "255.255.255.255", "127.0.0.1"],
        correctIndex: 1,
        explanation:
          "別サブネット宛てのパケットはデフォルトゲートウェイへ渡す必要があるため、ゲートウェイ IP (192.168.10.1) の MAC を ARP で解決します。",
      },
      {
        id: "q-ipmac-2",
        question: "ARP Request と ARP Reply の通信形態の正しい組み合わせはどれですか？",
        choices: [
          "Request: ユニキャスト / Reply: ブロードキャスト",
          "Request: ブロードキャスト / Reply: ブロードキャスト",
          "Request: ブロードキャスト / Reply: ユニキャスト",
          "Request: マルチキャスト / Reply: ユニキャスト",
        ],
        correctIndex: 2,
        explanation:
          "問い合わせ時は相手MACが不明なためブロードキャスト、応答時は送信元MACが分かるためユニキャストで返答します。",
      },
    ],
  },
  {
    id: "stage1/subnetting",
    stage: "stage-1",
    slug: "subnetting",
    title: "サブネットマスクとCIDR計算の完全攻略",
    summary:
      "2進数32bitでネットワーク部とホスト部を切り分ける計算手法を身につけます。",
    estimatedMinutes: 20,
    diagramVariant: "subnetting",
    relatedHref: {
      href: "/tools?tab=subnet",
      label: "サブネット計算機＆ランダム出題ドリルを開く",
    },
    glossary: [
      {
        term: "サブネットマスク",
        shortDef: "IPのどこまでがネットワーク部でどこからがホスト部かを示す32bit値",
        detail:
          "2進数で連続する1の部分がネットワーク部、連続する0の部分がホスト部です（例: 255.255.255.0 = 上位24bitが1）。",
        layer: "L3",
      },
      {
        term: "CIDR",
        shortDef: "プレフィックス長 (/24 等) でマスクを表現する記法",
        detail:
          "Classless Inter-Domain Routing。クラスA/B/Cの固定枠にとらわれず、/26 や /28 といった柔軟なサイズでネットワークを分割できます。",
        layer: "L3",
      },
      {
        term: "ブロードキャストアドレス",
        shortDef: "同一サブネット内の全ホストへ一斉送信するための予約アドレス",
        detail:
          "ホスト部のビットをすべて 1 にしたアドレス。通常ホストに割り当てることはできません。",
        layer: "L3",
      },
      {
        term: "IPアドレス",
        shortDef: "32bit（0と1が32桁）で表されるIPv4の論理住所",
        detail:
          "人間が読みやすいように8bitずつ4つに区切って10進数で表記します。",
        layer: "L3",
      },
      {
        term: "ネットワークアドレス",
        shortDef: "サブネット自体を表す先頭の代表アドレス（ホスト部全0）",
        detail:
          "町全体の表札にあたるアドレスで、ルータの経路表にもこのアドレスが登録されます。PCに割り当てることはできません。",
        layer: "L3",
      },
      {
        term: "プレフィックス長",
        shortDef: "ネットワーク部が先頭から何ビットあるかを示す `/24` などの数字",
        detail:
          "`/24` は先頭24bitがネットワーク部（255.255.255.0）、残り8bitがホスト部であることを表します。",
        layer: "L3",
      },
      {
        term: "オクテット",
        shortDef: "IPv4アドレスをドットで区切った8bitごとの塊",
        detail:
          "32bit を 8bit × 4 個に分けたそれぞれを第1〜第4オクテットと呼び、各値は 0〜255 になります。",
        layer: "L3",
      },
    ],
    beginnerMode: {
      analogyTitle: "「市外局番（ネットワーク部）」と「個人宅番号（ホスト部）」",
      analogyText:
        "32桁の2進数で書かれた IPアドレス のどこまでが「市外局番（同じ町内）」で、どこからが「各家庭の番号」かを切る境界線が サブネットマスク です。たとえば /24 は左から24ビット目までが町名で、残り8ビットが家庭番号になります。",
      keyPoints: [
        {
          title: "先頭の「すべて0」と末尾の「すべて1」は予約済み",
          body: "ホスト部がすべて0のアドレスは「ネットワークアドレス（町全体の表札）」、すべて1は「ブロードキャストアドレス（町内放送用）」として使われ、PC等には振れません。",
        },
        {
          title: "使えるホスト数 = 2^(ホストビット数) - 2",
          body: "たとえば /26 はホスト部が 32 - 26 = 6 bit なので、2^6 - 2 = 62 台のホストを設定できます。",
        },
        {
          title: "同一サブネット判定は「ビット論理積 (AND)」",
          body: "2つのIPが同じ町内かどうかは、それぞれ サブネットマスク と AND 演算した結果（ネットワークアドレス）が一致するかで判定します。",
        },
      ],
      steps: [
        "プレフィックス長 (/N) から、ネットワーク部のビット数 N とホスト部のビット数 (32 - N) を確認します。",
        "境界があるオクテットに注目し、ブロックサイズ (256 - マスク値) で区切ると素早く範囲を特定できます。",
        "ネットワークアドレス + 1 が先頭ホスト、ブロードキャストアドレス - 1 が末尾ホストになります。",
      ],
    },
    examMode: {
      examTips: [
        "/24〜/30 のマスク値・ブロックサイズ・利用可能ホスト数は暗算できると CCNA 本番で圧倒的に時間短縮できます。",
        "「ホストに割り当て可能な IP か？」を問う問題では、必ずネットワークアドレスとブロードキャストアドレスを除外して判定してください。",
      ],
      referenceTable: {
        headers: ["CIDR", "サブネットマスク", "第4オクテット増分", "総アドレス数", "利用可能ホスト数"],
        rows: [
          ["/24", "255.255.255.0", "256 (1サブネット)", "256", "254"],
          ["/25", "255.255.255.128", "128", "128", "126"],
          ["/26", "255.255.255.192", "64", "64", "62"],
          ["/27", "255.255.255.224", "32", "32", "30"],
          ["/28", "255.255.255.240", "16", "16", "14"],
          ["/30", "255.255.255.252", "4", "4", "2 (ルータ間WAN用)"],
        ],
      },
      commandBlocks: [
        {
          title: "WANリンク (/30) の設定例",
          code: "R1(config-if)# ip address 10.0.0.1 255.255.255.252\nR2(config-if)# ip address 10.0.0.2 255.255.255.252",
          note: "10.0.0.0/30 の範囲は .0 (NW), .1 (Host1), .2 (Host2), .3 (BC) なので .1 と .2 だけが割り当て可能です。",
        },
      ],
      pitfalls: [
        "192.168.1.64/26 のような問題で .64 をホストに振ってしまうミス（.64 は2つ目の /26 サブネットのネットワークアドレスです）。",
      ],
    },
    quiz: [
      {
        id: "q-sub-1",
        question: "IPv4 アドレス `192.168.10.130/26` が所属するネットワークアドレスはどれですか？",
        choices: ["192.168.10.0", "192.168.10.64", "192.168.10.128", "192.168.10.192"],
        correctIndex: 2,
        explanation:
          "/26 (255.255.255.192) のブロックサイズは 256 - 192 = 64 です。0, 64, 128, 192 の境界のうち 130 が入るのは 128〜191 なのでネットワークアドレスは 192.168.10.128 です。",
      },
      {
        id: "q-sub-2",
        question: "50台のPCを1つのサブネットに収容したい場合、無駄が最も少ないプレフィックス長はどれですか？",
        choices: ["/25", "/26", "/27", "/28"],
        correctIndex: 1,
        explanation:
          "/27 は最大 30 台で不足します。/26 は 2^6 - 2 = 62 台を収容できる最小のプレフィックス長です。",
      },
    ],
  },
  {
    id: "stage1/tcp-udp",
    stage: "stage-1",
    slug: "tcp-udp",
    title: "TCP / UDP とポート番号・3ウェイハンドシェイク",
    summary:
      "信頼性重視のTCPと低遅延のUDPの違い、代表的なウェルノウンポートを整理します。",
    estimatedMinutes: 15,
    diagramVariant: "tcp-udp",
    relatedHref: {
      href: "/tools?tab=wireshark",
      label: "パケット解析ドリルで TCP RST を調査する",
    },
    glossary: [
      {
        term: "TCP",
        shortDef: "接続確認・再送制御・順序保証を備えた高信頼プロトコル",
        detail:
          "3ウェイハンドシェイクで接続を確立し、シーケンス番号と ACK 応答で欠損データを再送します。Web(HTTP/HTTPS) や SSH 等に使われます。",
        layer: "L4",
      },
      {
        term: "UDP",
        shortDef: "接続確立なしで高速・低遅延に送る軽量プロトコル",
        detail:
          "ヘッダがわずか8バイトで再送制御を行わないため、リアルタイム音声通話・動画・DNS問い合わせ・DHCP などに使われます。",
        layer: "L4",
      },
      {
        term: "ポート番号",
        shortDef: "1台の機器内の「どのアプリか」を識別する16bit番号 (0〜65535)",
        detail:
          "0〜1023 はウェルノウンポート（HTTP:80, HTTPS:443, SSH:22, DNS:53 等）として標準予約されています。",
        layer: "L4",
      },
      {
        term: "3ウェイハンドシェイク",
        shortDef: "TCP通信を開始する前に行う SYN → SYN/ACK → ACK の3往復確認",
        detail:
          "双方が送受信できる状態にあることと初期シーケンス番号を合意してからデータ転送を始めます。",
        layer: "L4",
      },
      {
        term: "エフェメラルポート",
        shortDef: "クライアントが一時的に自動割り当てする送信元ポート番号",
        detail:
          "PCのブラウザがサーバの443番へ繋ぐ際、自分側の受け口として動的に確保する番号（例: 49152〜65535等）です。",
        layer: "L4",
      },
      {
        term: "RST",
        shortDef: "TCP接続を即座に拒否または強制切断するフラグ (Reset)",
        detail:
          "相手サーバのポートが閉じていたり、プログラムが待ち受けていないときに SYN に対して RST+ACK が返ります。",
        layer: "L4",
      },
    ],
    beginnerMode: {
      analogyTitle: "「書留郵便 (TCP)」と「はがき・生中継 (UDP)」",
      analogyText:
        "TCP は「これから送りますね（SYN）」「受け取り準備OKです（SYN-ACK）」「では送ります（ACK）」と互いに確認してから荷物を届け、途中で紛失すれば再送する確実な便です。対して UDP は確認を省いて次々と投げる方式で、1通抜けても今すぐ次の映像が欲しいライブ配信や短発の DNS 問い合わせで活躍します。",
      keyPoints: [
        {
          title: "3ウェイハンドシェイク (SYN → SYN/ACK → ACK)",
          body: "TCP 通信を始める前の挨拶3往復です。相手ポートが閉じていれば RST/ACK が返って即拒否されます。",
        },
        {
          title: "IP は「家まで」、ポート番号は「部屋のどのアプリか」",
          body: "1つのサーバで Web (443) と SSH (22) が同時に動いても、ポート番号で振り分けられます。",
        },
        {
          title: "フロー制御（ウィンドウサイズ）",
          body: "受信側が処理落ちしないよう、TCP は受信可能な空き容量を相手に知らせながら送信量を調整します。",
        },
      ],
      steps: [
        "クライアントは一時的なエフェメラルポート (例: 51234) を開き、サーバの宛先ポート (例: 443) へ SYN を送ります。",
        "サーバがポートを待ち受け (LISTEN) ていれば SYN+ACK を返します（閉じていれば RST+ACK）。",
        "クライアントが ACK を返すと接続 (ESTABLISHED) となり、実データの送受信が始まります。",
      ],
    },
    examMode: {
      examTips: [
        "主要ウェルノウンポート番号と TCP/UDP の対応は丸暗記必須です（特に DNS=UDP/TCP 53, DHCP=UDP 67/68, TFTP=UDP 69, SSH=TCP 22, Telnet=TCP 23）。",
        "TCP フラグ (SYN, ACK, FIN, RST) の意味は障害解析（RST=接続拒否/強制切断）や ACL・ファイアウォール設問でも問われます。",
      ],
      referenceTable: {
        headers: ["プロトコル", "ポート番号", "L4方式", "用途"],
        rows: [
          ["SSH", "22", "TCP", "暗号化されたリモートCLIログイン"],
          ["Telnet", "23", "TCP", "平文リモートログイン (非推奨)"],
          ["DNS", "53", "UDP / TCP", "名前解決 (通常問い合わせ=UDP, ゾーン転送等=TCP)"],
          ["DHCP", "67 / 68", "UDP", "IPアドレス自動割り当て"],
          ["HTTP / HTTPS", "80 / 443", "TCP", "Web閲覧 / 暗号化Web通信"],
        ],
      },
      commandBlocks: [
        {
          title: "TCP接続失敗 (RST応答) のパケット確認例",
          code: "1  10.0.0.10:51422 -> 192.168.20.10:8080  TCP [SYN] Seq=0\n2  192.168.20.10:8080 -> 10.0.0.10:51422  TCP [RST, ACK] Seq=1 Ack=1",
          note: "SYN に対して RST, ACK が即返っている場合、ネットワーク経路ではなく「サーバ側のポート8080が待ち受けていない（プロセス停止等）」が原因と断定できます。",
        },
      ],
      pitfalls: [
        "「DNS は UDP のみを使う」というひっかけ問題に注意。通常クエリは UDP/53 ですが、512バイト超の応答やゾーン転送には TCP/53 を使います。",
      ],
    },
    quiz: [
      {
        id: "q-tcp-1",
        question: "TCP の 3ウェイハンドシェイクにおける正しいフラグの順番はどれですか？",
        choices: [
          "ACK → SYN → FIN",
          "SYN → SYN/ACK → ACK",
          "SYN → ACK → RST",
          "FIN → ACK → SYN",
        ],
        correctIndex: 1,
        explanation:
          "接続要求(SYN) → 承諾と同期要求(SYN/ACK) → 確認応答(ACK) の3段階でセッションを確立します。",
      },
      {
        id: "q-tcp-2",
        question: "トランスポート層で主に UDP を使用するプロトコルの組み合わせはどれですか？",
        choices: ["SSH と HTTPS", "DHCP と TFTP", "HTTP と Telnet", "SMTP と SSH"],
        correctIndex: 1,
        explanation:
          "DHCP (UDP 67/68) と TFTP (UDP 69) は軽量な UDP を使用します。SSH/HTTPS/HTTP/Telnet/SMTP は TCP です。",
      },
    ],
  },
  {
    id: "stage1/dns-http",
    stage: "stage-1",
    slug: "dns-http",
    title: "DNS名前解決とHTTP/HTTPS通信の流れ",
    summary:
      "URL入力からIPアドレス解決、Webページ表示までの通信シーケンスを解説します。",
    estimatedMinutes: 15,
    diagramVariant: "dns-http",
    relatedHref: {
      href: "/labs/troubleshoot?scenario=ts-dns-failure",
      label: "障害シミュレータでDNS障害チケットに挑戦",
    },
    glossary: [
      {
        term: "DNS",
        shortDef: "ドメイン名を IP アドレスへ変換する仕組み",
        detail:
          "Domain Name System。人間が覚えやすいホスト名 (intranet.local 等) と、通信に使う IPv4/IPv6 アドレスを対応づけます。",
        layer: "L7",
      },
      {
        term: "Aレコード",
        shortDef: "ホスト名と IPv4 アドレスを紐づける DNS レコード",
        detail:
          "IPv6 の場合は AAAA レコード、別名転送は CNAME レコードが使われます。",
        layer: "L7",
      },
      {
        term: "HTTP / HTTPS",
        shortDef: "Web ブラウザとサーバ間でHTML等を取得するプロトコル",
        detail:
          "HTTPS は HTTP を TLS で暗号化した通信です。ステータスコード 200 (成功)、404 (Not Found)、500 (サーバエラー) 等を返します。",
        layer: "L7",
      },
      {
        term: "IPアドレス",
        shortDef: "通信相手を特定するためのネットワーク上の数字の住所",
        detail:
          "ブラウザは人間が入力したURLのホスト名を DNS で IPアドレス に変換してから通信します。",
        layer: "L3",
      },
      {
        term: "TLS",
        shortDef: "HTTPS 通信の盗聴・改ざん・なりすましを防ぐ暗号化プロトコル",
        detail:
          "Transport Layer Security。サーバ証明書の確認と暗号鍵の交換を行って安全な通信路を作ります。",
        layer: "L5–L6",
      },
      {
        term: "NXDOMAIN",
        shortDef: "問い合わせたドメイン名がDNSに存在しないことを示す応答",
        detail:
          "Non-Existent Domain。DNSサーバへ通信自体は届いているが、該当レコードが未登録またはホスト名誤りのときに返ります。",
        layer: "L7",
      },
    ],
    beginnerMode: {
      analogyTitle: "「電話帳 (DNS)」で番号を引いてから「お店 (HTTP/HTTPS)」へ電話する",
      analogyText:
        "ブラウザに URL を打ち込んでも、インターネットの仕組み自体は文字の名前ではなく IPアドレス しか理解できません。そこで PC はまず電話帳係である DNS サーバへ「intranet.local の番号は何番？」と尋ねます。番号が返ってきて初めて、Web サーバへの HTTP/HTTPS 通信が始まります。",
      keyPoints: [
        {
          title: "「IP直打ちは繋がるが URL が開かない」は DNS 障害の鉄板サイン",
          body: "IP直打ちで疎通できるなら L1〜L3 は正常であり、DNS サーバ設定や名前解決経路を疑うのが実務の基本です。",
        },
        {
          title: "NXDOMAIN は「DNSサーバまでは届いたが登録が無かった」応答",
          body: "DNS サーバに到達できない（タイムアウト）と、到達できたがレコード不在（NXDOMAIN）は明確に原因が異なります。",
        },
        {
          title: "HTTPS では TCP 接続の直後に TLS ハンドシェイクが入る",
          body: "暗号化鍵の交換とサーバ証明書の検証を行ってから安全な HTTP 通信を実行します。",
        },
      ],
      steps: [
        "クライアントは自分のキャッシュや設定された DNS サーバに対し、対象ホスト名の Aレコード を問い合わせます。",
        "DNS サーバから目的の IP アドレスが返ると、TCP 3ウェイハンドシェイク（443番または80番ポート）を確立します。",
        "TLS（HTTPSの場合）と HTTP GET リクエストを送り、Web ページを受け取ります。",
      ],
    },
    examMode: {
      examTips: [
        "名前解決トラブルの切り分けツール (`nslookup` / `dig`) の出力から「DNS Unreachable」か「NXDOMAIN」かを読み解く観点が重要です。",
        "HTTP メソッド (GET/POST) や主要ステータスコード (200/301/403/404/503) の意味も基本知識として押さえましょう。",
      ],
      referenceTable: {
        headers: ["DNSレコード", "用途", "具体例"],
        rows: [
          ["A", "ホスト名 → IPv4 アドレス", "intranet.local -> 192.168.20.10"],
          ["AAAA", "ホスト名 → IPv6 アドレス", "www.example.com -> 2001:db8::1"],
          ["CNAME", "別名 (エイリアス) の転送", "portal.local -> web01.local"],
          ["MX", "メール配送先サーバ指定", "example.com -> mail.example.com"],
        ],
      },
      commandBlocks: [
        {
          title: "エンドホストでの DNS 切り分け手順",
          code: "PC-User$ ipconfig\n  DNS Server    : 192.168.20.10\nPC-User$ nslookup intranet.local\nServer:  SRV-Portal-DNS\nAddress:  192.168.20.10\n\nName:    intranet.local\nAddress:  192.168.20.10",
          note: "ipconfig で参照先 DNS を確認し、nslookup で実解決結果とタイムアウト有無を切り分けます。",
        },
      ],
      pitfalls: [
        "DNS サーバ自体への L3 ルートや ACL が通っていない場合も名前解決に失敗するため、DNS サーバ IP への ping も併せて確認しましょう。",
      ],
    },
    quiz: [
      {
        id: "q-dns-1",
        question: "IP アドレス指定の ping は成功するのに、ホスト名指定のアクセスだけ失敗する場合に最も疑うべきものはどれですか？",
        choices: ["LANケーブルの断線", "DNS 設定または名前解決の失敗", "MACアドレス重複", "スイッチのポート速度設定"],
        correctIndex: 1,
        explanation:
          "IP直打ちで疎通するなら L1〜L3 は正常です。名前を IP に変換する L7 の DNS まわりを調査します。",
      },
      {
        id: "q-dns-2",
        question: "`nslookup` を実行した際、DNS サーバへは到達したが指定したホスト名のレコードが登録されていなかった場合のエラーはどれですか？",
        choices: ["ARP Timeout", "TTL Exceeded", "NXDOMAIN", "Link Down"],
        correctIndex: 2,
        explanation:
          "NXDOMAIN (Non-Existent Domain) は「存在しないドメイン名である」と DNS サーバが返答したことを示します。",
      },
    ],
  },
];
