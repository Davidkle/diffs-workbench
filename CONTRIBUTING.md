# Contributing

1. Fork this repository and create a branch.
2. Install with `npm ci` and run the interface with `npm run dev`.
3. Use a disposable Git repository when testing destructive Git operations.
4. Run `npm test` and `npm run build` before submitting a pull request.

Keep browser networking in `src/api-clients`, validate all bridge inputs, and use argument arrays rather than shell interpolation for Git commands. Changes must preserve loopback-only binding, exact-origin checks, bearer authentication, and safe Git defaults. Never commit pairing keys, local project paths, credentials, or fixture repositories.

For UI changes, check desktop and narrow mobile layouts and keyboard accessibility. Explain the user-visible change and how you verified it in your pull request.
