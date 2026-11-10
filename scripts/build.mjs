import { cp, mkdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copyFile(path.join(root, 'index.html'), path.join(output, 'index.html'));
await copyFile(path.join(root, 'sw.js'), path.join(output, 'sw.js'));
await cp(path.join(root, 'src'), path.join(output, 'src'), { recursive: true });
console.log('Tayyor: dist/ — statik frontend fayllari.');
