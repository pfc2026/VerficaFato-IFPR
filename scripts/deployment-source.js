import { readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const runtimeDirectories = ['api', 'services', 'routes', 'models', 'middleware', 'public', 'scraper'];
const runtimeFiles = ['server.js', 'package.json', 'package-lock.json', 'vercel.json', 'data/noticias.json', 'data/legal-catalog.json'];

// The URL extractor loads scraper/extractors.js on demand. Collecting only the
// initial server imports produces an apparently healthy deployment that fails
// as soon as the user submits an accessible article URL.
export async function collectDeploymentSource({ root = projectRoot, includeData = false, inlineLimit = 200000 } = {}) {
  const files = [...runtimeFiles];
  async function collect(folder) {
    if ((await lstat(path.join(root, folder))).isSymbolicLink()) throw new Error('Deployment symlinks are not allowed: ' + folder);
    for (const entry of await readdir(path.join(root, folder), { withFileTypes: true })) {
      const file = folder + '/' + entry.name;
      if (entry.isSymbolicLink()) throw new Error('Deployment symlinks are not allowed: ' + file);
      if (entry.isDirectory()) await collect(file);
      else if (entry.isFile() && !entry.name.startsWith('.')) files.push(file);
    }
  }
  for (const folder of runtimeDirectories) await collect(folder);
  const entries = [];
  for (const file of files.sort()) {
    if ((await lstat(path.join(root, file))).isSymbolicLink()) throw new Error('Deployment symlinks are not allowed: ' + file);
    const bytes = await readFile(path.join(root, file));
    entries.push({ file, sha: createHash('sha1').update(bytes).digest('hex'), size: bytes.length,
      ...(includeData && bytes.length < inlineLimit ? { data: bytes.toString('base64'), encoding: 'base64' } : {}) });
  }
  const sourceHash = createHash('sha256').update(JSON.stringify(entries.map(({ file, sha, size }) => ({ file, sha, size })))).digest('hex');
  return { sourceHash, entries };
}
