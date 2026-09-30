---
name: code-review
description: Review this repository's changes for actionable bugs, regressions, and missing validation.
---

Review the changes the user identifies. If no range is specified, inspect staged and unstaged changes, including relevant untracked source files. If there are no local changes, ask which commit or branch to review.

Check the surrounding code and call sites before reporting a problem. In this workbench, pay particular attention to project and worktree isolation, Git actions, bridge authentication, stale asynchronous responses, and preserving navigation and editor state.

Report actionable findings in severity order, with file paths, line numbers, a concrete failure scenario, and a suggested fix. If no issues are found, say so and identify material verification gaps. Run relevant existing checks when useful. Do not modify files, stage changes, or create commits unless the user asks for fixes.
