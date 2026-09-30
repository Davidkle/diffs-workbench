import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const config = require("../desktop/sparkle/config.json");
export const sparkleDirectory = path.join(root, ".cache", "sparkle");
export function prepareSparkle() {
  if (process.platform !== "darwin")
    throw new Error("Sparkle builds require macOS.");
  mkdirSync(sparkleDirectory, { recursive: true });
  const archive = path.join(
    sparkleDirectory,
    `Sparkle-${config.version}.tar.xz`,
  );
  if (!existsSync(archive)) {
    execFileSync(
      "curl",
      [
        "--fail",
        "--location",
        "--output",
        archive,
        `https://github.com/sparkle-project/Sparkle/releases/download/${config.version}/Sparkle-${config.version}.tar.xz`,
      ],
      { stdio: "inherit" },
    );
  }
  const checksum = createHash("sha256")
    .update(readFileSync(archive))
    .digest("hex");
  if (checksum !== config.sha256)
    throw new Error(
      "Sparkle archive checksum does not match the pinned release.",
    );
  if (!existsSync(path.join(sparkleDirectory, "Sparkle.framework"))) {
    execFileSync("tar", ["-xf", archive, "-C", sparkleDirectory], {
      stdio: "inherit",
    });
  }
  return sparkleDirectory;
}
export function buildSparkle(arch = process.arch) {
  const frameworkDir = prepareSparkle();
  mkdirSync(path.join(root, "build"), { recursive: true });
  execFileSync(
    "xcrun",
    [
      "clang++",
      "-std=c++17",
      "-fobjc-arc",
      "-fblocks",
      "-bundle",
      "-undefined",
      "dynamic_lookup",
      "-DNAPI_VERSION=8",
      "-mmacosx-version-min=12.0",
      "-arch",
      arch === "arm64" ? "arm64" : "x86_64",
      "-I",
      require("node-api-headers").include_dir,
      "-F",
      frameworkDir,
      "-framework",
      "Cocoa",
      "-framework",
      "Sparkle",
      "-Wl,-rpath,@loader_path/../Frameworks",
      path.join(root, "desktop/sparkle/updater.mm"),
      "-o",
      path.join(root, "build/sparkle.node"),
    ],
    { stdio: "inherit" },
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  buildSparkle();
