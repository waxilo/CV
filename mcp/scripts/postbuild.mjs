import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(root, 'dist', 'index.js');
const shebang = '#!/usr/bin/env node\n';
const source = readFileSync(entry, 'utf8');
if (!source.startsWith(shebang)) {
  writeFileSync(entry, shebang + source);
}
chmodSync(entry, 0o755);
