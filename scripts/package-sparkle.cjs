const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const localEnv = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(localEnv)) process.loadEnvFile(localEnv);
const config = require("../desktop/sparkle/config.json");

module.exports = async (context) => {
  if (context.electronPlatformName !== "darwin") return;
  const bundle = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  const telemetryConfig = {
    key: process.env.DONKEY_DIFF_POSTHOG_KEY || "",
    host: process.env.DONKEY_DIFF_POSTHOG_HOST || "https://us.i.posthog.com",
  };
  fs.writeFileSync(path.join(bundle, "Contents/Resources/telemetry-config.json"), JSON.stringify(telemetryConfig));
  const source = path.resolve(__dirname, "../.cache/sparkle/Sparkle.framework");
  execFileSync("ditto", [
    source,
    path.join(bundle, "Contents/Frameworks/Sparkle.framework"),
  ]);
  const plist = path.join(bundle, "Contents/Info.plist");
  const feed = process.env.DONKEY_DIFF_SPARKLE_FEED_URL || config.feedURL;
  const key = process.env.DONKEY_DIFF_SPARKLE_PUBLIC_ED_KEY || config.publicKey;
  if (!/^https:\/\//.test(feed) && !feed.startsWith("file://"))
    throw new Error(
      "Sparkle feed must use HTTPS (or file:// for local tests).",
    );
  for (const [name, type, value] of [
    ["SUFeedURL", "string", feed],
    ["SUPublicEDKey", "string", key],
    ["SUEnableAutomaticChecks", "bool", "true"],
    ["SUAutomaticallyUpdate", "bool", "false"],
    ["SUAllowsAutomaticUpdates", "bool", "false"],
    ["SUSendProfileInfo", "bool", "false"],
    ["SUScheduledCheckInterval", "integer", "3600"],
  ]) {
    execFileSync("/usr/bin/plutil", [
      "-insert",
      name,
      `-${type}`,
      value,
      plist,
    ]);
  }
};
