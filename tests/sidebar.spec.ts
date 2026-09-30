import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
let origin: string;
test.beforeAll(async () => {
  server = await createServer({
    server: { host: "127.0.0.1", port: 0, hmr: false },
  });
  await server.listen();
  origin = server.resolvedUrls!.local[0];
});
test.afterAll(async () => {
  await server?.close();
});

test("sidebar loads before changes, browses refs without checkout, and rejects stale history", async ({
  page,
}) => {
  const project = {
    id: "1111111111111111",
    name: "donkey",
    path: "/repo/donkey",
  };
  const commit = (subject: string) => ({
    hash: subject === "Main" ? "a".repeat(40) : "b".repeat(40),
    short: "1234567",
    parents: "",
    author: "Test",
    date: "2026-09-30T00:00:00Z",
    subject,
    refs: "",
  });
  const snapshot = {
    project,
    branch: "main",
    files: [],
    commits: [commit("Main")],
    branches: [
      { name: "main", current: true, ref: "refs/heads/main" },
      { name: "feature", current: false, ref: "refs/heads/feature" },
      {
        name: "origin/feature",
        remote: true,
        ref: "refs/remotes/origin/feature",
      },
    ],
    worktrees: [
      { path: "/repo/donkey", branch: "main" },
      { path: "/linked/donkey", branch: "feature" },
    ],
    tags: ["v1"],
    remotes: ["origin"],
    stashes: [],
    ahead: 0,
    behind: 0,
  };
  const writes: string[] = [];
  let failRefresh = false;
  let finishScan!: () => void;
  const scan = new Promise<void>((resolve) => {
    finishScan = resolve;
  });
  let finishHistory!: () => void;
  const slowHistory = new Promise<void>((resolve) => {
    finishHistory = resolve;
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("donkey-diff-token", "test");
    localStorage.setItem("donkey-diff-auto-sync", "false");
  });
  await page.route("http://127.0.0.1:43127/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET" && request.method() !== "OPTIONS")
      writes.push(url.pathname);
    let data: unknown = [];
    if (url.pathname === "/projects") data = [project];
    else if (url.pathname.endsWith("/navigation")) data = snapshot;
    else if (url.pathname === `/projects/${project.id}`) {
      await scan;
      if (failRefresh) {
        await route.fulfill({
          status: 500,
          json: { error: "Temporary read failure" },
          headers: { "Access-Control-Allow-Origin": "*" },
        });
        return;
      }
      data = snapshot;
    } else if (url.pathname.endsWith("/history")) {
      if (url.searchParams.get("ref") === "refs/heads/feature")
        await slowHistory;
      data = [
        commit(url.searchParams.get("ref") === "HEAD" ? "Main" : "Feature"),
      ];
    }
    await route.fulfill({
      json: data,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  });
  await page.goto(origin);
  await expect(
    page.getByRole("button", { name: "donkey · main", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "donkey · feature", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Loading local changes…");
  finishScan();
  await expect(page.getByLabel("No local changes")).toBeVisible();
  await page
    .getByRole("button", { name: "feature", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toHaveText("Loading history…");
  await page.getByRole("button", { name: "All Commits", exact: true }).click();
  await expect(page.getByRole("option").first()).toContainText("Main");
  const lateHistory = page.waitForResponse((response) =>
    response.url().includes("ref=refs%2Fheads%2Ffeature"),
  );
  finishHistory();
  await lateHistory;
  await expect(page.getByRole("option").first()).toContainText("Main");
  await page.getByRole("button", { name: "v1", exact: true }).click();
  await expect(page.getByRole("option").first()).toContainText("Feature");
  expect(writes).toEqual([]);
  await expect(page.getByRole("alert")).toHaveCount(0);
  failRefresh = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("alert")).toContainText("Refresh failed");
  await expect(page.getByRole("option").first()).toContainText("Feature");
  await expect(
    page.getByRole("button", { name: "donkey · main", exact: true }),
  ).toBeVisible();
});

test("worktree and ref switches preserve chrome, scroll and cached diffs while reads are pending", async ({
  page,
}) => {
  const projects = [
    { id: "1111111111111111", name: "main", path: "/repo/main" },
    { id: "2222222222222222", name: "feature", path: "/repo/feature" },
  ];
  const makeCommit = (hash: string, subject: string) => ({
    hash: hash.repeat(40),
    short: hash.repeat(7),
    subject,
    author: "Test",
    date: "2026-09-30T00:00:00Z",
    parents: "",
    refs: "",
  });
  const commits = [
    makeCommit("a", "Main commit"),
    makeCommit("b", "Feature commit"),
  ];
  const worktrees = projects.map((p) => ({ path: p.path, branch: p.name }));
  const snapshot = (index: number) => ({
    project: projects[index],
    branch: projects[index].name,
    commits: [commits[index]],
    files: [],
    worktrees,
    branches: projects.map((p, i) => ({ name: p.name, current: i === index })),
    remotes: [],
    tags: Array.from({ length: 80 }, (_, i) => `v${i}`),
    stashes: [],
    ahead: 0,
    behind: 0,
  });
  const changed = (index: number) => [
    {
      path: `${projects[index].name}.txt`,
      status: "M",
      staged: false,
      conflict: false,
      additions: 1,
      deletions: 1,
    },
  ];
  let releaseTree!: () => void;
  const treeRead = new Promise<void>((resolve) => {
    releaseTree = resolve;
  });
  let releaseRef!: () => void;
  const refRead = new Promise<void>((resolve) => {
    releaseRef = resolve;
  });
  let blockMain = false;
  let releaseMain!: () => void;
  const mainRead = new Promise<void>((resolve) => {
    releaseMain = resolve;
  });
  const fileReads: string[] = [];
  await page.addInitScript(() => {
    (window as any).diffWorkerCount = 0;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        (window as any).diffWorkerCount++;
      }
    };
    sessionStorage.setItem("donkey-diff-token", "test");
    localStorage.setItem("donkey-diff-auto-sync", "false");
  });
  await page.route("http://127.0.0.1:43127/**", async (route) => {
    const url = new URL(route.request().url());
    const index = url.pathname.includes(projects[1].id) ? 1 : 0;
    let data: unknown = [];
    if (url.pathname === "/projects") data = projects;
    else if (url.pathname.endsWith("/navigation")) data = snapshot(index);
    else if (url.pathname.endsWith("/history")) {
      if (index === 1) await treeRead;
      if (blockMain && index === 0) await mainRead;
      if (url.searchParams.get("ref") === "refs/tags/v0") await refRead;
      data = [commits[index]];
    } else if (url.pathname.endsWith("/files")) {
      fileReads.push(url.href);
      data = changed(index);
    } else if (url.pathname.endsWith("/file")) {
      fileReads.push(url.href);
      data = {
        path: `${projects[index].name}.txt`,
        old: "before\n",
        current: "after\n",
        binary: false,
        conflict: false,
      };
    } else {
      if (index === 1) await treeRead;
      if (blockMain && index === 0) await mainRead;
      data = snapshot(index);
    }
    await route.fulfill({
      json: data,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  });
  await page.goto(origin);
  await page.getByRole("button", { name: "All Commits", exact: true }).click();
  await expect(page.locator(".diff-toolbar")).toContainText("main.txt");
  await expect(page.locator(".diff-pane")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.evaluate(() => {
    const selectors = [
      ".sidebar",
      ".toolbar",
      ".project-tabs",
      ".diff-toolbar",
      ".workspace-tabs",
      ".file-filter",
    ];
    (window as any).chromeNodes = selectors.map((s) =>
      document.querySelector(s),
    );
    (window as any).chromeSelectors = selectors;
    (window as any).removedChrome = false;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.removedNodes)
          if (
            (window as any).chromeNodes.some(
              (chrome: Node) => node === chrome || node.contains(chrome),
            )
          )
            (window as any).removedChrome = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  // A pending ref keeps the old content and all its controls mounted.
  await page.getByRole("button", { name: "v0", exact: true }).click();
  await expect(page.getByRole("option").first()).toContainText("Main commit");
  await expect(page.locator(".diff-toolbar")).toContainText("main.txt");
  releaseRef();
  await expect(page.locator(".history-loading-indicator")).toHaveCount(0);
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "feature", exact: true })
    .first()
    .click();
  await expect(
    page.locator('.sidebar .nav-row[title="/repo/feature"] .current-dot'),
  ).toBeVisible();
  await expect(page.locator(".diff-toolbar")).toContainText("main.txt");
  // The shared navigation does not collapse or empty before the new snapshot.
  await expect(
    page.getByRole("button", { name: "v79", exact: true }),
  ).toBeAttached();
  releaseTree();
  await expect(page.locator(".diff-toolbar")).toContainText("feature.txt");
  await expect(page.locator(".diff-pane")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page
    .getByRole("button", { name: "Manage worktree feature", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Move worktree…", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("menuitem", { name: "Remove worktree…", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Next change", exact: true }),
  ).toBeEnabled();
  const workerCount = await page.evaluate(
    () => (window as any).diffWorkerCount,
  );
  const reads = fileReads.length;
  blockMain = true;
  await page.locator(".sidebar-scroll").evaluate((node) => {
    node.scrollTop = 150;
  });
  const scroll = await page
    .locator(".sidebar-scroll")
    .evaluate((node) => node.scrollTop);
  // Returning to a visited worktree must finish rendering before its refresh resolves.
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "main", exact: true })
    .first()
    .evaluate((node: HTMLButtonElement) => node.click());
  await expect(page.locator(".diff-toolbar")).toContainText("main.txt");
  await expect(page.locator(".diff-pane")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect(fileReads.length).toBe(reads);
  await expect(
    page.getByRole("button", { name: "Next change", exact: true }),
  ).toBeEnabled();
  expect(await page.evaluate(() => (window as any).diffWorkerCount)).toBe(
    workerCount,
  );
  expect(
    await page.locator(".sidebar-scroll").evaluate((node) => node.scrollTop),
  ).toBe(scroll);
  expect(
    await page.evaluate(() =>
      (window as any).chromeNodes.every(
        (node: Node, i: number) =>
          node.isConnected &&
          document.querySelector((window as any).chromeSelectors[i]) === node,
      ),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => (window as any).removedChrome)).toBe(false);
  await expect(page.getByRole("alert")).toHaveCount(0);
  releaseMain();
});

test("worktrees stay inside their repository tab and survive switching tabs and reload", async ({
  page,
}) => {
  const root = { id: "1111111111111111", name: "donkey", path: "/repo/donkey" };
  const other = { id: "2222222222222222", name: "other", path: "/repo/other" };
  const linked = {
    id: "3333333333333333",
    name: "albany",
    path: "/repo/albany",
  };
  await page.addInitScript(() => {
    sessionStorage.setItem("donkey-diff-token", "test");
    localStorage.setItem("donkey-diff-auto-sync", "false");
    if (!localStorage.getItem("donkey-diff-tabs"))
      localStorage.setItem(
        "donkey-diff-tabs",
        JSON.stringify(["1111111111111111", "2222222222222222"]),
      );
  });
  await page.route("http://127.0.0.1:43127/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const project =
      [root, other, linked].find((p) => pathname.includes(p.id)) || root;
    const snapshot = {
      project,
      branch: project.name,
      commits: [],
      files: [],
      branches: [],
      worktrees: (project === other ? [other] : [root, linked]).map((p) => ({
        path: p.path,
        branch: p.name,
      })),
      tags: [],
      remotes: [],
      stashes: [],
      ahead: 0,
      behind: 0,
    };
    await route.fulfill({
      json:
        pathname === "/projects"
          ? [root, other, linked]
          : pathname.endsWith("/history")
            ? []
            : snapshot,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  });
  await page.goto(origin);
  const tabs = page.locator(".tab-select");
  await expect(tabs).toHaveText(["donkey", "other"]);
  const originalTab = await tabs.first().elementHandle();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "albany", exact: true })
    .click();
  await expect(page.locator(".project-heading")).toContainText("donkey");
  await expect(
    page.locator('.sidebar .nav-row[title="/repo/albany"] .current-dot'),
  ).toBeVisible();
  await expect(tabs).toHaveText(["donkey", "other"]);
  await expect(tabs.first()).toHaveAttribute("aria-pressed", "true");
  expect(await originalTab!.evaluate((node) => node.isConnected)).toBe(true);
  await tabs.nth(1).click();
  await expect(page.locator(".project-heading")).toContainText("other");
  await tabs.first().click();
  await expect(page.locator(".project-heading")).toContainText("donkey");
  await expect(
    page.locator('.sidebar .nav-row[title="/repo/albany"] .current-dot'),
  ).toBeVisible();
  await page.reload();
  await expect(tabs).toHaveText(["donkey", "other"]);
  await expect(tabs.first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".project-heading")).toContainText("donkey");
  await expect(
    page.locator('.sidebar .nav-row[title="/repo/albany"] .current-dot'),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close donkey tab", exact: true })
    .click();
  await expect(tabs).toHaveText(["other"]);
  await expect(page.locator(".project-heading")).toContainText("other");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("commit changes and rapid file cycling keep toolbar nodes, styles and geometry stable", async ({
  page,
}) => {
  const project = {
    id: "1111111111111111",
    name: "donkey",
    path: "/repo/donkey",
  };
  const hashes = ["a".repeat(40), "b".repeat(40)];
  const commits = hashes.map((hash, i) => ({
    hash,
    short: hash.slice(0, 7),
    subject: `Commit ${i + 1}`,
    author: "Test",
    date: "2026-09-30T00:00:00Z",
    parents: "",
    refs: "",
  }));
  const snapshot = {
    project,
    branch: "main",
    commits,
    files: [],
    branches: [],
    worktrees: [{ path: project.path, branch: "main" }],
    tags: [],
    remotes: [],
    stashes: [],
    ahead: 0,
    behind: 0,
  };
  let releaseCommit!: () => void;
  const pendingCommit = new Promise<void>((resolve) => {
    releaseCommit = resolve;
  });
  let releaseFile!: () => void;
  const pendingFile = new Promise<void>((resolve) => {
    releaseFile = resolve;
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("donkey-diff-token", "test");
    localStorage.setItem("donkey-diff-auto-sync", "false");
  });
  await page.route("http://127.0.0.1:43127/**", async (route) => {
    const url = new URL(route.request().url());
    const second = url.searchParams.get("commit") === hashes[1];
    let data: unknown = snapshot;
    if (url.pathname === "/projects") data = [project];
    else if (url.pathname.endsWith("/history")) data = commits;
    else if (url.pathname.endsWith("/files")) {
      if (second) await pendingCommit;
      data = (second ? ["c.txt", "d.txt"] : ["a.txt", "b.txt"]).map((path) => ({
        path,
        status: "M",
        staged: false,
        conflict: false,
        additions: 1,
        deletions: 1,
      }));
    } else if (url.pathname.endsWith("/file")) {
      const path = url.searchParams.get("path")!;
      if (path === "d.txt") await pendingFile;
      data = {
        path,
        old: "before\n",
        current: "after\n",
        binary: false,
        conflict: false,
      };
    }
    await route.fulfill({
      json: data,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  });
  await page.goto(origin);
  await page.getByRole("button", { name: "All Commits", exact: true }).click();
  const toolbar = page.locator(".diff-toolbar");
  await expect(toolbar).toContainText("a.txt");
  await expect(
    page.getByRole("button", { name: "Next change", exact: true }),
  ).toBeEnabled();
  const selectors = [
    ".toolbar",
    ".workspace-tabs",
    ".file-filter",
    ".diff-toolbar",
    ".diff-controls",
  ];
  const nodes = await Promise.all(
    selectors.map((selector) => page.locator(selector).elementHandle()),
  );
  const appearance = () =>
    page.locator(".diff-controls button").evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          opacity: style.opacity,
          background: style.backgroundColor,
          color: style.color,
        };
      }),
    );
  const initial = await appearance();
  const commitRequested = page.waitForRequest((request) =>
    request.url().includes("/files?commit=" + hashes[1]),
  );
  await page.getByRole("option").filter({ hasText: "Commit 2" }).click();
  await commitRequested;
  await expect(toolbar).toContainText("a.txt");
  expect(await appearance()).toEqual(initial);
  await page.getByRole("option").filter({ hasText: "Commit 1" }).click();
  releaseCommit();
  await expect(toolbar).toContainText("a.txt");
  await page.getByRole("option").filter({ hasText: "Commit 2" }).click();
  await expect(toolbar).toContainText("c.txt");
  const firstFile = page.locator('.tree-item-select[data-path="c.txt"]');
  await firstFile.click();
  const fileRequested = page.waitForRequest((request) =>
    request.url().includes("path=d.txt"),
  );
  await page.keyboard.press("ArrowDown");
  await fileRequested;
  await expect(toolbar).toContainText("c.txt");
  expect(await appearance()).toEqual(initial);
  await page.keyboard.press("ArrowUp");
  const lateFile = page.waitForResponse((response) =>
    response.url().includes("path=d.txt"),
  );
  releaseFile();
  await lateFile;
  await expect(page.locator(".diff-pane")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(toolbar).toContainText("c.txt");
  await page.keyboard.press("ArrowDown");
  await expect(toolbar).toContainText("d.txt");
  await page.keyboard.press("ArrowUp");
  await expect(toolbar).toContainText("c.txt");
  expect(await appearance()).toEqual(initial);
  for (const node of nodes)
    expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
  await page
    .locator(".workspace-tabs")
    .getByRole("button", { name: "Commit", exact: true })
    .click();
  const details = await page.locator(".commit-details").elementHandle();
  await page.getByRole("option").filter({ hasText: "Commit 1" }).click();
  await expect(
    page
      .locator(".workspace-tabs")
      .getByRole("button", { name: "Commit", exact: true }),
  ).toHaveClass("selected");
  await expect(page.locator(".commit-details")).toContainText("Commit 1");
  expect(await details!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
