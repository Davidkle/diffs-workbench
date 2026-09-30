import { createHash } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { ChatSkill } from "../src/chat-types.js";

const roots = [
  ".agents/skills",
  ".claude/skills",
  ".codex/skills",
  ".donkey-diff/skills",
];
async function skillFile(root: string, relative: string) {
  const resolved = await realpath(path.join(root, relative));
  if (!resolved.startsWith(root + path.sep))
    throw new Error("Skill must be inside this project");
  if ((await stat(resolved)).size > 100_000)
    throw new Error("Skill is too large (maximum 100 KB)");
  return { resolved, text: await readFile(resolved, "utf8") };
}
export async function discoverSkills(cwd: string): Promise<ChatSkill[]> {
  const root = await realpath(cwd);
  const result: ChatSkill[] = [];
  const names = new Set<string>();
  for (const folder of roots) {
    const dirs = await readdir(path.join(root, folder), {
      withFileTypes: true,
    }).catch(() => []);
    for (const dir of dirs.slice(0, 200)) {
      if (!dir.isDirectory()) continue;
      const relative = `${folder}/${dir.name}/SKILL.md`;
      try {
        const { text } = await skillFile(root, relative);
        const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] || "";
        const field = (key: string) =>
          new RegExp(`^${key}:\\s*(.+)$`, "m")
            .exec(frontmatter)?.[1]
            ?.trim()
            .replace(/^["']|["']$/g, "");
        const name = field("name") || dir.name;
        if (names.has(name)) continue;
        names.add(name);
        result.push({
          id: createHash("sha256").update(relative).digest("hex").slice(0, 16),
          name,
          description: field("description") || "Repository skill",
          path: relative,
        });
      } catch {
        /* Missing, oversized or external skill; leave it out of discovery. */
      }
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}
export async function expandSkill(cwd: string, text: string, skillId?: string) {
  const skills = await discoverSkills(cwd);
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[-_]+/g, " ");
  const skill = skillId
    ? skills.find((s) => s.id === skillId)
    : skills
        .slice()
        .sort((a, b) => b.name.length - a.name.length)
        .find((s) => {
          const input = normalize(text.trim());
          const command = `/${normalize(s.name)}`;
          return (
            input === command ||
            input.startsWith(command + " ") ||
            input.startsWith(command + "\n")
          );
        });
  if (skillId && !skill)
    throw new Error("This skill is no longer available. Choose it again.");
  if (!skill) return text;
  const { resolved, text: instructions } = await skillFile(
    await realpath(cwd),
    skill.path,
  );
  return `The user explicitly invoked the repository skill ${skill.name}. Follow the skill for this request. Resolve its relative references against ${path.dirname(resolved)}.\n\n<invoked_skill path=${JSON.stringify(resolved)}>\n${instructions}\n</invoked_skill>\n\nUser request:\n${text}`;
}
