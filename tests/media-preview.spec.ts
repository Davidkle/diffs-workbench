import { expect, test, type Page } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import { fileContent } from "../bridge/git";
import type { FileContent } from "../src/types";

let server: ViteDevServer;
let origin: string;
let poster: FileContent;
let video: FileContent;
test.beforeAll(async () => {
  server = await createServer({
    server: { host: "127.0.0.1", port: 0, hmr: false },
  });
  await server.listen();
  origin = server.resolvedUrls!.local[0];
  poster = await fileContent(process.cwd(), "docs/poster.jpg");
  video = await fileContent(process.cwd(), "docs/demo.mp4");
});
test.afterAll(async () => {
  await server?.close();
});

async function mount(page: Page, content: FileContent, fileMode = false) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/media-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="root" style="height:100vh;display:flex"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { DiffPane } = await import('/src/components/DiffPane.tsx');
      await import('/src/styles.css');
      window.renderContent = (content, fileMode) => root.render(React.createElement(DiffPane, {
        content, fileMode, loading: false, full: false, split: true,
        setFull: () => {}, setSplit: () => {}, onResolve: () => {}
      }));
      const root = ReactDOM.createRoot(document.getElementById('root'));
      window.renderContent(${JSON.stringify(content)}, ${fileMode});
    </script></body></html>`,
    }),
  );
  await page.goto(`${origin}media-test`);
  await expect(page.locator(".diff-pane")).toBeVisible();
  return errors;
}

test("actual poster renders both revisions, additions, deletions and file tree previews", async ({
  page,
}) => {
  const errors = await mount(page, poster);
  await expect(
    page.getByRole("img", { name: "Before: docs/poster.jpg" }),
  ).toBeVisible();
  const after = page.getByRole("img", { name: "After: docs/poster.jpg" });
  await expect(after).toBeVisible();
  await expect
    .poll(() => after.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  for (const label of [
    "Wrap lines",
    "Full file",
    "Toggle split diff",
    "Next change",
  ])
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toBeDisabled();
  await page.screenshot({ path: "test-results/media-image.png" });
  for (const [old, current, fileMode, label] of [
    ["", poster.current, false, "After"],
    [poster.old, "", false, "Before"],
    [poster.old, poster.current, true, "Preview"],
  ] as const) {
    await page.evaluate(
      ({ content, fileMode }) => {
        (
          window as unknown as {
            renderContent: (content: FileContent, fileMode: boolean) => void;
          }
        ).renderContent(content, fileMode);
      },
      { content: { ...poster, old, current }, fileMode },
    );
    await expect(page.locator(".media-preview img")).toHaveCount(1);
    await expect(page.locator(".media-preview img")).toHaveAttribute(
      "alt",
      `${label}: docs/poster.jpg`,
    );
  }
  expect(errors).toEqual([]);
});

test("actual MP4 loads and plays with native controls", async ({ page }) => {
  const errors = await mount(page, video, true);
  const player = page.locator("video");
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute("controls", "");
  await expect
    .poll(() =>
      player.evaluate((element: HTMLVideoElement) => element.videoWidth),
    )
    .toBeGreaterThan(0);
  await player.evaluate(async (element: HTMLVideoElement) => {
    element.muted = true;
    await element.play();
  });
  await expect
    .poll(() =>
      player.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(0);
  await player.evaluate((element: HTMLVideoElement) => element.pause());
  await page.screenshot({ path: "test-results/media-video.png" });
  expect(errors).toEqual([]);
});

test("audio loads and unsupported media has a readable fallback", async ({
  page,
}) => {
  const wav = Buffer.alloc(44 + 8000);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(8000, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(8000, 40);
  wav.fill(128, 44);
  const errors = await mount(
    page,
    {
      path: "sound.wav",
      old: "",
      current: `data:audio/wav;base64,${wav.toString("base64")}`,
      mediaType: "audio/wav",
      binary: true,
      conflict: false,
    },
    true,
  );
  await expect(page.locator("audio")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((element: HTMLAudioElement) => element.duration),
    )
    .toBe(1);
  await page.evaluate(() => {
    (
      window as unknown as {
        renderContent: (content: FileContent, fileMode: boolean) => void;
      }
    ).renderContent(
      {
        path: "broken.jpg",
        old: "",
        current: "data:image/jpeg;base64,YmFk",
        mediaType: "image/jpeg",
        binary: true,
        conflict: false,
      },
      true,
    );
  });
  await expect(
    page.getByText(
      "Unable to preview this media. The format may be unsupported.",
    ),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("unknown binaries keep their existing fallback", async ({ page }) => {
  await mount(page, {
    path: "archive.bin",
    old: "",
    current: "\0",
    binary: true,
    conflict: false,
  });
  await expect(
    page.getByRole("heading", { name: "Binary file" }),
  ).toBeVisible();
  await expect(page.getByLabel("Media preview")).toHaveCount(0);
});
