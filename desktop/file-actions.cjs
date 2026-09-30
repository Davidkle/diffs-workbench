const path = require("node:path");
const { realpath } = require("node:fs/promises");

async function resolveProjectFile(projects, projectId, relativePath) {
  const project = projects.find((entry) => entry.id === projectId);
  if (
    !project ||
    typeof relativePath !== "string" ||
    !relativePath ||
    path.isAbsolute(relativePath) ||
    relativePath.split(/[\\/]/).some((part) => part === ".." || part === ".git")
  )
    throw new Error("Select a file inside an open project.");
  const root = await realpath(project.path);
  const target = await realpath(path.resolve(root, relativePath));
  if (target !== root && !target.startsWith(root + path.sep))
    throw new Error("The selected path is outside this project.");
  return target;
}
module.exports = { resolveProjectFile };
