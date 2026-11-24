import { mkdir, copyFile, writeFile, rm, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const files = ['index.html', 'styles.css', 'app.js', 'oracle-core.js', 'ball.js', 'sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
// Only the app itself is published: no test files or personal print artifacts.
for (const file of files) await readFile(new URL(file, root));
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of files) await copyFile(new URL(file, root), new URL(file, dist));
await writeFile(new URL('.nojekyll', dist), '');
console.log(`Built ${files.length} local assets in ${fileURLToPath(dist)}`);
