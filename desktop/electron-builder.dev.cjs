const { build } = require("../package.json");

module.exports = {
  ...build,
  extends: null,
  appId: "com.davidkle.donkeydiff.dev",
  productName: "Donkey Diff Dev",
  directories: { output: "release/dev" },
  extraMetadata: {
    name: "donkey-diff-dev",
    donkeyDiffChannel: "development",
  },
  mac: { ...build.mac, icon: "desktop/assets/icon-dev.icns", target: ["dir"] },
  afterPack: null,
  extraResources: [],
};
