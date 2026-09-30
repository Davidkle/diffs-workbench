import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareSparkle } from "./build-sparkle.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(readFileSync(path.join(root, "desktop/sparkle/config.json"), "utf8"));
const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const publicKey = process.env.DONKEY_DIFF_SPARKLE_PUBLIC_ED_KEY || config.publicKey;
if (!publicKey || Buffer.from(publicKey, "base64").length !== 32)
  throw new Error("Configure the Sparkle public verification key before preparing an update.");
const tools = prepareSparkle();
const directory = mkdtempSync(path.join(tmpdir(), "donkey-diff-update-"));
try {
  const archive = `Donkey-Diff-${version}-arm64.zip`;
  copyFileSync(path.join(root, "release", archive), path.join(directory, archive));
  const args = [
    "--account", config.keychainAccount,
    "--download-url-prefix", `https://github.com/DonkeyCut/donkey-diff/releases/download/v${version}/`,
    "--link", "https://github.com/DonkeyCut/donkey-diff",
    "--maximum-deltas", "0",
    "--maximum-versions", "1",
  ];
  if (process.env.DONKEY_DIFF_SPARKLE_PRIVATE_KEY_FILE)
    args.push("--ed-key-file", process.env.DONKEY_DIFF_SPARKLE_PRIVATE_KEY_FILE);
  execFileSync(path.join(tools, "bin/generate_appcast"), [...args, directory], { stdio: "inherit" });
  const feed = path.join(directory, "appcast.xml");
  if (!readFileSync(feed, "utf8").includes("sparkle:edSignature="))
    throw new Error("Sparkle did not produce a signed update enclosure.");
  copyFileSync(feed, path.join(root, "appcast.xml"));
  console.log(`Prepared appcast.xml for v${version}. Nothing was published.`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
