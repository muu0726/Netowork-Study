import { describe, expect, it } from "vitest";
import { CLOUD_SCENARIOS_META, LESSONS_META, SCENARIOS_META } from "@/data/curriculum-meta";
import {
  buildDiagnosticQuestionBank,
  buildStudyPrescription,
  computeDomainMastery,
  DIAGNOSTIC_DOMAINS,
  generateDiagnosticExam,
  pickRandomIncidentChallenge,
} from "./diagnostic-engine";

describe("Phase 8: Diagnostic Engine, Balanced Exam & Domain Mastery", () => {
  it("maps every lesson in LESSONS_META to a diagnostic domain and generates balanced 12-question exams", () => {
    const bank = buildDiagnosticQuestionBank();
    expect(bank.length).toBeGreaterThanOrEqual(LESSONS_META.length * 2);

    const mappedLessonIds = new Set(DIAGNOSTIC_DOMAINS.flatMap((d) => d.lessonIds));
    for (const lesson of LESSONS_META) {
      expect(mappedLessonIds.has(lesson.id)).toBe(true);
    }

    const exam = generateDiagnosticExam(12, 1);
    expect(exam).toHaveLength(12);
    expect(new Set(exam.map((q) => q.id)).size).toBe(12);

    // Every one of the 6 domains receives 2 questions
    for (const dom of DIAGNOSTIC_DOMAINS) {
      expect(exam.filter((q) => q.domain === dom.id)).toHaveLength(2);
    }

    // Deterministic output for identical seed
    expect(generateDiagnosticExam(12, 42)).toEqual(generateDiagnosticExam(12, 42));
  });

  it("computes domain mastery from 0% (empty) to 100% (all completed + 100% exam) and picks valid random tickets", () => {
    const empty = computeDomainMastery({
      completedLessonIds: [],
      completedScenarioIds: [],
      quizScores: {},
      drillStats: {},
      diagnosticDomainScores: {},
      lastVisitedPath: null,
    });
    expect(empty.averageScore).toBe(0);
    expect(empty.domains.every((d) => d.score === 0)).toBe(true);
    expect(empty.totalCatalogItems).toBe(
      LESSONS_META.length + SCENARIOS_META.length + CLOUD_SCENARIOS_META.length,
    );

    const fullDiagnostic: Record<string, { correct: number; total: number }> = {};
    for (const d of DIAGNOSTIC_DOMAINS) {
      fullDiagnostic[d.id] = { correct: 2, total: 2 };
    }

    const mastered = computeDomainMastery({
      completedLessonIds: LESSONS_META.map((l) => l.id),
      completedScenarioIds: [
        ...SCENARIOS_META.map((s) => s.id),
        ...CLOUD_SCENARIOS_META.map((c) => c.id),
      ],
      quizScores: {},
      drillStats: {
        subnet: { solved: 5, attempted: 5, bestStreak: 5 },
        ipv6: { solved: 5, attempted: 5, bestStreak: 5 },
        wireshark: { solved: 5, attempted: 5, bestStreak: 5 },
        "config-review": { solved: 5, attempted: 5, bestStreak: 5 },
      },
      diagnosticDomainScores: fullDiagnostic,
      lastVisitedPath: "/exam",
    });

    expect(mastered.averageScore).toBe(100);
    expect(mastered.domains.every((d) => d.score === 100)).toBe(true);

    const ticket = pickRandomIncidentChallenge(3);
    expect(ticket.id.length).toBeGreaterThan(0);
    expect(["/labs/troubleshoot", "/labs/cloud"]).toContain(ticket.href);
    expect(ticket.deepLinkHref).toContain(`${ticket.href}?scenario=`);
  });

  it("builds a 3-step targeted study prescription for the weakest domain", () => {
    const prescription = buildStudyPrescription({
      completedLessonIds: ["stage1/lan-wan", "stage1/osi-tcpip"],
      completedScenarioIds: [],
      quizScores: {},
      drillStats: {},
      diagnosticDomainScores: {
        fundamentals: { correct: 2, total: 2 },
        "l2-switching": { correct: 2, total: 2 },
        "l3-routing": { correct: 2, total: 2 },
        "acl-nat-dhcp": { correct: 0, total: 2 },
        "linux-web": { correct: 2, total: 2 },
        "cloud-netops": { correct: 2, total: 2 },
      },
      lastVisitedPath: null,
    });

    expect(prescription.targetDomain.domainId).toBe("acl-nat-dhcp");
    expect(prescription.actions).toHaveLength(3);
    expect(prescription.totalEstimatedMinutes).toBeGreaterThan(0);
    expect(prescription.actions.map((a) => a.kind)).toEqual([
      "lesson",
      "scenario",
      "tool",
    ]);
    expect(prescription.actions[0].href).toContain("/learn/");
    expect(prescription.actions[1].href).toContain("?scenario=");
    expect(prescription.actions[2].href).toContain("/tools?tab=");
  });
});
