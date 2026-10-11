import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
await mkdir('server/generated',{recursive:true});
await writeFile('server/generated/project.html',await readFile('dist/launch-template/index.html'));
await rm('dist/launch-template',{recursive:true});
