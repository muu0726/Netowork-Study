import {
  CLOUD_SCENARIOS_META,
  SCENARIOS_META,
} from "@/data/curriculum-meta";
import { ALL_LESSONS } from "@/data/lessons";
import { TROUBLESHOOT_SCENARIOS } from "@/data/scenarios";
import { CLOUD_VPC_SCENARIOS } from "@/data/scenarios/cloud-vpc-scenarios";
import type { PersistedLearningState } from "@/store/useLearningStore";

export type DiagnosticDomainId =
  | "fundamentals"
  | "l2-switching"
  | "l3-routing"
  | "acl-nat-dhcp"
  | "linux-web"
  | "cloud-netops";

export interface DiagnosticDomainMeta {
  id: DiagnosticDomainId;
  label: string;
  shortLabel: string;
  lessonIds: string[];
  scenarioIds: string[];
  drillIds: string[];
  recommendedHref: string;
  recommendedLabel: string;
}

export const DIAGNOSTIC_DOMAINS: DiagnosticDomainMeta[] = [
  {
    id: "fundamentals",
    label: "基礎・IPv4/IPv6",
    shortLabel: "IPv4/IPv6",
    lessonIds: [
      "stage1/lan-wan",
      "stage1/osi-tcpip",
      "stage1/ip-mac",
      "stage1/subnetting",
      "stage1/tcp-udp",
      "stage2/ipv6-fundamentals",
    ],
    scenarioIds: [],
    drillIds: ["subnet", "ipv6"],
    recommendedHref: "/tools",
    recommendedLabel: "サブネット & IPv6 ドリル",
  },
  {
    id: "l2-switching",
    label: "L2・VLAN・STP・無線",
    shortLabel: "L2 / STP",
    lessonIds: [
      "stage2/vlan-trunk",
      "stage2/stp-etherchannel",
      "stage2/l2-security-wireless",
    ],
    scenarioIds: ["cli-vlan-roas", "ts-vlan-mismatch", "cli-stp-root-bridge"],
    drillIds: [],
    recommendedHref: "/labs/cli",
    recommendedLabel: "CLI構築ラボ (VLAN/STP)",
  },
  {
    id: "l3-routing",
    label: "L3・OSPF・HSRP",
    shortLabel: "OSPF / HSRP",
    lessonIds: ["stage2/static-ospf", "stage2/cisco-ios"],
    scenarioIds: [
      "cli-basic-routing",
      "ts-routing-asymmetric",
      "cli-ospf-cost",
      "ts-ospf-neighbor-down",
      "ts-hsrp-failover-broken",
    ],
    drillIds: [],
    recommendedHref: "/labs/cli",
    recommendedLabel: "CLI構築ラボ (OSPF/HSRP)",
  },
  {
    id: "acl-nat-dhcp",
    label: "ACL・NAT・DHCP・管理",
    shortLabel: "ACL / NAT",
    lessonIds: [
      "stage2/nat-napt",
      "stage2/acl-security",
      "stage2/network-management",
    ],
    scenarioIds: ["cli-nat-acl-web", "ts-acl-web-blocked", "ts-dhcp-failure"],
    drillIds: [],
    recommendedHref: "/labs/troubleshoot",
    recommendedLabel: "障害対応 (ACL/DHCP)",
  },
  {
    id: "linux-web",
    label: "障害解析・Linux・Web",
    shortLabel: "Linux / Web",
    lessonIds: [
      "stage1/dns-http",
      "stage3/troubleshooting-layers",
      "stage3/packet-analysis",
      "stage3/web-modern-network",
    ],
    scenarioIds: ["ts-dns-failure", "ts-linux-nginx-down"],
    drillIds: ["wireshark"],
    recommendedHref: "/labs/troubleshoot",
    recommendedLabel: "障害対応シミュレータ",
  },
  {
    id: "cloud-netops",
    label: "クラウドVPC・自動化",
    shortLabel: "Cloud VPC",
    lessonIds: ["stage3/cloud-vpc-vpn", "stage3/netops-automation"],
    scenarioIds: [
      "cloud-igw-sg-https",
      "cloud-nacl-ephemeral",
      "cloud-private-nat-egress",
    ],
    drillIds: ["config-review"],
    recommendedHref: "/labs/cloud",
    recommendedLabel: "クラウドVPCラボ",
  },
];

export interface DiagnosticQuestion {
  id: string;
  domain: DiagnosticDomainId;
  domainLabel: string;
  sourceLessonId: string;
  sourceLessonTitle: string;
  sourceHref: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

const LESSON_TO_DOMAIN = new Map<string, DiagnosticDomainMeta>();
for (const domain of DIAGNOSTIC_DOMAINS) {
  for (const lid of domain.lessonIds) {
    LESSON_TO_DOMAIN.set(lid, domain);
  }
}

export function buildDiagnosticQuestionBank(): DiagnosticQuestion[] {
  const bank: DiagnosticQuestion[] = [];
  for (const lesson of ALL_LESSONS) {
    const domain =
      LESSON_TO_DOMAIN.get(lesson.id) ?? DIAGNOSTIC_DOMAINS[0];
    for (const q of lesson.quiz) {
      bank.push({
        id: `${lesson.id}:${q.id}`,
        domain: domain.id,
        domainLabel: domain.label,
        sourceLessonId: lesson.id,
        sourceLessonTitle: lesson.title,
        sourceHref: `/learn/${lesson.stage}/${lesson.slug}`,
        question: q.question,
        choices: q.choices,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      });
    }
  }
  return bank;
}

function createSeededRng(seed: number): () => number {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = Math.imul(a ^ (a >>> 15), a | 1);
    a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateDiagnosticExam(
  count = 12,
  seed = 1,
): DiagnosticQuestion[] {
  const bank = buildDiagnosticQuestionBank();
  const rng = createSeededRng(seed);
  const perDomainTarget = Math.max(1, Math.floor(count / DIAGNOSTIC_DOMAINS.length));
  const picked: DiagnosticQuestion[] = [];
  const usedIds = new Set<string>();

  for (const domain of DIAGNOSTIC_DOMAINS) {
    const candidates = deterministicShuffle(
      bank.filter((q) => q.domain === domain.id),
      rng,
    );
    for (const q of candidates.slice(0, perDomainTarget)) {
      picked.push(q);
      usedIds.add(q.id);
    }
  }

  if (picked.length < count) {
    const leftovers = deterministicShuffle(
      bank.filter((q) => !usedIds.has(q.id)),
      rng,
    );
    for (const q of leftovers) {
      if (picked.length >= count) {
        break;
      }
      picked.push(q);
      usedIds.add(q.id);
    }
  }

  return deterministicShuffle(picked.slice(0, count), rng);
}

export interface IncidentChallengeItem {
  id: string;
  title: string;
  difficulty: "初級" | "中級" | "実践";
  category: "ios-linux" | "cloud";
  categoryLabel: string;
  href: string;
  symptom: string;
}

export function listAllIncidentChallenges(): IncidentChallengeItem[] {
  const iosLinux: IncidentChallengeItem[] = TROUBLESHOOT_SCENARIOS.map((s) => ({
    id: s.id,
    title: s.title,
    difficulty: s.difficulty,
    category: "ios-linux",
    categoryLabel: "Cisco IOS / Linux 障害対応",
    href: "/labs/troubleshoot",
    symptom: s.ticketSymptom ?? s.description,
  }));
  const cloud: IncidentChallengeItem[] = CLOUD_VPC_SCENARIOS.map((s) => ({
    id: s.id,
    title: s.title,
    difficulty: s.difficulty,
    category: "cloud",
    categoryLabel: "AWS VPC クラウド障害",
    href: "/labs/cloud",
    symptom: s.ticketSymptom,
  }));
  return [...iosLinux, ...cloud];
}

export function pickRandomIncidentChallenge(
  seed = 1,
  completedIds: readonly string[] = [],
): IncidentChallengeItem {
  const all = listAllIncidentChallenges();
  const unsolved = all.filter((item) => !completedIds.includes(item.id));
  const pool = unsolved.length > 0 ? unsolved : all;
  const rng = createSeededRng(seed);
  const idx = Math.floor(rng() * pool.length);
  return pool[idx] ?? all[0];
}

export interface DomainMasteryItem {
  domainId: DiagnosticDomainId;
  label: string;
  shortLabel: string;
  score: number;
  lessonsDone: number;
  lessonsTotal: number;
  scenariosDone: number;
  scenariosTotal: number;
  examCorrect: number;
  examTotal: number;
  recommendedHref: string;
  recommendedLabel: string;
}

export interface DomainMasterySummary {
  domains: DomainMasteryItem[];
  averageScore: number;
  weakestDomain: DomainMasteryItem;
  totalCatalogItems: number;
}

export function computeDomainMastery(
  persisted: PersistedLearningState,
): DomainMasterySummary {
  const domains: DomainMasteryItem[] = DIAGNOSTIC_DOMAINS.map((meta) => {
    const lessonsDone = meta.lessonIds.filter((id) =>
      persisted.completedLessonIds.includes(id),
    ).length;
    const lessonsTotal = meta.lessonIds.length;
    const lessonRatio = lessonsTotal > 0 ? lessonsDone / lessonsTotal : 0;

    // Include quiz best ratios when available
    let quizRatioSum = 0;
    let quizCount = 0;
    for (const lid of meta.lessonIds) {
      const qRec = persisted.quizScores[lid];
      if (qRec && qRec.total > 0) {
        quizRatioSum += qRec.bestScore / qRec.total;
        quizCount += 1;
      }
    }
    const quizRatio = quizCount > 0 ? quizRatioSum / lessonsTotal : 0;
    const knowledgeScore = Math.max(lessonRatio, quizRatio);

    const scenariosDone = meta.scenarioIds.filter((id) =>
      persisted.completedScenarioIds.includes(id),
    ).length;
    const scenariosTotal = meta.scenarioIds.length;

    let drillSolved = 0;
    for (const did of meta.drillIds) {
      drillSolved += persisted.drillStats[did]?.solved ?? 0;
    }

    let practiceScore = 0;
    if (scenariosTotal > 0 && meta.drillIds.length > 0) {
      practiceScore =
        (scenariosDone / scenariosTotal) * 0.7 +
        Math.min(1, drillSolved / 5) * 0.3;
    } else if (scenariosTotal > 0) {
      practiceScore = scenariosDone / scenariosTotal;
    } else if (meta.drillIds.length > 0) {
      practiceScore = Math.min(1, drillSolved / 5);
    } else {
      practiceScore = knowledgeScore;
    }

    const examRec = persisted.diagnosticDomainScores?.[meta.id];
    const examCorrect = examRec?.correct ?? 0;
    const examTotal = examRec?.total ?? 0;
    const hasExam = examTotal > 0;
    const examRatio = hasExam ? examCorrect / examTotal : 0;

    const combined = hasExam
      ? knowledgeScore * 0.35 + practiceScore * 0.35 + examRatio * 0.3
      : knowledgeScore * 0.5 + practiceScore * 0.5;

    return {
      domainId: meta.id,
      label: meta.label,
      shortLabel: meta.shortLabel,
      score: Math.round(Math.max(0, Math.min(100, combined * 100))),
      lessonsDone,
      lessonsTotal,
      scenariosDone,
      scenariosTotal,
      examCorrect,
      examTotal,
      recommendedHref: meta.recommendedHref,
      recommendedLabel: meta.recommendedLabel,
    };
  });

  const averageScore =
    domains.length > 0
      ? Math.round(
          domains.reduce((acc, d) => acc + d.score, 0) / domains.length,
        )
      : 0;

  let weakestDomain = domains[0];
  for (const d of domains.slice(1)) {
    if (d.score < weakestDomain.score) {
      weakestDomain = d;
    }
  }

  return {
    domains,
    averageScore,
    weakestDomain,
    totalCatalogItems:
      ALL_LESSONS.length + SCENARIOS_META.length + CLOUD_SCENARIOS_META.length,
  };
}
