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

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => console.error(error.message));
  await page.route("**/tree-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { FileTree } = await import('/src/components/FileTree.tsx');
      const { Sidebar } = await import('/src/components/Sidebar.tsx');
      await import('/src/styles.css');
      const h = React.createElement;
      function Fixture() {
        const [selected, setSelected] = React.useState('src/a.ts');
        const [filter, setFilter] = React.useState('');
        const [staged, setStaged] = React.useState(0);
        const [view, setView] = React.useState('changes');
        const [open, setOpen] = React.useState(true);
        const [actions, setActions] = React.useState(0);
        return h('div', null,
          h(Sidebar, null,
            h('nav', { className: 'primary-nav' },
              h('button', { onClick: () => setView('changes') }, 'Local Changes'),
              h('button', { onClick: () => setView('history') }, 'All Commits')),
            h('div', { className: 'sidebar-filter' }, h('input', { 'aria-label': 'Search sidebar' })),
            h('div', { className: 'section-header' }, h('button', { onClick: () => setOpen(!open), 'aria-expanded': open }, 'Branches')),
            open && h('button', { className: 'nav-row', onClick: () => setActions(value => value + 1) }, 'main'),
            h('div', { className: 'nav-row', tabIndex: 0 }, 'v1.0')),
          h('output', { 'aria-label': 'View' }, view),
          h('output', { 'aria-label': 'Repository actions' }, actions),
          h('input', { 'aria-label': 'Filter', value: filter, onChange: e => setFilter(e.target.value) }),
          h('output', { 'aria-label': 'Stage calls' }, staged),
          h('div', { style: { width: 300, height: 120, overflow: 'auto' } },
            h(FileTree, {
              projectId: 'keyboard-test', selected, onSelect: setSelected, filter,
              files: ['src/a.ts', 'src/b.ts', 'z.ts'].map(path => ({ path, status: 'M', staged: false })),
              onDoubleClick: () => setStaged(value => value + 1),
              contextActions: () => [{ label: 'Stage', onSelect: () => setStaged(value => value + 1) }, { label: 'Copy path', onSelect: () => {} }],
            })));
      }
      ReactDOM.createRoot(document.getElementById('root')).render(h(Fixture));
    </script></body></html>`,
    }),
  );
  await page.goto(`${origin}tree-test`);
  await expect(page.getByRole("tree")).toBeVisible();
});

test("arrows select visible rows without staging or expanding folders", async ({
  page,
}) => {
  const selected = page.locator(".tree-row.selected .tree-item-select");
  await page.getByTitle("src/a.ts", { exact: true }).click();
  await page.keyboard.press("ArrowDown");
  await expect(selected).toHaveAttribute("title", "src/b.ts");
  await expect(selected).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(selected).toHaveAttribute("title", "src/a.ts");
  await page.getByRole("button", { name: "Collapse src", exact: true }).click();
  await page.keyboard.press("ArrowDown");
  await expect(selected).toHaveAttribute("title", "z.ts");
  await page.keyboard.press("ArrowDown");
  await expect(selected).toHaveAttribute("title", "z.ts");
  await page.keyboard.press("ArrowUp");
  await expect(selected).toHaveAttribute("title", "src");
  await expect(page.getByTitle("src/a.ts", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Stage calls")).toHaveText("0");
  await expect(selected).toHaveCSS("outline-style", "none");
  await expect(page.locator(".tree-row.selected")).toHaveCSS("height", "24px");
  await selected.dblclick();
  await expect(page.getByLabel("Stage calls")).toHaveText("1");
  await expect(page.getByTitle("src/a.ts", { exact: true })).toHaveCount(0);
});

test("filtering limits navigation and menu arrows do not change selection", async ({
  page,
}) => {
  await page.getByLabel("Filter").fill("b.ts");
  await page.getByTitle("src", { exact: true }).click();
  await page.keyboard.press("ArrowDown");
  const selected = page.locator(".tree-row.selected .tree-item-select");
  await expect(selected).toHaveAttribute("title", "src/b.ts");
  await page.keyboard.press("ArrowDown");
  await expect(selected).toHaveAttribute("title", "src/b.ts");
  await selected.click({ button: "right" });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(selected).toHaveAttribute("title", "src/b.ts");
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByLabel("Stage calls")).toHaveText("0");
});

test("sidebar arrows navigate views and rows without running repository actions", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Local Changes", exact: true })
    .click();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("button", { name: "All Commits", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("View", { exact: true })).toHaveText("history");
  await page.keyboard.press("ArrowUp");
  await expect(page.getByLabel("View", { exact: true })).toHaveText("changes");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByLabel("Search sidebar")).toBeFocused();
  await page.keyboard.type("main");
  await page.keyboard.press("Home");
  await expect(page.getByLabel("Search sidebar")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("button", { name: "Branches", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("button", { name: "main", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Repository actions")).toHaveText("0");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Repository actions")).toHaveText("1");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByText("v1.0", { exact: true })).toBeFocused();
  await expect(page.getByText("v1.0", { exact: true })).toHaveCSS(
    "outline-style",
    "none",
  );
});
