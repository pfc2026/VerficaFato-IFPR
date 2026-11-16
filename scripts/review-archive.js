import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { articleContentHash, articleIneligibility, isEligibleArticle } from '../services/article-eligibility.js';
import { normalizeUrl } from '../scraper/normalizers.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const migration = 'audit-2026-11-15-proveniencia-v1';
const reference = 'RELATORIO_TESTES.md#f10; .artifacts/audit-2026-11-15/catalog-url-check.json';

export function documentedReview(record) {
  const hash = articleContentHash(record);
  return {
    proveniencia:{tipo:'artigo',metodo:'revisao_documentada',urlOrigem:new URL(record.url).href,content_hash:hash},
    revisao:{estado:'aprovado',em:'2026-11-15',url:new URL(record.url).href,content_hash:hash,referencia:reference,
      escopo:'Identidade de artigo, URL, título e corpo coletado. Não confirma a veracidade das alegações.'}
  };
}

export async function reviewLocalArchive({ rootDir = root, apply = false } = {}) {
  const jsonPath = resolve(rootDir, 'data/noticias.json');
  const records = JSON.parse(await readFile(jsonPath, 'utf8'));
  const eligible = [], quarantined = [];
  const urlChecks = JSON.parse(await readFile(resolve(rootDir,'.artifacts/audit-2026-11-15/catalog-url-check.json'),'utf8'));
  for (const record of records) {
    const reason = articleIneligibility(record, {requireReview:false});
    const check = urlChecks.results.find(value => value.catalogUrl === record.url);
    if (reason) quarantined.push({registro:record,motivo:reason,origens:['data/noticias.json','data/noticias.jsonl','data/noticias.csv'],migracao:migration});
    else if (check?.status === 200 && typeof check.heading === 'string' && check.heading.length > 20 && new URL(record.url).pathname.includes('/noticia/')) {
      if (record.content_hash !== articleContentHash(record)) throw new Error('ARCHIVE_HASH_MISMATCH');
      eligible.push({...record,...documentedReview(record)});
    } else throw new Error('ARCHIVE_REVIEW_REQUIRED');
  }
  if (apply) {
    const quarantinePath = resolve(rootDir,'data/noticias-quarentena.json');
    let previous = [];
    try { previous = JSON.parse(await readFile(quarantinePath,'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const map = new Map([...previous,...quarantined].map(value=>[value.registro.url+'|'+value.registro.content_hash,value]));
    await mkdir(resolve(rootDir,'data'),{recursive:true});
    // Quarantine is written before removing the entries from active representations.
    await writeFile(quarantinePath,JSON.stringify([...map.values()],null,2)+'\n','utf8');
    const { CSV_FIELDS } = await import('../scraper/storage.js');
    const cell = value => {
      let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (/^[\s]*[=+@-]/.test(text)) text="'"+text;
      return /[;"\r\n]/.test(text) ? '"'+text.replace(/"/g,'""')+'"' : text;
    };
    await writeFile(jsonPath,JSON.stringify(eligible,null,2)+'\n','utf8');
    await writeFile(resolve(rootDir,'data/noticias.jsonl'),eligible.map(value=>JSON.stringify(value)).join('\n')+'\n','utf8');
    await writeFile(resolve(rootDir,'data/noticias.csv'),'\uFEFF'+CSV_FIELDS.join(';')+'\r\n'+eligible.map(value=>CSV_FIELDS.map(key=>cell(value[key])).join(';')).join('\r\n')+'\r\n','utf8');
  }
  return {ambiente:'arquivos_locais',aplicado:apply,artigosRevisados:eligible.length,quarentena:quarantined.map(value=>({url:value.registro.url,content_hash:value.registro.content_hash,motivo:value.motivo})),migracao:migration};
}

export async function reviewMongoArchive({ apply = false, clientFactory = uri=>new MongoClient(uri,{serverSelectionTimeoutMS:5000,connectTimeoutMS:5000,timeoutMS:10000}), mongoUri = process.env.MONGO_URI, dbName = process.env.MONGO_DB_NAME, collectionName = process.env.MONGO_COLLECTION || 'noticias_coletadas', timeoutMs = 15000 } = {}) {
  if (!mongoUri) throw new Error('MONGO_NOT_CONFIGURED');
  const local = JSON.parse(await readFile(resolve(root,'data/noticias.json'),'utf8'));
  const quarantined = JSON.parse(await readFile(resolve(root,'data/noticias-quarentena.json'),'utf8'));
  const knownGood = new Map(local.filter(isEligibleArticle).map(record=>[normalizeUrl(record.url)+'|'+record.content_hash,record]));
  const knownBad = new Map(quarantined.map(entry=>[normalizeUrl(entry.registro.url)+'|'+entry.registro.content_hash,entry]));
  const client = clientFactory(mongoUri);
  let deadlineTimer, timedOut = false;
  const ensureActive = () => { if (timedOut) throw new Error('MONGO_REVIEW_TIMEOUT'); };
  const deadline = new Promise((_,reject)=>{
    deadlineTimer=setTimeout(()=>{timedOut=true;reject(new Error('MONGO_REVIEW_TIMEOUT'));},Math.max(1,timeoutMs-250));
  });
  try {
    return await Promise.race([deadline,(async()=>{
    await client.connect();
    ensureActive();
    const db = client.db(dbName), collection = db.collection(collectionName), backups = db.collection('archive_review_backups');
    const records = await collection.find({}).toArray();
    const report = {ambiente:'MongoDB',colecao:collectionName,aplicado:apply,migracao:migration,total:records.length,revisados:0,quarentena:0,pendentes:0,alterados:0,registros:[]};
    for (const record of records) {
      ensureActive();
      // Older imports used English field names. Add aliases only after the
      // exact URL/content hash is verified against the documented review.
      const canonical={...record,titulo:record.titulo??record.title,texto:record.texto??record.text,fonte:record.fonte??record.source,
        data_publicacao:record.data_publicacao??record.date??null,coletado_em:record.coletado_em??record.collected_at};
      const key = normalizeUrl(record.url)+'|'+record.content_hash;
      const approved = knownGood.get(key), rejected = knownBad.get(key);
      report.registros.push({id:String(record._id),url:record.url,content_hash:record.content_hash,hashConfere:articleContentHash(canonical)===record.content_hash,
        correspondeArtigoRevisado:!!approved,correspondeQuarentenaAuditada:!!rejected,motivoInelegibilidade:articleIneligibility(record),motivoEstrutural:articleIneligibility(canonical,{requireReview:false}),
        campos:Object.keys(record).filter(key=>!['proveniencia','revisao','quarentena'].includes(key)),tituloTipo:typeof record.titulo,textoTipo:typeof record.texto,
        tituloTamanho:typeof record.titulo==='string'?record.titulo.length:null,textoTamanho:typeof record.texto==='string'?record.texto.length:null,fonteTipo:typeof record.fonte});
      let change;
      if (approved && articleContentHash(canonical) === record.content_hash) {
        change={titulo:canonical.titulo,texto:canonical.texto,fonte:canonical.fonte,data_publicacao:canonical.data_publicacao,coletado_em:canonical.coletado_em,
          proveniencia:approved.proveniencia,revisao:approved.revisao}; report.revisados++;
      }
      else if (rejected && articleContentHash(canonical) === record.content_hash) {
        change={revisao:{estado:'quarentena',em:'2026-11-15',motivo:rejected.motivo,migracao:migration},quarentena:{motivo:rejected.motivo,migracao:migration}}; report.quarentena++;
      } else { report.pendentes++; continue; }
      if (!apply) continue;
      ensureActive();
      await backups.updateOne({migracao:migration,colecao:collectionName,originalId:record._id},{$setOnInsert:{migracao:migration,colecao:collectionName,originalId:record._id,original:record}},{upsert:true});
      ensureActive();
      const result=await collection.updateOne({_id:record._id,url:record.url,content_hash:record.content_hash},{$set:change});
      if (result.matchedCount !== 1) throw new Error('MONGO_CONCURRENT_CHANGE');
      report.alterados += result.modifiedCount;
    }
    if (apply) {
      const after=await collection.find({}).toArray();
      report.elegiveisApos=after.filter(isEligibleArticle).length;
      report.quarentenaApos=after.filter(record=>record.revisao?.estado === 'quarentena').length;
      report.sinteticosOuGenericosElegiveis=after.filter(record=>isEligibleArticle(record) && articleIneligibility(record,{requireReview:false})).length;
      report.backupColecao='archive_review_backups';
    }
    return report;
    })()]);
  } finally {
    clearTimeout(deadlineTimer);
    // DNS resolution and a half-open driver may outlive close(). Bound cleanup
    // as well, and forbid any subsequent write after the deadline.
    let cleanupTimer;
    await Promise.race([Promise.resolve().then(()=>client.close()).catch(()=>{}),new Promise(resolve=>{cleanupTimer=setTimeout(resolve,250);})]);
    clearTimeout(cleanupTimer);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2);
    if (args.some(value=>!['--local','--mongo','--apply'].includes(value)) || args.includes('--local') === args.includes('--mongo')) throw new Error('Use --local OU --mongo, opcionalmente --apply.');
    console.log(JSON.stringify(await (args.includes('--local') ? reviewLocalArchive : reviewMongoArchive)({apply:args.includes('--apply')}),null,2));
  } catch (error) {
    // The URI, credentials, records and raw driver message never enter logs.
    console.error(JSON.stringify({erro:'Revisão não concluída',classe:error.name,codigo:error.code || (/^[A-Z_]+$/.test(error.message) ? error.message : 'ARCHIVE_REVIEW_FAILED')}));
    process.exitCode=1;
    if (error.message === 'MONGO_REVIEW_TIMEOUT') {
      console.error(JSON.stringify({estado:process.argv.includes('--apply') ? 'Aplicação pode estar parcial: conferir a migração e os backups antes de continuar.' : 'Somente leitura: nenhuma alteração solicitada.',migracao:migration}));
      // A pending OS DNS lookup must not keep a diagnostic CLI alive forever.
      process.exit(1);
    }
  }
}
