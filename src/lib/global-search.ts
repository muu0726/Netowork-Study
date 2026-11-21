import { CHEAT_SHEET_SECTIONS } from "@/data/cheatsheet";
import {
  CLOUD_SCENARIOS_META,
  SCENARIOS_META,
  TOOLS_META,
} from "@/data/curriculum-meta";
import { ALL_LESSONS } from "@/data/lessons";

export type SearchItemKind =
  | "lesson"
  | "lab"
  | "troubleshoot"
  | "cloud"
  | "tool"
  | "exam"
  | "command";

export interface GlobalSearchItem {
  id: string;
  kind: SearchItemKind;
  badge: string;
  title: string;
  subtitle: string;
  href: string;
  keywords: string[];
  copyCommand?: string;
}

const KIND_LABELS: Record<SearchItemKind, string> = {
  lesson: "カリキュラム",
  lab: "CLI構築ラボ",
  troubleshoot: "障害対応",
  cloud: "クラウドVPC",
  tool: "実践ツール",
  exam: "実力診断",
  command: "CLI逆引き",
};

export function getSearchKindLabel(kind: SearchItemKind): string {
  return KIND_LABELS[kind];
}

let cachedIndex: GlobalSearchItem[] | null = null;

/**
 * 全カリキュラム記事・ラボ・障害チケット・AWS VPC・実践ツール・CLIチートシートを集約した検索インデックスを構築します。
 */
export function buildGlobalSearchIndex(): GlobalSearchItem[] {
  if (cachedIndex) {
    return cachedIndex;
  }

  const items: GlobalSearchItem[] = [];

  for (const lesson of ALL_LESSONS) {
    items.push({
      id: `lesson:${lesson.id}`,
      kind: "lesson",
      badge: `${lesson.stage.toUpperCase()} / ${lesson.estimatedMinutes}分`,
      title: lesson.title,
      subtitle: lesson.summary,
      href: `/learn/${lesson.stage}/${lesson.slug}`,
      keywords: [
        lesson.slug,
        lesson.stage,
        ...lesson.glossary.map((g) => g.term),
        ...lesson.glossary.map((g) => g.shortDef),
      ],
    });
  }

  for (const scenario of SCENARIOS_META) {
    const isLab = scenario.category === "lab";
    items.push({
      id: `scenario:${scenario.id}`,
      kind: isLab ? "lab" : "troubleshoot",
      badge: `${isLab ? "CLI LAB" : "TICKET"} / ${scenario.difficulty}`,
      title: scenario.title,
      subtitle: scenario.summary,
      href: isLab
        ? `/labs/cli?scenario=${encodeURIComponent(scenario.id)}`
        : `/labs/troubleshoot?scenario=${encodeURIComponent(scenario.id)}`,
      keywords: [scenario.id, scenario.difficulty, scenario.stage],
    });
  }

  for (const cloud of CLOUD_SCENARIOS_META) {
    items.push({
      id: `cloud:${cloud.id}`,
      kind: "cloud",
      badge: `AWS VPC / ${cloud.difficulty}`,
      title: cloud.title,
      subtitle: cloud.summary,
      href: `/labs/cloud?scenario=${encodeURIComponent(cloud.id)}`,
      keywords: [cloud.id, "aws", "vpc", "igw", "nacl", "sg", cloud.difficulty],
    });
  }

  for (const tool of TOOLS_META) {
    items.push({
      id: `tool:${tool.id}`,
      kind: "tool",
      badge: tool.badge,
      title: tool.title,
      subtitle: tool.summary,
      href: `/tools?tab=${encodeURIComponent(tool.id)}`,
      keywords: [tool.id, tool.badge],
    });
  }

  items.push({
    id: "exam:diagnostic",
    kind: "exam",
    badge: "MOCK EXAM",
    title: "総合実力診断・模擬試験モード",
    subtitle:
      "全6領域からバランスよく出題し、分野別習熟度レーダーと弱点処方箋を生成します。",
    href: "/exam",
    keywords: ["exam", "test", "mock", "radar", "模擬試験", "実力診断", "弱点"],
  });

  for (const section of CHEAT_SHEET_SECTIONS) {
    for (const cmd of section.items) {
      items.push({
        id: `cmd:${cmd.command}`,
        kind: "command",
        badge: section.badge,
        title: cmd.command,
        subtitle: `${section.title} — ${cmd.description}`,
        href: section.forEndHost ? "/labs/troubleshoot" : "/labs/cli",
        keywords: [section.title, section.badge, cmd.description],
        copyCommand: cmd.command,
      });
    }
  }

  cachedIndex = items;
  return items;
}

function scoreItemMatch(item: GlobalSearchItem, tokens: string[]): number {
  const titleLower = item.title.toLowerCase();
  const subtitleLower = item.subtitle.toLowerCase();
  const keywordsLower = item.keywords.map((k) => k.toLowerCase());
  const badgeLower = item.badge.toLowerCase();

  let score = 0;
  for (const tok of tokens) {
    if (titleLower === tok) {
      score += 100;
    } else if (titleLower.startsWith(tok)) {
      score += 60;
    } else if (titleLower.includes(tok)) {
      score += 40;
    } else if (keywordsLower.some((k) => k.includes(tok))) {
      score += 25;
    } else if (badgeLower.includes(tok)) {
      score += 18;
    } else if (subtitleLower.includes(tok)) {
      score += 12;
    } else {
      return -1;
    }
  }

  // クエリなしまたは一般一致時は学習導線（記事/ラボ）を優先
  if (item.kind !== "command") {
    score += 3;
  }
  return score;
}

/**
 * 複数キーワード（スペース区切り）とカテゴリフィルタで横断検索します。
 */
export function searchGlobalItems(
  query: string,
  kindFilter: SearchItemKind | "all" = "all",
  limit = 24,
): GlobalSearchItem[] {
  const index = buildGlobalSearchIndex();
  const filteredByKind =
    kindFilter === "all"
      ? index
      : index.filter((item) => item.kind === kindFilter);

  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    return filteredByKind.slice(0, limit);
  }

  const scored: Array<{ item: GlobalSearchItem; score: number }> = [];
  for (const item of filteredByKind) {
    const score = scoreItemMatch(item, tokens);
    if (score >= 0) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
