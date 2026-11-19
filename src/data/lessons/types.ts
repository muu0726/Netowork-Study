import type { StageId } from "@/data/curriculum-meta";

export type DiagramVariant =
  | "lan-wan"
  | "osi-tcpip"
  | "ip-mac"
  | "subnetting"
  | "tcp-udp"
  | "dns-http"
  | "vlan-trunk"
  | "stp-etherchannel"
  | "static-ospf"
  | "nat-napt"
  | "acl-security"
  | "cisco-ios"
  | "troubleshooting-layers"
  | "packet-analysis"
  | "cloud-vpc-vpn"
  | "netops-automation";

export interface GlossaryTerm {
  term: string;
  shortDef: string;
  detail: string;
  layer?: string;
}

export interface LessonCommandBlock {
  title: string;
  code: string;
  note: string;
}

export interface LessonQuizQuestion {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonArticle {
  id: string;
  stage: StageId;
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  diagramVariant: DiagramVariant;
  relatedHref?: {
    href: string;
    label: string;
  };
  glossary: GlossaryTerm[];
  beginnerMode: {
    analogyTitle: string;
    analogyText: string;
    keyPoints: Array<{ title: string; body: string }>;
    steps: string[];
  };
  examMode: {
    examTips: string[];
    referenceTable: {
      headers: string[];
      rows: string[][];
    };
    commandBlocks: LessonCommandBlock[];
    pitfalls: string[];
  };
  quiz: LessonQuizQuestion[];
}
