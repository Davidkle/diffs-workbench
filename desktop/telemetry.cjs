const { readFile, writeFile, mkdir } = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const allowedEvents = new Set([
  "app_opened",
  "project_added",
  "project_removed",
  "update_requested",
]);

async function createTelemetry({ dataDir, resourcesPath, version, packaged, fetchImpl = fetch }) {
  const statePath = path.join(dataDir, "telemetry.json");
  let config = {};
  try {
    config = JSON.parse(await readFile(path.join(resourcesPath, "telemetry-config.json"), "utf8"));
  } catch { /* Analytics is optional in local builds. */ }
  const key = process.env.DONKEY_DIFF_POSTHOG_KEY || config.key;
  const host = process.env.DONKEY_DIFF_POSTHOG_HOST || config.host;
  let state;
  try {
    state = JSON.parse(await readFile(statePath, "utf8"));
  } catch { /* First launch. */ }
  state = {
    distinctId: typeof state?.distinctId === "string" ? state.distinctId : randomUUID(),
    enabled: state?.enabled !== false,
  };
  const save = async () => {
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
  };
  try { await save(); } catch { state.enabled = false; }
  let endpoint;
  try {
    const url = new URL("/capture/", host);
    if (url.protocol === "https:") endpoint = url.href;
  } catch { /* Missing or invalid endpoint disables telemetry. */ }
  return {
    isEnabled: () => state.enabled,
    async setEnabled(enabled) {
      state.enabled = Boolean(enabled);
      await save();
    },
    async capture(event) {
      if (!packaged || !state.enabled || !key || !endpoint || !allowedEvents.has(event)) return false;
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: key,
            event: "donkey_diff_" + event,
            properties: {
              distinct_id: state.distinctId,
              app: "donkey_diff",
              app_version: version,
              platform: process.platform,
              architecture: process.arch,
              $process_person_profile: false,
              $geoip_disable: true,
            },
          }),
          signal: AbortSignal.timeout(5000),
        });
        return response.ok;
      } catch { return false; }
    },
  };
}
module.exports = { createTelemetry };
