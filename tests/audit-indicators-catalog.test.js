import test from 'node:test';
import assert from 'node:assert/strict';
import { criarAnaliseVisual, analisarDimensoesNoticia, analisarTextoLocalmente } from '../services/verification-indicators.js';
import { rankRegionalNews } from '../services/regional-news.js';
import NoticiaColetada from '../models/NoticiaColetada.js';
import { isEligibleArticle, articleIneligibility } from '../services/article-eligibility.js';
import { reviewedArticle } from './fixtures/reviewed-article.js';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StorageManager, parseCsv } from '../scraper/storage.js';
import { NewsItem } from '../scraper/models.js';
import { analisarConteudo } from '../services/analysis.js';
import { localSections } from '../services/explanation.js';
import { reviewMongoArchive } from '../scripts/review-archive.js';

const scoreInputs = [
  'URGENTE!!! De acordo com o estudo de matemática, de acordo com a pesquisa de astronomia, resultados foram divulgados.',
  'Segundo a Prefeitura de Toledo, o comunicado oficial trata do calendário escolar?? Confira os detalhes??'
];
const synthetic = { titulo:'Notícia Teste de Inicialização', texto:'Uma notícia de teste de inicialização foi publicada no Paraná.', url:'https://g1.globo.com/pr/teste-inicial', fonte:'g1_parana' };

test('F04: historical 50/74 controls expose no public index without eligible factual verification', () => {
  for (const texto of scoreInputs) for (const classificacao of ['Sem evidências suficientes','Não verificável']) {
    const visual = criarAnaliseVisual(texto,{classificacao});
    assert.equal(visual.porcentagem,null);
    assert.equal(visual.analiseLocal.porcentagemLocal,null);
    assert.equal(visual.analiseLocal.indiceDisponivel,false);
    for (const name of ['fonte','estrutura','sensacionalismo']) assert.equal(visual.dimensoes[name].pontuacao,null);
    assert.ok(visual.analiseLocal.alertasConfiavel.length);
    assert.ok(visual.analiseLocal.alertasFalso.length);
  }
});

test('F11: merely naming an outlet cannot improve reference quality', () => {
  const texto='A biblioteca recebeu estudantes para ler novos livros.';
  const dimension = value => analisarDimensoesNoticia(value,analisarTextoLocalmente(value)).fonte;
  const base=dimension(texto);
  for (const outlet of ['G1','Agência Brasil','CNN Brasil']) assert.deepEqual(dimension(texto+' '+outlet),base);
  const reference=dimension(texto+' Segundo o relatório, fonte: https://dados.example.org/documento.');
  assert.equal(reference.pontuacao,65);
  assert.match(reference.descricao,/não comprova/);
});

test('F04: an eligible controlled factual conclusion retains its descriptive index only with matching support', () => {
  const texto=scoreInputs[1];
  const evidence={id:'e1',utilizavel:true,correspondencia:'exata',fonteReconhecida:true,classificacaoPublicada:'Conteúdo verdadeiro'};
  const claim={id:'a1',tipo:'fato',consultaCompleta:true,conflito:false,veredito:'Conteúdo verdadeiro',evidencias:[evidence]};
  const context={classificacao:'Conteúdo verdadeiro',afirmacoes:[claim]};
  const result=criarAnaliseVisual(texto,context);
  assert.equal(result.indiceElegivel,true);
  assert.equal(result.porcentagem,74);
  assert.equal(result.confianca,null);
  assert.match(result.explicacao,/Não representa probabilidade de verdade/);
  for (const changes of [{incompleta:true},{classificacao:'Sem evidências suficientes'},
    {afirmacoes:[{...claim,consultaCompleta:false}]},{afirmacoes:[{...claim,conflito:true}]},
    {afirmacoes:[{...claim,evidencias:[{...evidence,utilizavel:false}]}]},
    {afirmacoes:[{...claim,evidencias:[{...evidence,classificacaoPublicada:'Falso'}]}]}]) {
    const invalid=criarAnaliseVisual(texto,{...context,...changes});
    assert.equal(invalid.indiceElegivel,false);
    assert.equal(invalid.porcentagem,null);
  }
});

test('F10: synthetic initial record and generic pages never become ranked articles', () => {
  assert.deepEqual(rankRegionalNews([synthetic],synthetic.texto),[]);
  for (const url of ['https://radiocolmeia.com.br/empregos','https://g1.globo.com/pr/parana/ultimas-noticias']) {
    assert.deepEqual(rankRegionalNews([{...synthetic,url,titulo:'Oportunidades emprego Paraná',texto:'Oportunidades emprego Paraná comunidade regional.'}],'Oportunidades emprego Paraná'),[]);
  }
});

test('F10: exact URL Mongo lookup does not bypass provenance and quarantine', async () => {
  const db={db:{readyState:1},findOne:()=>({maxTimeMS(){return this;},lean:async()=>synthetic}),find:()=>({sort(){return this;},limit(){return this;},maxTimeMS(){return this;},lean:async()=>[synthetic]})};
  assert.deepEqual(await NoticiaColetada.buscarCorrespondentes.call(db,synthetic.texto,synthetic.url),[]);
});

test('F10: unavailable Mongo uses a sanitized local archive for the initial-test reproduction', async () => {
  assert.deepEqual(await NoticiaColetada.buscarCorrespondentes.call({db:{readyState:0}},synthetic.texto,synthetic.url),[]);
});

test('F10: reviewed authentic article about a test remains eligible; altered or pending provenance does not', () => {
  const article=reviewedArticle({titulo:'Teste de segurança nas escolas do Paraná',texto:'A prefeitura publicou o resultado do teste de segurança nas escolas do Paraná com informações atribuídas.'});
  assert.equal(isEligibleArticle(article),true);
  assert.equal(rankRegionalNews([article],'Teste segurança escolas Paraná').length,1);
  for (const change of [{revisao:{estado:'pendente'}},{texto:article.texto+' Alterado.'},{revisao:{...article.revisao,estado:'quarentena'}},{proveniencia:{...article.proveniencia,urlOrigem:'https://other.example.org/reportagem'}}]) assert.equal(isEligibleArticle({...article,...change}),false);
  for (const url of ['https://radiocolmeia.com.br/empregos/','https://g1.globo.com/pr/parana/ultimas-noticias/']) assert.equal(isEligibleArticle(reviewedArticle({...article,url})),false);
  const malformed=reviewedArticle({...article,url:'https://news.example.org/%E0%A4%A'});
  assert.equal(isEligibleArticle(malformed),false);
  assert.equal(rankRegionalNews([malformed,article],'Teste segurança escolas Paraná').length,1);
});

test('F10: all active local representations agree and preserve reversible quarantine', async () => {
  const json=JSON.parse(await readFile(new URL('../data/noticias.json',import.meta.url),'utf8'));
  const jsonl=(await readFile(new URL('../data/noticias.jsonl',import.meta.url),'utf8')).trim().split(/\r?\n/).map(JSON.parse);
  const csv=parseCsv(await readFile(new URL('../data/noticias.csv',import.meta.url),'utf8')).map(NewsItem.fromRecord.bind(NewsItem));
  assert.equal(json.length,6);
  for (const records of [json,jsonl,csv]) {
    assert.ok(records.every(isEligibleArticle));
    assert.deepEqual(records.map(record=>record.url),json.map(record=>record.url));
  }
  const quarantined=JSON.parse(await readFile(new URL('../data/noticias-quarentena.json',import.meta.url),'utf8'));
  assert.equal(quarantined.length,3);
  assert.ok(quarantined.every(entry=>articleIneligibility(entry.registro,{requireReview:false}) === entry.motivo));
  assert.ok(quarantined.some(entry=>entry.registro.url === synthetic.url));
});

test('F10: imports refuse audited seed and listings, preserving the original for quarantine', async t => {
  const dir=await mkdtemp(join(tmpdir(),'vf-review-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const path=join(dir,'legacy.json');
  const source=JSON.stringify([synthetic]);
  await writeFile(path,source);
  await assert.rejects(StorageManager.importLegacyRecords([path],join(dir,'active.json')),/não elegível/);
  assert.equal(await readFile(path,'utf8'),source);
});

test('F04/F10: pipeline keeps verification failure unscored and eligible articles only as attributed context', async () => {
  const article=reviewedArticle({titulo:'Teste de segurança nas escolas do Paraná',texto:'A prefeitura publicou o resultado do teste de segurança nas escolas do Paraná com informações atribuídas.'});
  const options={nlp:async()=>({indicadores:[],comparacoes:[],tensorflow:{disponivel:false,limitacoes:[]}}),check:async()=>({apiDisponivel:false,resultados:[],status:'indisponivel'}),
    explain:async result=>({secoes:localSections(result),geracao:{status:'local'}}),buscarRegionais:async()=>[synthetic,article]};
  const result=await analisarConteudo({texto:scoreInputs[0]},options);
  assert.equal(result.analiseVisual.porcentagem,null);
  assert.equal(result.analiseVisual.indiceElegivel,false);
  assert.equal(result.porcentagem,null);
  assert.equal(result.confianca,null);
  assert.equal(result.veredito,'Sem evidências suficientes');
  assert.deepEqual(result.noticiasRegionais.map(item=>item.url),[article.url]);
  assert.deepEqual(result.parecerIntegrado.evidenciasUtilizadas,[]);
});

test('F10: Mongo migration dry-run is read-only; apply backs up and quarantines exact records without deletion', async () => {
  const approved=JSON.parse(await readFile(new URL('../data/noticias.json',import.meta.url),'utf8'))[0];
  const rejected=JSON.parse(await readFile(new URL('../data/noticias-quarentena.json',import.meta.url),'utf8'))[0].registro;
  const legacy={_id:'legacy',url:approved.url,content_hash:approved.content_hash,title:approved.titulo,text:approved.texto,source:approved.fonte,date:approved.data_publicacao,collected_at:approved.coletado_em};
  const unknown={...approved,_id:'changed',texto:approved.texto+' Conteúdo alterado.'}; delete unknown.proveniencia; delete unknown.revisao;
  const records=[legacy,{...rejected,_id:'seed'},unknown], backups=new Map();
  let writes=0, closed=0;
  const db={collection(name){
    if (name === 'archive_review_backups') return {async updateOne(filter,update){writes++; const key=filter.originalId; if (!backups.has(key)) backups.set(key,structuredClone(update.$setOnInsert));}};
    return {find:()=>({toArray:async()=>structuredClone(records)}),async updateOne(filter,update){writes++; const record=records.find(value=>value._id === filter._id && value.content_hash === filter.content_hash && value.url === filter.url); if (!record) return {matchedCount:0,modifiedCount:0}; Object.assign(record,structuredClone(update.$set)); return {matchedCount:1,modifiedCount:1};}};
  }};
  const clientFactory=()=>({connect:async()=>{},db:()=>db,close:async()=>{closed++;}});
  const dry=await reviewMongoArchive({mongoUri:'controlled-test',clientFactory});
  assert.equal(writes,0); assert.equal(dry.total,3); assert.equal(dry.revisados,1); assert.equal(dry.quarentena,1); assert.equal(dry.pendentes,1);
  const apply=await reviewMongoArchive({mongoUri:'controlled-test',clientFactory,apply:true});
  assert.equal(records.length,3); assert.equal(backups.size,2); assert.deepEqual(backups.get('seed').original,{...rejected,_id:'seed'});
  assert.equal(records[1].revisao.estado,'quarentena'); assert.equal(isEligibleArticle(records[0]),true); assert.equal(isEligibleArticle(records[2]),false);
  assert.equal(apply.elegiveisApos,1); assert.equal(apply.quarentenaApos,1); assert.equal(apply.sinteticosOuGenericosElegiveis,0);
  assert.equal(closed,2);
});
