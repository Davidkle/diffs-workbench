const { test } = require("node:test");
const assert = require("node:assert/strict");
const { appEnvironment } = require("./environment.cjs");
const devBuild = require("./electron-builder.dev.cjs");

test("source and packaged development apps are isolated from production", () => {
  const appData = "/Users/test/Library/Application Support";
  const production = appEnvironment({ isPackaged: true, appData });
  const source = appEnvironment({ isPackaged: false, appData });
  const packagedDev = appEnvironment({
    isPackaged: true,
    channel: devBuild.extraMetadata.donkeyDiffChannel,
    appData,
  });
  assert.deepEqual(source, packagedDev);
  for (const property of ["name", "appId", "userData", "port", "icon"]) {
    assert.notEqual(source[property], production[property], property);
  }
  assert.equal(production.userData, `${appData}/Donkey Diff`);
  assert.equal(production.port, 43129);
  assert.equal(source.productionServices, false);
  assert.equal(production.productionServices, true);
  assert.equal(devBuild.appId, source.appId);
  assert.equal(devBuild.productName, source.name);
  assert.equal(devBuild.afterPack, null);
  assert.deepEqual(devBuild.extraResources, []);
});
