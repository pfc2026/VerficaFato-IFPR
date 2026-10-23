import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname,'..');
const folders = ['services','scraper','routes','models','middleware','api','public/js','tests','scripts'];
const files = ['server.js'];
for(const folder of folders) for(const entry of await readdir(path.join(root,folder),{withFileTypes:true})) if(entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) files.push(path.join(folder,entry.name));
for(const file of files) {
  const result = spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8',shell:false});
  if(result.status !== 0) { process.stderr.write(result.stderr || 'Falha de sintaxe em '+file+'\n');process.exitCode=1; }
}
for(const file of ['package.json','vercel.json']) JSON.parse(await readFile(path.join(root,file),'utf8'));
if(!process.exitCode) console.log(files.length+' arquivos JavaScript com sintaxe válida; manifestos JSON válidos.');
