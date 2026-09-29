import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChangedFile, Commit, FileContent, Project, Snapshot, Worktree } from '../src/types.js';
const exec = promisify(execFile);
export async function git(cwd: string, args: string[]) {
  try { return (await exec('git', ['-c', 'core.quotepath=false', ...args], { cwd, maxBuffer: 20 * 1024 * 1024, timeout: 60000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })).stdout; }
  catch (error) { const e = error as Error & { stderr?: string }; throw new Error(e.stderr?.trim() || e.message); }
}
async function optional(cwd: string, args: string[], fallback = '') { try { return await git(cwd, args); } catch { return fallback; } }
export async function validateRepo(root: string) { const resolved = await realpath(root); return (await git(resolved, ['rev-parse', '--show-toplevel'])).trim(); }
export function parseStatus(raw: string): ChangedFile[] {
 const entries = raw.split('\0'); const files: ChangedFile[] = [];
 for (let i = 0; i < entries.length; i++) { const entry = entries[i]; if (!entry) continue; const xy = entry.slice(0, 2); const name = entry.slice(3); const oldPath = /[RC]/.test(xy) ? entries[++i] : undefined;
 files.push({ path: name, oldPath, status: xy === '??' ? 'A' : /U/.test(xy) || xy === 'AA' || xy === 'DD' ? 'U' : xy.includes('D') ? 'D' : xy.includes('A') ? 'A' : xy.includes('R') ? 'R' : 'M', staged: ![' ', '?'].includes(xy[0]), conflict: /U/.test(xy) || xy === 'AA' || xy === 'DD', additions: 0, deletions: 0 }); }
 return files;
}
export async function changedFiles(cwd: string, commit?: string): Promise<ChangedFile[]> {
 if (commit) { await validateCommit(cwd, commit); const raw = await git(cwd, ['diff-tree', '--root', '--no-commit-id', '--name-status', '-r', '-z', commit]); const parts = raw.split('\0'); const result: ChangedFile[] = []; for(let i=0;i<parts.length-1;i+=2) result.push({ path: parts[i+1], status: parts[i][0], staged: false, conflict: false, additions: 0, deletions: 0 }); return result; }
 const files = parseStatus(await git(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all']));
 const hasHead = await optional(cwd, ['rev-parse', '--verify', 'HEAD']);
 const stats = await optional(cwd, ['diff', '--numstat', ...(hasHead ? ['HEAD'] : []), '--']);
 for (const line of stats.trim().split('\n')) { const [add, del, ...names] = line.split('\t'); const file = files.find(f=> f.path === names.join('\t')); if(file){ file.additions = Number(add)||0; file.deletions = Number(del)||0; } }
 return files;
}
async function validateCommit(cwd: string, commit: string) { if (!/^[a-f0-9]{7,40}$/.test(commit)) throw new Error('Invalid commit'); await git(cwd, ['cat-file', '-e', `${commit}^{commit}`]); }
export async function snapshot(project: Project): Promise<Snapshot> {
 const cwd = project.path;
 const [files, branch, branches, trees, stashes, remotes, tags, logs, tracking] = await Promise.all([
 changedFiles(cwd), optional(cwd,['symbolic-ref','--short','HEAD'],'detached'), git(cwd,['for-each-ref','--format=%(refname:short)%09%(HEAD)%09%(upstream:short)%09%(upstream:track)','refs/heads']), git(cwd,['worktree','list','--porcelain']), optional(cwd,['stash','list','--format=%gd%x09%s']), git(cwd,['remote']), git(cwd,['tag','--list']), optional(cwd,['log','-150','--format=%H%x09%h%x09%p%x09%an%x09%aI%x09%D%x09%s']), optional(cwd,['rev-list','--left-right','--count','HEAD...@{upstream}'],'0\t0')]);
 const worktrees: Worktree[] = trees.trim().split('\n\n').filter(Boolean).map(block=>{ const lines=block.split('\n'); return { path: lines.find(l=>l.startsWith('worktree '))!.slice(9), head: lines.find(l=>l.startsWith('HEAD '))?.slice(5)||'', branch: lines.find(l=>l.startsWith('branch '))?.slice(7).replace('refs/heads/','')||'detached', locked: lines.some(l=>l.startsWith('locked')) }; });
 const commits: Commit[] = logs.trim().split('\n').filter(Boolean).map(line=>{const [hash,short,parents,author,date,refs,...subject]=line.split('\t');return {hash,short,parents,author,date,refs,subject:subject.join('\t')};});
 const [ahead,behind] = tracking.trim().split(/\s+/).map(Number);
 return {project,files,branch:branch.trim(),branches:branches.trim().split('\n').filter(Boolean).map(line=>{const [name,current,upstream,track]=line.split('\t');return {name,current:current==='*',upstream,track};}),worktrees,stashes:stashes.trim().split('\n').filter(Boolean).map(line=>{const [ref,...subject]=line.split('\t');return {ref,subject:subject.join('\t')};}),remotes:remotes.trim().split('\n').filter(Boolean),tags:tags.trim().split('\n').filter(Boolean),commits,ahead:ahead||0,behind:behind||0};
}
export async function safeFile(cwd: string, name: string) {
 if(!name || name.includes('\0') || path.isAbsolute(name) || name.split(/[\\/]/).includes('..') || name.split(/[\\/]/).includes('.git')) throw new Error('Invalid file path');
 const target=path.resolve(cwd,name); const base=await realpath(cwd);
 try { const resolved=await realpath(target); if(!resolved.startsWith(base+path.sep))throw new Error('File is outside the repository'); if((await lstat(target)).isSymbolicLink()) throw new Error('Symbolic links cannot be opened'); } catch(error){ if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error; }
 return target;
}
export async function fileContent(cwd:string,name:string,commit?:string):Promise<FileContent> {
 const target=await safeFile(cwd,name); const files=await changedFiles(cwd,commit); const changed=files.find(f=>f.path===name);
 if(commit)await validateCommit(cwd,commit);
 const oldName=changed?.oldPath||name;
 const old=await optional(cwd,['show',`${commit ? `${commit}^` : 'HEAD'}:${oldName}`]);
 let current=''; if(commit)current=await optional(cwd,['show',`${commit}:${name}`]); else {try{const stat=await lstat(target); if(stat.size>5*1024*1024)throw new Error('File exceeds the 5 MB viewing limit'); current=await readFile(target,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
 const conflict=changed?.conflict||false;
 return {path:name,old,current,binary:old.includes('\0')||current.includes('\0'),conflict,...(conflict ? {ours:await optional(cwd,['show',`:2:${name}`]),theirs:await optional(cwd,['show',`:3:${name}`])}:{})};
}
export async function sync(cwd:string) {
 const remotes=(await git(cwd,['remote'])).trim(); if(!remotes)return 'Local repository · no remote';
 await git(cwd,['fetch','--all','--prune']);
 if((await changedFiles(cwd)).length)return 'Fetched · pull paused while you have local changes';
 if(!(await optional(cwd,['rev-parse','--abbrev-ref','@{upstream}'])).trim())return 'Fetched · no upstream configured';
 await git(cwd,['pull','--ff-only']); return 'Up to date';
}
export async function resolveFile(cwd:string,name:string,content:string){const target=await safeFile(cwd,name); const f=(await changedFiles(cwd)).find(x=>x.path===name);if(!f?.conflict)throw new Error('This file is no longer conflicted'); if(/^(<{7}|={7}|>{7})( |$)/m.test(content))throw new Error('Remove all conflict markers before saving'); await writeFile(target,content); await git(cwd,['add','--',name]);}
