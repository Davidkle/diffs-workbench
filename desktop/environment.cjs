const path = require("node:path");

function appEnvironment({ isPackaged, channel, appData }) {
  const development = !isPackaged || channel === "development";
  const name = development ? "Donkey Diff Dev" : "Donkey Diff";
  return {
    development,
    name,
    appId: development
      ? "com.davidkle.donkeydiff.dev"
      : "com.davidkle.donkeydiff",
    userData: path.join(appData, name),
    port: development ? 43130 : 43129,
    icon: development ? "icon-dev.png" : "icon.png",
    productionServices: isPackaged && !development,
  };
}

module.exports = { appEnvironment };
