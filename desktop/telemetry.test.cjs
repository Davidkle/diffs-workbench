const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, writeFile, rm } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createTelemetry } = require("./telemetry.cjs");

test("telemetry sends only approved metadata and respects persisted opt-out", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "donkey-diff-telemetry-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, "telemetry-config.json"), JSON.stringify({ key: "phc_test", host: "https://example.test" }));
  const requests = [];
  const options = { dataDir: dir, resourcesPath: dir, version: "0.1.8", packaged: true,
    fetchImpl: async (url, init) => { requests.push({ url, body: JSON.parse(init.body) }); return { ok: true }; },
  };
  const telemetry = await createTelemetry(options);
  assert.equal(await telemetry.capture("project_added"), true);
  assert.equal(await telemetry.capture("/Users/private/repository"), false);
  assert.equal(requests.length, 1);
  const { body } = requests[0];
  assert.equal(body.event, "donkey_diff_project_added");
  assert.deepEqual(Object.keys(body.properties).sort(), ["$geoip_disable", "$process_person_profile", "app", "app_version", "architecture", "distinct_id", "platform"].sort());
  assert.equal(body.properties.$geoip_disable, true);
  assert.equal(body.properties.$process_person_profile, false);
  await telemetry.setEnabled(false);
  assert.equal(await telemetry.capture("app_opened"), false);
  const restarted = await createTelemetry(options);
  assert.equal(restarted.isEnabled(), false);
  assert.equal(await restarted.capture("app_opened"), false);
  await restarted.setEnabled(true);
  await restarted.capture("app_opened");
  assert.equal(requests[1].body.properties.distinct_id, body.properties.distinct_id);
  const development = await createTelemetry({ ...options, packaged: false });
  assert.equal(await development.capture("app_opened"), false);
  const offline = await createTelemetry({ ...options, fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(await offline.capture("app_opened"), false);
});
