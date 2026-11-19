import type { CloudVpcScenarioDefinition } from "@/lib/network-engine";

export const cloudIgwSgHttpsScenario: CloudVpcScenarioDefinition = {
  id: "cloud-igw-sg-https",
  title: "「Public SubnetのWebサーバに外部からHTTPSアクセスできない」",
  difficulty: "中級",
  description:
    "Public Subnet に配置した EC2 Webサーバ (`web-01`) へインターネットから HTTPS (TCP 443) でアクセスしようとしても繋がりません。Route Table と Security Group の設定を見直して復旧してください（Security Group のステートフル挙動にも注目してください）。",
  ticketSymptom:
    "【障害報告】Elastic IP `54.238.10.5` を付与して nginx (TCP 443) を起動済みですが、社外クライアントから `https://54.238.10.5` がタイムアウトします。VPC の Route Table と `sg-web` を調査してください。",
  initialVpc: {
    vpcId: "vpc-prod",
    vpcName: "Prod-VPC",
    cidrBlock: "10.0.0.0/16",
    igwId: "igw-main",
    subnets: {
      "sub-pub-a": {
        id: "sub-pub-a",
        name: "Public-Subnet-A",
        cidr: "10.0.1.0/24",
        availabilityZone: "ap-northeast-1a",
        type: "public",
        routeTableId: "rt-public",
        naclId: "acl-public",
      },
    },
    routeTables: {
      "rt-public": {
        id: "rt-public",
        name: "rtb-public",
        routes: [
          {
            destinationCidr: "10.0.0.0/16",
            targetType: "local",
            targetId: "local",
          },
        ],
      },
    },
    securityGroups: {
      "sg-web": {
        id: "sg-web",
        name: "sg-web-https",
        description: "Webサーバ用セキュリティグループ",
        rules: [
          {
            id: "sg-rule-ssh",
            direction: "inbound",
            protocol: "tcp",
            fromPort: 22,
            toPort: 22,
            cidr: "203.0.113.0/24",
            description: "Bastion/Admin SSH",
          },
        ],
      },
    },
    nacls: {
      "acl-public": {
        id: "acl-public",
        name: "nacl-public-default",
        rules: [
          {
            ruleNumber: 100,
            direction: "inbound",
            protocol: "all",
            fromPort: 0,
            toPort: 65535,
            cidr: "0.0.0.0/0",
            action: "ALLOW",
          },
          {
            ruleNumber: 100,
            direction: "outbound",
            protocol: "all",
            fromPort: 0,
            toPort: 65535,
            cidr: "0.0.0.0/0",
            action: "ALLOW",
          },
        ],
      },
    },
    instances: {
      "web-01": {
        id: "web-01",
        name: "web-01 (Nginx HTTPS)",
        subnetId: "sub-pub-a",
        privateIp: "10.0.1.10",
        publicIp: "54.238.10.5",
        securityGroupIds: ["sg-web"],
        listeningPorts: [22, 443],
      },
    },
  },
  testFlows: [
    {
      id: "flow-https-ext",
      label: "外部クライアント → web-01 (HTTPS 443)",
      description: "送信元 198.51.100.25:54321 → 54.238.10.5:443",
      flow: {
        direction: "internet-to-instance",
        sourceIp: "198.51.100.25",
        ephemeralPort: 54321,
        targetInstanceId: "web-01",
        protocol: "tcp",
        destPort: 443,
      },
    },
    {
      id: "flow-ssh-unknown",
      label: "攻撃元IP → web-01 (SSH 22 / 遮断確認)",
      description: "送信元 198.51.100.25:49152 → 54.238.10.5:22",
      flow: {
        direction: "internet-to-instance",
        sourceIp: "198.51.100.25",
        ephemeralPort: 49152,
        targetInstanceId: "web-01",
        protocol: "tcp",
        destPort: 22,
      },
    },
  ],
  goals: [
    {
      id: "goal-https-allow",
      description: "外部 (198.51.100.25) から web-01 の HTTPS (TCP 443) へ到達し応答が返る",
      flow: {
        direction: "internet-to-instance",
        sourceIp: "198.51.100.25",
        ephemeralPort: 54321,
        targetInstanceId: "web-01",
        protocol: "tcp",
        destPort: 443,
      },
      expectSuccess: true,
    },
    {
      id: "goal-ssh-still-blocked",
      description: "セキュリティ要件: 許可されていない送信元からの SSH (TCP 22) は引き続き拒否される",
      flow: {
        direction: "internet-to-instance",
        sourceIp: "198.51.100.25",
        ephemeralPort: 49152,
        targetInstanceId: "web-01",
        protocol: "tcp",
        destPort: 22,
      },
      expectSuccess: false,
    },
  ],
  hints: [
    "まず右側の通信テストボタン『外部クライアント → web-01 (HTTPS 443)』を実行し、どのレイヤー (`SG-In` / `RouteTable`) で止まっているかを確認しましょう。",
    "`sg-web` の Inbound ルールに SSH (22) しかなく TCP 443 がありません。さらに HTTPS だけ許可しても、戻りレスポンスを返す段階で `rtb-public` にデフォルトルート (`0.0.0.0/0 -> igw-main`) がないため失敗します。",
    "Security Groups タブで `Inbound TCP 443 (0.0.0.0/0)` を追加し、Route Tables タブで `0.0.0.0/0 → igw-main` を追加してください。Security Group はステートフルなため Outbound ルールは0件のままで戻りが通ります！",
  ],
  solutionExplanation:
    "パブリックサブネットであっても、Security Group での Inbound (TCP 443) 許可と Route Table での `0.0.0.0/0 → IGW` 設定の両方が必要です。なお Security Group は「ステートフル」なので、許可されたインバウンドに対する戻りレスポンスは Outbound ルールが一切なくても `STATEFUL-BYPASS` で自動通過します。",
};

export const cloudNaclEphemeralScenario: CloudVpcScenarioDefinition = {
  id: "cloud-nacl-ephemeral",
  title: "「NACLでインバウンド80番を許可したのにレスポンスが返らない」",
  difficulty: "実践",
  description:
    "Security Group と Route Table は正しく設定済みですが、コンプライアンス要件で Network ACL (NACL) を厳格化した直後から Web サーバ (`web-02`) への HTTP (TCP 80) 通信が一切成立しなくなりました。ステートレス NACL のルールを修正してください。",
  ticketSymptom:
    "【障害報告】NACL `nacl-strict` の Inbound #100 で TCP 80 を許可し、Outbound #100 にも TCP 80 を許可しましたが、クライアントに画面が表示されずタイムアウトします。",
  initialVpc: {
    vpcId: "vpc-strict",
    vpcName: "Strict-VPC",
    cidrBlock: "10.10.0.0/16",
    igwId: "igw-strict",
    subnets: {
      "sub-web": {
        id: "sub-web",
        name: "Public-Web-Subnet",
        cidr: "10.10.1.0/24",
        availabilityZone: "ap-northeast-1a",
        type: "public",
        routeTableId: "rt-strict-pub",
        naclId: "nacl-strict",
      },
    },
    routeTables: {
      "rt-strict-pub": {
        id: "rt-strict-pub",
        name: "rtb-strict-pub",
        routes: [
          {
            destinationCidr: "10.10.0.0/16",
            targetType: "local",
            targetId: "local",
          },
          {
            destinationCidr: "0.0.0.0/0",
            targetType: "igw",
            targetId: "igw-strict",
          },
        ],
      },
    },
    securityGroups: {
      "sg-http": {
        id: "sg-http",
        name: "sg-http-only",
        description: "HTTP 80許可のみ（Outboundルール0件）",
        rules: [
          {
            id: "sg-http-in",
            direction: "inbound",
            protocol: "tcp",
            fromPort: 80,
            toPort: 80,
            cidr: "0.0.0.0/0",
            description: "Public HTTP",
          },
        ],
      },
    },
    nacls: {
      "nacl-strict": {
        id: "nacl-strict",
        name: "nacl-strict",
        rules: [
          {
            ruleNumber: 100,
            direction: "inbound",
            protocol: "tcp",
            fromPort: 80,
            toPort: 80,
            cidr: "0.0.0.0/0",
            action: "ALLOW",
          },
          {
            ruleNumber: 100,
            direction: "outbound",
            protocol: "tcp",
            fromPort: 80,
            toPort: 80,
            cidr: "0.0.0.0/0",
            action: "ALLOW",
          },
        ],
      },
    },
    instances: {
      "web-02": {
        id: "web-02",
        name: "web-02 (HTTP App)",
        subnetId: "sub-web",
        privateIp: "10.10.1.20",
        publicIp: "52.192.40.80",
        securityGroupIds: ["sg-http"],
        listeningPorts: [80],
      },
    },
  },
  testFlows: [
    {
      id: "flow-http-ephem-1",
      label: "Webアクセス検証 (クライアント Port 55100 → 80)",
      description: "送信元 198.51.100.10:55100 → 52.192.40.80:80",
      flow: {
        direction: "internet-to-instance",
        sourceIp: "198.51.100.10",
        ephemeralPort: 55100,
        targetInstanceId: "web-02",
        protocol: "tcp",
        destPort: 80,
      },
    },
    {
      id: "flow-http-ephem-2",
      label: "別クライアント検証 (クライアント Port 38210 → 80)",
      description: "送信元 203.0.113.55:38210 → 52.192.40.80:80",
      flow: {
        direction: "internet-to-instance",
        sourceIp: "203.0.113.55",
        ephemeralPort: 38210,
        targetInstanceId: "web-02",
        protocol: "tcp",
        destPort: 80,
      },
    },
  ],
  goals: [
    {
      id: "goal-http-ephem-55100",
      description:
        "クライアント (エフェメラルポート 55100) からの HTTP リクエストに対してレスポンスが返る",
      flow: {
        direction: "internet-to-instance",
        sourceIp: "198.51.100.10",
        ephemeralPort: 55100,
        targetInstanceId: "web-02",
        protocol: "tcp",
        destPort: 80,
      },
      expectSuccess: true,
    },
    {
      id: "goal-http-ephem-38210",
      description:
        "別のエフェメラルポート (38210) を使うクライアントにも応答が返る（1024-65535 許可）",
      flow: {
        direction: "internet-to-instance",
        sourceIp: "203.0.113.55",
        ephemeralPort: 38210,
        targetInstanceId: "web-02",
        protocol: "tcp",
        destPort: 80,
      },
      expectSuccess: true,
    },
  ],
  hints: [
    "通信テストを実行してログを見てみましょう。往路の NACL Inbound → SG Inbound → web-02 受信と、SG Outbound (STATEFUL-BYPASS) までは成功していますが、`NACL-Out` で止まっています。",
    "サーバからクライアントへ戻るパケットの宛先ポートは 80 番ではなく、クライアントが送信時に使った一時的な『エフェメラルポート (1024〜65535)』です。NACL はステートレスなため戻り通信も明示的に許可する必要があります。",
    "Network ACLs タブで Outbound に Rule #110 (または #200) として `TCP 1024 - 65535 (0.0.0.0/0) ALLOW` を追加してください。",
  ],
  solutionExplanation:
    "Security Group と異なり Network ACL は「ステートレス」です。インバウンド 80番を許可しただけでは、クライアント側のランダムなエフェメラルポート (1024–65535) へ向かう戻りパケットが NACL Outbound 末尾の `* DENY ALL` に引っかかります。Outbound に `TCP 1024–65535 ALLOW` を追加して復旧しました。",
};

export const cloudPrivateNatEgressScenario: CloudVpcScenarioDefinition = {
  id: "cloud-private-nat-egress",
  title: "「Private Subnetのアプリサーバから外部API(HTTPS 443)へ通信できない」",
  difficulty: "実践",
  description:
    "Private Subnet 上のバッチ／APIサーバ (`app-01`) が外部決済API (`198.51.100.99:443`) へアウトバウンド接続できません。Public Subnet には NAT Gateway (`nat-gw-1`) が作成済みですが、ルーティングと Security Group 設定が不足しています。セキュアな外部接続を復旧してください。",
  ticketSymptom:
    "【障害報告】`app-01` (Private IP `10.20.2.50`) から外部 HTTPS サーバへの通信が失敗しています。NAT Gateway (`nat-gw-1`) 経由でインターネットへ抜けられるよう設定を見直してください。",
  initialVpc: {
    vpcId: "vpc-app",
    vpcName: "App-Tier-VPC",
    cidrBlock: "10.20.0.0/16",
    igwId: "igw-app",
    natGateways: [
      {
        id: "nat-gw-1",
        name: "nat-gw-public-a",
        subnetId: "sub-app-pub",
        publicIp: "54.250.99.10",
      },
    ],
    subnets: {
      "sub-app-pub": {
        id: "sub-app-pub",
        name: "Public-NAT-Subnet",
        cidr: "10.20.1.0/24",
        availabilityZone: "ap-northeast-1a",
        type: "public",
        routeTableId: "rt-app-pub",
        naclId: "acl-app-default",
      },
      "sub-app-priv": {
        id: "sub-app-priv",
        name: "Private-App-Subnet",
        cidr: "10.20.2.0/24",
        availabilityZone: "ap-northeast-1a",
        type: "private",
        routeTableId: "rt-app-priv",
        naclId: "acl-app-default",
      },
    },
    routeTables: {
      "rt-app-pub": {
        id: "rt-app-pub",
        name: "rtb-public",
        routes: [
          {
            destinationCidr: "10.20.0.0/16",
            targetType: "local",
            targetId: "local",
          },
          {
            destinationCidr: "0.0.0.0/0",
            targetType: "igw",
            targetId: "igw-app",
          },
        ],
      },
      "rt-app-priv": {
        id: "rt-app-priv",
        name: "rtb-private",
        routes: [
          {
            destinationCidr: "10.20.0.0/16",
            targetType: "local",
            targetId: "local",
          },
        ],
      },
    },
    securityGroups: {
      "sg-app": {
        id: "sg-app",
        name: "sg-private-app",
        description: "プライベートAppサーバ用SG（最小権限ポリシー）",
        rules: [],
      },
    },
    nacls: {
      "acl-app-default": {
        id: "acl-app-default",
        name: "nacl-default",
        rules: [
          {
            ruleNumber: 100,
            direction: "inbound",
            protocol: "all",
            fromPort: 0,
            toPort: 65535,
            cidr: "0.0.0.0/0",
            action: "ALLOW",
          },
          {
            ruleNumber: 100,
            direction: "outbound",
            protocol: "all",
            fromPort: 0,
            toPort: 65535,
            cidr: "0.0.0.0/0",
            action: "ALLOW",
          },
        ],
      },
    },
    instances: {
      "app-01": {
        id: "app-01",
        name: "app-01 (Private API)",
        subnetId: "sub-app-priv",
        privateIp: "10.20.2.50",
        securityGroupIds: ["sg-app"],
        listeningPorts: [8080],
      },
    },
  },
  testFlows: [
    {
      id: "flow-app-out-https",
      label: "app-01 → 外部決済API (HTTPS 443)",
      description: "10.20.2.50 → 198.51.100.99:443",
      flow: {
        direction: "instance-to-internet",
        sourceInstanceId: "app-01",
        ephemeralPort: 51200,
        destIp: "198.51.100.99",
        protocol: "tcp",
        destPort: 443,
      },
    },
  ],
  goals: [
    {
      id: "goal-priv-nat-https",
      description:
        "app-01 から NAT Gateway (nat-gw-1) 経由で外部 HTTPS API (198.51.100.99:443) へ接続できる",
      flow: {
        direction: "instance-to-internet",
        sourceInstanceId: "app-01",
        ephemeralPort: 51200,
        destIp: "198.51.100.99",
        protocol: "tcp",
        destPort: 443,
      },
      expectSuccess: true,
    },
    {
      id: "goal-priv-in-blocked",
      description:
        "Private Subnet 保護: インターネットから app-01 への直接インバウンド接続は不可である",
      flow: {
        direction: "internet-to-instance",
        sourceIp: "198.51.100.99",
        ephemeralPort: 52000,
        targetInstanceId: "app-01",
        protocol: "tcp",
        destPort: 8080,
      },
      expectSuccess: false,
    },
  ],
  hints: [
    "テスト『app-01 → 外部決済API (HTTPS 443)』を実行し、SG Outbound と Route Table のエラー内容を確認しましょう。",
    "`sg-app` に Outbound TCP 443 許可ルールがなく、さらに `rtb-private` にデフォルトルート (`0.0.0.0/0 -> nat-gw-1`) が設定されていません（Private サブネットのため `igw` ではなく `nat-gw-1` へ向けます）。",
    "Security Groups タブで `sg-app` に `Outbound TCP 443 (0.0.0.0/0)` を追加し、Route Tables タブの `rtb-private` に `0.0.0.0/0 → nat-gw-1` を追加してください。",
  ],
  solutionExplanation:
    "パブリック IP を持たない Private Subnet の EC2 から外部へ接続するには、プライベート側ルートテーブルで `0.0.0.0/0` を Public Subnet 上の `NAT Gateway` へ向ける必要があります（IGW へ向けてもパブリック IP がないため通信できません）。さらに Security Group で必要な Outbound (TCP 443) を許可することで、外部からの直接アクセスは遮断したまま安全に外向き API 通信を実現できます。",
};

export const CLOUD_VPC_SCENARIOS: CloudVpcScenarioDefinition[] = [
  cloudIgwSgHttpsScenario,
  cloudNaclEphemeralScenario,
  cloudPrivateNatEgressScenario,
];
