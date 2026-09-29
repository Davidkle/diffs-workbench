# Diffs Workbench

An open-source, local-first Git workbench with a desktop-style interface. Review code with [Pierre's Diffs](https://diffs.com), switch between projects, and manage your local Git workflow in a Mac app or browser.

**[Download for Mac](https://github.com/Davidkle/diffs-workbench/releases/latest)** · [Web preview](https://diffs-workbench.vercel.app) · [MIT license](LICENSE)

## Get started on Mac

1. Download the Apple Silicon Mac app from Releases and unzip it.
2. Open **Diffs**.
3. Click **Choose folder** and select a Git project.

The app starts its local service automatically and remembers your projects. No Node.js installation, terminal, pairing key, or browser permissions are needed. Git must be installed; push and pull use your existing Git credentials.

The first release is unsigned and not notarized by Apple, so macOS may block a downloaded copy. A Developer ID signed release is still needed for a warning-free public installation.

## Features

- Multiple local repositories in separate tabs
- Working-tree changes, full-file context, unified/split diffs, line wrapping, and syntax highlighting
- Hierarchical changed-file tree, file filtering, and complete repository file browsing
- Recent commit history (latest 150 commits), commit details, and historical file diffs
- Multi-select commits with Shift-click or Cmd/Ctrl-click; select two to compare their snapshots
- Resizable sidebar, commit history, and file tree with saved panel sizes
- Create, switch, rename, and safely delete local branches
- Create, open, move, and safely remove worktrees
- Fetch, fast-forward pull, push to origin, and optional automatic sync
- Stash tracked and untracked changes; apply, pop, or delete stashes
- Side-by-side conflict versions and an editable resolution, saved and staged locally
- Commit all current changes with a message
- Responsive desktop and mobile layouts

## Browser setup (advanced)

A hosted website cannot directly access your computer's Git repositories. The Vercel deployment serves only the interface; a small authenticated service on **127.0.0.1:43127** runs Git locally. Your source code is sent directly from that service to your browser, never through a Vercel API or cloud database.

Requirements: **Node.js 22.12+** and **Git**. Remote operations use your existing local Git credentials / SSH agent. Authentication prompts are disabled in the bridge; authenticate in your terminal first if needed.

```sh
git clone https://github.com/Davidkle/diffs-workbench.git
cd diffs-workbench
npm ci
npm run bridge -- /absolute/path/to/your/repository
```

Keep that terminal running, open **https://diffs-workbench.vercel.app**, and click **Connect → Pair with local bridge**. Allow local network access if your browser asks. The pairing key is stored only in this browser tab's session storage. Re-pair after starting a new browser session.

Add more projects with **Open** and their absolute local paths. Closing a project tab does not delete its repository. You can also explicitly scan a projects directory at startup:

```sh
npm run bridge -- --root /absolute/path/to/projects
```

The scan registers immediate subdirectories containing Git repositories. Use it only for directories you intend to expose to your paired app.

If your browser blocks hosted-to-local requests, run the interface locally:

```sh
npm run dev
# Open http://127.0.0.1:5173 and pair there.
```

### Sync behavior

The active repository refreshes every 10 seconds while visible. With **Auto sync** enabled, it also fetches on project entry, browser focus, and every 60 seconds. It pulls only when the worktree is clean and an upstream exists, using `git pull --ff-only`. Divergence, authentication errors, or dirty files are reported in the status bar. Sync never force-pushes, resets, auto-stashes, or creates merge commits.

Remote commands use a 60-second timeout. Push uses `origin` and sets the current branch's upstream. Configure remotes in your terminal.

### Bridge configuration

| Variable                | Default                              | Purpose                                               |
| ----------------------- | ------------------------------------ | ----------------------------------------------------- |
| `DIFFS_DATA_DIR`        | `~/.diffs-workbench`                 | Private token and registered project paths            |
| `DIFFS_ALLOWED_ORIGINS` | `https://diffs-workbench.vercel.app` | Comma-separated production origins                    |
| `DIFFS_PORT`            | `43127`                              | Bridge port (the frontend currently uses the default) |

Local Vite origins on ports 5173 and 4173 are allowed for development. Pairing accepts only configured origins. The service binds to loopback, validates the Host header and Origin, authenticates API requests with a random bearer token, and serializes mutations per repository. Tokens and project paths are excluded from Git. Stop the bridge to revoke access; delete its token file while stopped to rotate the key.

Only pair with a deployment you trust: the paired interface can read and modify registered repositories, and add repositories accessible to your OS account. Git hooks and configured remote helpers run as part of normal Git operations. Do not register untrusted repositories.

## Development

```sh
npm ci
npm run bridge -- /absolute/path/to/repo
npm run dev
# Or run the desktop app:
npm run desktop
# Build the Apple Silicon Mac app:
npm run package:mac
npm run ts-check
npm run lint
npm test
npm run build
```

Stack: React 19, TypeScript, Vite, Tailwind CSS 4, shadcn-style components built with Radix primitives, Express, Zod, and `@pierre/diffs`.

- `src/` — browser app, central API client, components, and styles
- `desktop/` — Electron app, native folder picker, and restricted IPC
- `bridge/` — local HTTP service and Git operations
- `bridge/*.test.ts` — real temporary-repository integration tests

## Deployment

```sh
npx vercel --prod
```

Vercel hosts the static `dist/` directory. The bridge is **not** deployed as a serverless function. For a fork/custom domain, set `DIFFS_ALLOWED_ORIGINS` to that deployment's exact origin when starting your bridge. The root page is a clearly labeled example until paired.

## Scope and limitations

- Text files up to 5 MB; binary files display a notice. Symlink file content is not followed.
- History is limited to the newest 150 commits. Git submodule contents are separate repositories.
- Conflict controls choose entire current/incoming versions or let you manually edit a resolution; finish the merge with a commit.
- Worktree and branch deletion use Git's safety checks (no force deletion).
- The Mac app includes the local service. Browser filesystem access requires the bridge on the same computer. A phone can view the responsive preview but cannot access another computer's loopback service.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and improvements are welcome.

## License and credits

MIT © 2026 David Le. Diff rendering by [The Pierre Computer Company](https://diffs.com); icons by [Lucide](https://lucide.dev). The project is independent of Pierre and Vercel.
