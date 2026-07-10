import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const roots = ['apps', 'packages', 'prisma', 'docs', 'scripts', 'tests'];
const ignoredDirs = new Set(['node_modules', 'dist', '.git', 'coverage']);
const sourceOnlyRules = [
  { pattern: /console\.log\([^)]*(password|token|secret)/i, message: 'Do not log secrets.' }
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (/\.(ts|tsx|js|mjs|md|prisma|json|yml|yaml)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = [];
for (const root of roots) {
  try {
    files.push(...await walk(root));
  } catch {
    // Some roots are created in later iterations.
  }
}

const failures = [];
for (const file of files) {
  const content = await readFile(file, 'utf8');
  if (!/\.(ts|tsx|js|mjs)$/.test(file)) continue;
  for (const rule of sourceOnlyRules) {
    if (rule.pattern.test(content)) {
      failures.push(`${file}: ${rule.message}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`lint passed (${files.length} files checked)`);
