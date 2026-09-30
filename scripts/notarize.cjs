const { execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

module.exports = async (context) => {
  if (context.electronPlatformName !== "darwin") return;
  const key = process.env.DONKEY_DIFF_NOTARY_KEY_FILE;
  const keyId = process.env.DONKEY_DIFF_NOTARY_KEY_ID;
  const issuer = process.env.DONKEY_DIFF_NOTARY_ISSUER_ID;
  if (!key || !keyId || !issuer) throw new Error("Notarization credentials are required for release builds.");
  const bundle = path.join(context.appOutDir, context.packager.appInfo.productFilename + ".app");
  execFileSync("codesign", ["--verify", "--deep", "--strict", bundle], { stdio: "inherit" });
  const temporary = mkdtempSync(path.join(tmpdir(), "donkey-diff-notarize-"));
  try {
    const archive = path.join(temporary, "Donkey-Diff.zip");
    execFileSync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", bundle, archive]);
    const result = JSON.parse(execFileSync("xcrun", [
      "notarytool", "submit", archive, "--key", key, "--key-id", keyId,
      "--issuer", issuer, "--wait", "--timeout", "20m", "--output-format", "json",
    ], { encoding: "utf8", timeout: 25 * 60 * 1000 }));
    if (result.status !== "Accepted") throw new Error("Apple notarization was not accepted: " + result.status);
    execFileSync("xcrun", ["stapler", "staple", bundle], { stdio: "inherit" });
    execFileSync("xcrun", ["stapler", "validate", bundle], { stdio: "inherit" });
    execFileSync("spctl", ["--assess", "--type", "execute", "--verbose=2", bundle], { stdio: "inherit" });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
};
