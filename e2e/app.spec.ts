import { expect, test, type Page } from "@playwright/test";

function attachErrorCollector(page: Page): {
  pageErrors: string[];
  consoleErrors: string[];
} {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => {
    pageErrors.push(`pageerror: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`console.error: ${msg.text()}`);
    }
  });
  return { pageErrors, consoleErrors };
}

async function runCliCommands(page: Page, commands: string[]) {
  const input = page.locator("#cli-command-input");
  for (const cmd of commands) {
    await input.fill(cmd);
    await input.press("Enter");
  }
}

async function answerLesson1QuizWithOneMiss(page: Page) {
  // Scope strictly inside the LessonQuiz card (last card containing Q1..Q4)
  await page.getByRole("button", { name: "L2スイッチ", exact: true }).click();
  await page.getByRole("button", { name: "スイッチ", exact: true }).last().click();
  await page
    .getByRole("button", { name: "デフォルトゲートウェイ", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", {
      name: "ブロードキャスト通信の範囲を区切り、混雑やセキュリティリスクを減らすため",
    })
    .click();
  await page.getByRole("button", { name: "採点する" }).click();
}

test.describe("NetForge Full Application E2E", () => {
  test("1. Dashboard onboarding -> Lesson glossary & quiz -> Reload persistence, Resume & Streak", async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await page.goto("/");

    // Fresh learner onboarding guide visible
    await expect(
      page.getByText("完全未経験 3ステップ・スタートガイド"),
    ).toBeVisible();

    // Jump to Lesson 1.1
    await page.getByText("LAN / WAN の全体像を図解でつかむ").click();
    await expect(page).toHaveURL(/\/learn\/stage-1\/lan-wan/);
    await expect(
      page.getByRole("heading", { name: "LAN / WAN とネットワークの全体像" }),
    ).toBeVisible();

    // Switch Beginner <-> Exam mode and check inline glossary tooltip
    await page.getByRole("button", { name: "試験対策コマンドモード" }).click();
    await expect(page.getByText("CCNA・実務 重要ポイント")).toBeVisible();
    await page.getByRole("button", { name: "未経験向け図解モード" }).click();
    await page
      .getByRole("button", { name: "デフォルトゲートウェイ", exact: true })
      .nth(1)
      .hover();
    await expect(page.getByRole("tooltip")).toBeVisible();

    // Answer quiz: deliberately miss Q1 so it enters wrongQuestionIds, get Q2/Q3/Q4 right
    await answerLesson1QuizWithOneMiss(page);
    await expect(page.getByText("結果: 3 / 4 問正解")).toBeVisible();

    // Reload and verify persistence + onboarding disappears + resume & streak show
    await page.goto("/");
    await expect(
      page.getByText("完全未経験 3ステップ・スタートガイド"),
    ).toHaveCount(0);
    await expect(page.getByText(/前回の続きから再開/)).toBeVisible();
    await expect(page.getByText("1 日連続")).toBeVisible();
    await expect(page.getByText("誤答復習 1問")).toBeVisible();

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("2. Lesson catalog dynamic count (20 lessons) & stage filtering", async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await page.goto("/learn");

    await expect(page.getByText("Stage 1–3 全20レッスン")).toBeVisible();
    await expect(page.getByRole("button", { name: "すべて (20)" })).toBeVisible();

    await page.getByRole("button", { name: "Stage 2" }).click();
    await expect(
      page.getByText("VLAN・802.1Qトランク & Router-on-a-Stick"),
    ).toBeVisible();
    await expect(
      page.getByText("LAN / WAN とネットワークの全体像"),
    ).toHaveCount(0);

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("3. CLI Lab Step-0 clear with Guided Mode, Undo/Redo, Diff & URL sync", async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await page.goto("/labs/cli?scenario=cli-first-steps");

    await expect(
      page.getByText("ステップ伴走ガイド（未経験サポート）"),
    ).toBeVisible();

    // Switch to R1-Home via guide quick-button and bring Gig0/0 up
    await page.getByRole("button", { name: "設定対象 R1-Home へ切替" }).click();
    await runCliCommands(page, [
      "enable",
      "configure terminal",
      "interface Gig0/0",
      "no shutdown",
      "end",
    ]);

    // Verify scenario cleared
    await expect(page.getByText("全ゴール達成！シナリオクリア")).toBeVisible();

    // Check Diff panel and Undo/Redo
    await page.getByRole("button", { name: /設定Diff/ }).click();
    await expect(
      page.getByText("初期状態からのリアルタイム設定 Diff"),
    ).toBeVisible();
    await page.getByRole("button", { name: "1手戻す" }).click();
    await page.getByRole("button", { name: "やり直す" }).click();

    // Switch to another scenario and verify URL updates
    await page
      .getByRole("button", { name: /基本IP設定とL3ルーティング疎通/ })
      .click();
    await expect(page).toHaveURL(/scenario=cli-basic-routing/);

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("4. Troubleshoot Lab (Port Security err-disabled), Timer & Mini-Postmortem", async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await page.goto("/labs/troubleshoot?scenario=ts-port-security-errdisable");

    await expect(
      page.getByRole("heading", {
        name: "「会議室ハブを繋いだ後から通信が完全に途絶えた (err-disabled)」",
      }),
    ).toBeVisible();

    // Inspect port-security then recover
    await runCliCommands(page, [
      "enable",
      "show port-security",
      "configure terminal",
      "interface Fa0/1",
      "switchport port-security maximum 2",
      "shutdown",
      "no shutdown",
      "end",
    ]);

    await expect(page.getByText("全ゴール達成！シナリオクリア")).toBeVisible();
    await expect(
      page.getByText("ミニ障害報告書（ポストモーテム振り返り）"),
    ).toBeVisible();

    // Complete mini-postmortem
    await page
      .getByRole("button", {
        name: "Port Security の最大MAC数 (1) 超過により violation shutdown が発動し、err-disabled になったため",
      })
      .click();
    await page
      .getByRole("button", {
        name: "接続台数要件に合わせて maximum を適切に設定し、err-disabled 時は原因除去後に shutdown / no shutdown で復旧する手順を周知する",
      })
      .click();
    await page.getByRole("button", { name: "報告書を提出して振り返る" }).click();
    await expect(page.getByText(/完璧です！/)).toBeVisible();

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("5. IPv6 & EtherChannel CLI Labs end-to-end execution", async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);

    // IPv6 Lab
    await page.goto("/labs/cli?scenario=cli-ipv6-basic");
    await page.getByRole("button", { name: "R1-V6", exact: true }).click();
    await runCliCommands(page, [
      "enable",
      "configure terminal",
      "ipv6 unicast-routing",
      "interface Gig0/1",
      "ipv6 address 2001:db8:20::1/64",
      "no shutdown",
      "end",
    ]);
    await expect(page.getByText("全ゴール達成！シナリオクリア")).toBeVisible();

    // EtherChannel Lab
    await page.goto("/labs/cli?scenario=cli-etherchannel-lacp");
    await page.getByRole("button", { name: "SW1-Core", exact: true }).click();
    await runCliCommands(page, [
      "enable",
      "configure terminal",
      "interface Fa0/1",
      "channel-group 1 mode active",
      "interface Fa0/2",
      "channel-group 1 mode active",
      "end",
      "show etherchannel summary",
    ]);
    await expect(page.getByText("全ゴール達成！シナリオクリア")).toBeVisible();

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("6. Free-Build Sandbox: presets, add device, CLI ping & JSON export", async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await page.goto("/labs/sandbox");

    await expect(
      page.locator("h2", { hasText: "フリービルド・サンドボックス" }),
    ).toBeVisible();

    // Load 2-site preset and add a Switch
    await page
      .getByRole("button", { name: "2拠点: PC1 - R1 - R2 - SRV1" })
      .click();
    await page.getByRole("button", { name: "Switch", exact: true }).click();
    await expect(page.getByText("SW1 (SWITCH) を追加しました。")).toBeVisible();

    // Switch to PC1 and run ipconfig
    await page.getByRole("button", { name: "PC1", exact: true }).click();
    await runCliCommands(page, ["ipconfig"]);
    await expect(page.getByText("192.168.1.10").first()).toBeVisible();

    // Open JSON export panel
    await page.getByRole("button", { name: "JSON入出力" }).click();
    await expect(
      page.getByLabel("サンドボックス構成 JSON（エクスポート / インポート）"),
    ).toBeVisible();

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("7. Cloud VPC Lab scenario interaction & URL query sync", async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await page.goto("/labs/cloud");

    await expect(
      page.getByRole("heading", {
        name: "「Public SubnetのWebサーバに外部からHTTPSアクセスできない」",
      }),
    ).toBeVisible();

    await page
      .getByRole("button", {
        name: /NACLでインバウンド80番を許可したのにレスポンスが返らない/,
      })
      .click();
    await expect(page).toHaveURL(/scenario=cloud-nacl-ephemeral/);

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("8. Tools Workspace: Subnet, IPv6, Wireshark (6 cases), Config Review (6 cases)", async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await page.goto("/tools");

    // Subnet calculator & drill
    await expect(
      page.getByRole("heading", { name: "32bit 2進数境界ビジュアライザ" }),
    ).toBeVisible();

    // IPv6 tool
    await page.getByRole("button", { name: /IPv6 圧縮・展開ツール/ }).click();
    await expect(page).toHaveURL(/tab=ipv6/);

    // Wireshark 6 cases
    await page
      .getByRole("button", { name: /Wireshark風 パケット解析ドリル/ })
      .click();
    await expect(page).toHaveURL(/tab=wireshark/);
    await expect(page.getByText(/Case 4/)).toBeVisible();
    await expect(page.getByText(/Case 6/)).toBeVisible();

    // Config review 6 cases
    await page.getByRole("button", { name: /構成図レビュー/ }).click();
    await expect(page).toHaveURL(/tab=config-review/);
    await expect(page.getByText(/Review 4:/)).toBeVisible();
    await expect(page.getByText(/Review 6:/)).toBeVisible();

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("9. Exam Mock + Wrong-Question Revenge Mode clearing a missed question", async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);

    // Seed 1 missed question from lesson 1.1 first
    await page.goto("/learn/stage-1/lan-wan");
    await answerLesson1QuizWithOneMiss(page);

    // Go to Exam -> Revenge mode
    await page.goto("/exam");
    await page.getByRole("button", { name: "誤答リベンジノート (1問)" }).click();
    await expect(
      page.getByText("異なるネットワーク（LAN と WAN）の境界で"),
    ).toBeVisible();

    // Answer correctly ("ルータ") and submit
    await page.getByRole("button", { name: /B\s*ルータ/ }).click();
    await page.getByRole("button", { name: "採点して弱点分析する" }).click();

    // Should now show 0 questions remaining in revenge tab
    await expect(
      page.getByRole("button", { name: "誤答リベンジノート (0問)" }),
    ).toBeVisible();

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("10. Global Search (Cmd+K), Backup Modal & Custom 404 page", async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await page.goto("/");

    // Open Command Palette via search button
    await page.getByLabel("グローバル検索を開く (Cmd+K)").click();
    const searchInput = page.getByLabel(
      "キーワードで検索（記事・ラボ・ツール・CLIコマンド）",
    );
    await searchInput.fill("サンドボックス");
    await expect(
      page.getByText("フリービルド・サンドボックス (自由設計ラボ)"),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // Open Backup Modal
    await page.getByRole("button", { name: "バックアップ / 復元" }).click();
    await expect(page.getByText("学習進捗のバックアップ / 復元")).toBeVisible();
    await page.keyboard.press("Escape");

    expect(errors.consoleErrors).toEqual([]);

    // Custom 404 (404 response naturally logs network 404 in browser console, so assert zero pageErrors)
    await page.goto("/non-existent-route-check");
    await expect(page.getByText("404 — ページが見つかりません")).toBeVisible();
    await page.getByRole("link", { name: "ダッシュボードへ戻る" }).click();
    await expect(page).toHaveURL(/\/$/);

    expect(errors.pageErrors).toEqual([]);
  });
});
