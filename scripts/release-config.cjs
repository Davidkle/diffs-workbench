const base = require("../package.json").build;
const identity = process.env.DONKEY_DIFF_SIGN_IDENTITY;
if (!identity || !identity.startsWith("Developer ID Application:"))
  throw new Error("A Developer ID Application identity is required for releases.");
if (!process.env.DONKEY_DIFF_SPARKLE_PUBLIC_ED_KEY)
  throw new Error("A Sparkle public key is required for releases.");
module.exports = {
  ...base,
  forceCodeSigning: true,
  afterSign: "scripts/notarize.cjs",
  mac: {
    ...base.mac,
    // electron-builder selects the Developer ID certificate type itself.
    identity: identity.replace(/^Developer ID Application:\s*/, ""),
    hardenedRuntime: true,
    entitlements: "desktop/entitlements.mac.plist",
    entitlementsInherit: "desktop/entitlements.mac.plist",
  },
};
