# Donkey Diff releases and telemetry

## Daily builds

The Daily Donkey Diff build workflow runs at 18:00 UTC (03:00 Asia/Seoul) and can be dispatched manually from main.

Each run checks types, lints, runs tests, builds an Apple Silicon app, Developer ID signs it, submits it to Apple for notarization, staples and validates the ticket, then signs its Sparkle update archive. Failed signing or notarization stops publication. The local package:mac command creates an unsigned production-named build for testing; use scripts/release-config.cjs for signed distribution. The separate package:mac:dev command creates the isolated red-logo dev app.

Versions use the package major/minor and package patch plus the workflow run number. Releases have immutable numeric tags, a DMG installer, a ZIP for automatic updates, SHA-256 checksums, and appcast.xml. The updater reads the appcast asset from the latest release; each enclosure points to its immutable numeric release tag. Re-running an already published version does not overwrite it.

The current build targets Apple Silicon only. The DMG contains Donkey Diff.app and an Applications shortcut; users drag the app into Applications. The ZIP is retained for Sparkle updates.

## Required GitHub Actions secrets

Configure these on DonkeyCut/donkey-diff. Never commit private keys or certificate exports.

| Secret | Value |
| --- | --- |
| DONKEY_DIFF_SIGN_IDENTITY | Developer ID Application: David Le (Q593LLEXEN) |
| DONKEY_DIFF_DEVELOPER_ID_CERT_P12 | Base64-encoded Developer ID certificate and private key exported as P12 |
| DONKEY_DIFF_DEVELOPER_ID_CERT_PASSWORD | Password protecting that P12 |
| DONKEY_DIFF_NOTARY_KEY_P8 | Base64-encoded App Store Connect API private key |
| DONKEY_DIFF_NOTARY_KEY_ID | Corresponding Apple key ID |
| DONKEY_DIFF_NOTARY_ISSUER_ID | Corresponding Apple issuer ID |
| DONKEY_DIFF_SPARKLE_PUBLIC_ED_KEY | Public key for Donkey Diff's Sparkle signing keypair |
| DONKEY_DIFF_SPARKLE_PRIVATE_ED_KEY | Sparkle private key export as plain text |
| DONKEY_DIFF_POSTHOG_KEY | PostHog public project ingestion token, never a personal API key |
| DONKEY_DIFF_POSTHOG_HOST | PostHog ingestion host; local setup uses https://e.donkeycut.com |

Apple signing and notarization credentials are configured in this repository's Actions secrets. Donkey Diff has its own Sparkle signing keypair; its public verification key is also recorded in desktop/sparkle/config.json. Keep that keypair stable after distribution.

CI imports credentials into an ephemeral keychain and temporary files, removes them after the run, and never includes them in artifacts. Only the public PostHog ingestion token/host and public Sparkle verification key enter the shipped app.

## Basic telemetry

Copy .env.example to .env.local for local packaging. .env.local is ignored by Git. Packaging writes only DONKEY_DIFF_POSTHOG_KEY and DONKEY_DIFF_POSTHOG_HOST into telemetry-config.json in the app resources.

Explicit native events are donkey_diff_app_opened, donkey_diff_project_added, donkey_diff_project_removed, and donkey_diff_update_requested. Properties are a random installation identifier, app/version, OS, and CPU architecture. Repository names, paths, source code, file contents, Git messages, usernames, and raw errors are never added. Person-profile processing and GeoIP enrichment are disabled. There is no autocapture, session recording, or browser-page capture. Unpackaged development runs do not send events. Failed analytics requests do not interrupt app operations.

Users can disable collection from Privacy > Send Anonymous Usage Statistics. The preference and random identifier persist in the app's user-data directory. The existing Donkey Cut PostHog project is used because its current plan does not allow creating another project; the donkey_diff_ event prefix separates this app.

## Release verification

The first signed release, v0.1.17, was published on September 30, 2026 after type checks, lint, tests, signing, Apple notarization, and staple validation passed. The published DMG and ZIP checksums, app identity, Gatekeeper acceptance, stapled ticket, and Sparkle update signature were also verified after download.

An end-to-end Sparkle installation between two signed versions and live PostHog event delivery remain separate checks. Analytics requires the optional PostHog secrets above.
