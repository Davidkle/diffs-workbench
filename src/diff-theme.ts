import { registerCustomTheme, resolveTheme } from "@pierre/diffs";

export const DIFF_THEME = "donkey-diff-dark";

// The base theme's muted tokens were designed for a near-black canvas.
// Lift them so comments and punctuation remain legible on our diff colors.
const readableGrays: Record<string, string> = {
  "#636363": "#c9cdd1",
  "#737373": "#c9cdd1",
  "#a3a3a3": "#d0d3d6",
};

registerCustomTheme(DIFF_THEME, async () => {
  const base = await resolveTheme("pierre-dark");
  return {
    ...base,
    name: DIFF_THEME,
    displayName: "Donkey Diff Dark",
    settings: base.settings.map((token) => ({
      ...token,
      settings: {
        ...token.settings,
        foreground:
          readableGrays[token.settings.foreground?.toLowerCase() ?? ""] ??
          token.settings.foreground,
      },
    })),
  };
});
