import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { JSDOM } from 'jsdom';
import { analisarConteudo } from '../services/analysis.js';
import { generateExplanation } from '../services/explanation.js';
import { createApp } from '../server.js';
import { renderAnalysis } from '../public/js/result-renderer.js';

const now=Date.parse('2026-11-11T12:00:00Z');
const fakeKey='integrated-test-key-never-public';
const safeFeedback='A notícia apresenta um relato que exige contexto e atribuição às fontes. Sem evidências verificadas suficientes, a análise não permite confirmar a alegação. Consulte os documentos originais.';
const cultural='A prefeitura divulgou a programação de um festival cultural gratuito no parque municipal.';
const corruption='A Polícia Federal investiga um servidor público por suspeita de corrupção passiva, após relato de solicitação de vantagem indevida para liberar contratos.';
const leak='Uma empresa comunicou um vazamento de dados pessoais dos clientes após acesso não autorizado ao banco de dados.';
const election='O Ministério Público investiga a divulgação de fatos sabidamente inverídicos sobre um candidato durante a campanha eleitoral, capazes de influenciar o eleitorado.';
const selection=(id,text,extra={})=>({id,categoria:'acontecimento_noticiado',trecho_noticia:text,situacao_juridica:'Situação não identificada',trecho_situacao:'',...extra});

function pipeline(text,{references=[],legal,check,fetchOverride}={}) {
  let calls=0,payload;
  const analyze=(body,options={})=>analisarConteudo(body,{...options,
    check:check || (async()=>({apiDisponivel:true,resultados:[]})),buscarRegionais:undefined,
    explain:(result,opts)=>generateExplanation(result,{...opts,enabled:true,provider:'gemini',apiKey:fakeKey,model:'gemini-fixture',legalNow:now,
      fetchImpl:async(url,init)=>{
        calls++;
        const request=JSON.parse(init.body);payload=JSON.parse(request.contents[0].parts[0].text);
        if (fetchOverride) return fetchOverride(url,init);
        const fields=request.generationConfig.responseFormat.text.schema.properties;
        const output={resumo:fields.resumo.enum[0],orientacao:fields.orientacao.enum[0],destaques:[],feedback:safeFeedback,referencias:[],classificacao:result.veredito,
          contexto_juridico:legal===undefined?{aplicavel:references.length>0,referencias:references}:legal};
        return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(output)}]}}]}));
      }
    })
  });
  return {analyze,run:()=>analyze({texto:text}),observed:()=>({calls,payload})};
}

test('ordinary cultural news keeps existing analysis and hides forced legal references',async()=>{
  const p=pipeline(cultural,{references:[selection('cp-317',cultural)]});const result=await p.run();
  assert.equal(result.geracao.status,'ia');assert.deepEqual(result.contexto_juridico,{aplicavel:false,referencias:[]});
  assert.equal(p.observed().calls,1);assert.deepEqual(p.observed().payload.catalogo_juridico,[]);
});

test('corruption investigation selects verified law without a finding of guilt',async()=>{
  const p=pipeline(corruption,{references:[selection('cp-317',corruption,{situacao_juridica:'Investigação',trecho_situacao:corruption})]});const r=await p.run();
  assert.equal(r.geracao.status,'ia');assert.equal(p.observed().calls,1);
  const ref=r.contexto_juridico.referencias[0];assert.ok(ref);assert.equal(ref.artigo,'317');assert.equal(ref.verificada,true);
  assert.equal(ref.categoria,'acontecimento_noticiado');assert.equal(ref.situacao_juridica,'Investigação');assert.match(ref.ressalvas,/não afirma culpa/);
  assert.equal(r.veredito,'Sem evidências suficientes');assert.ok(r.secoes.encontramos);
});

test('client data incident gets LGPD with journalistic exception and no presumption against publisher',async()=>{
  const p=pipeline(leak,{references:[selection('lgpd-46',leak)]});const r=await p.run();
  const ref=r.contexto_juridico.referencias[0];assert.ok(ref);assert.match(ref.lei,/13.709/);
  assert.equal(ref.categoria,'acontecimento_noticiado');assert.match(ref.ressalvas,/jornalístic/);
});

test('electoral claim has specific conditions and the verified alternative penalty',async()=>{
  const p=pipeline(election,{references:[selection('ce-323',election)]});const r=await p.run();
  const ref=r.contexto_juridico.referencias[0];assert.ok(ref);assert.equal(ref.artigo,'323');
  assert.match(ref.consequencias,/ou/i);assert.match(ref.ressalvas,/circunstâncias/);
});

test('unsupported accusation does not become calumny solely due to missing sources',async()=>{
  const text='Uma publicação atribui um suposto crime a um morador, sem apresentar documentos nem fontes verificáveis. Não se sabe se a imputação é falsa.';
  const r=await pipeline(text,{references:[selection('cp-138',text,{categoria:'publicacao'})]}).run();
  assert.equal(r.geracao.status,'ia');assert.equal(r.veredito,'Sem evidências suficientes');assert.equal(r.contexto_juridico.aplicavel,false);
});

test('matching published factual correction stays false without inventing a crime',async()=>{
  const text='A prefeitura anunciou uma nova escola em 2025.';
  const review={id:'e1',texto_verificado:text,avaliacao:'Falso',url_verificacao:'https://aosfatos.org/noticias/teste',verificador:'Aos Fatos',titulo_verificacao:'Checagem publicada',data_verificacao:'2025-08-10T12:00:00Z',data_alegacao:'2025-08-01'};
  const r=await pipeline(text,{check:async()=>({apiDisponivel:true,resultados:[review]})}).run();
  assert.equal(r.veredito,'Falso');assert.equal(r.contexto_juridico.aplicavel,false);assert.equal(r.geracao.status,'ia');
});

test('API failure is explicit while factual/ML analysis remains available without a simulated Gemini analysis',async()=>{
  const r=await pipeline(corruption,{fetchOverride:async()=>new Response(fakeKey+' private',{status:401})}).run();
  assert.equal(r.geracao.status,'local');assert.equal(r.feedbackGemini.status,'local');assert.equal(r.geracao.codigo,'AI_AUTH_ERROR');
  assert.ok(r.analiseLinguagem.tensorflow.disponivel);assert.equal(r.contexto_juridico.aplicavel,false);
  assert.ok(!JSON.stringify(r).includes(fakeKey));assert.ok(!JSON.stringify(r).includes('private'));
});

test('invalid law/article/URL or malformed legal field only discards the legal part',async()=>{
  for(const legal of [null,'bad',{aplicavel:true,referencias:'bad'},
    {aplicavel:true,referencias:[selection('cp-999999',corruption)]},
    {aplicavel:true,referencias:[selection('cp-317',corruption,{fonte_oficial:'https://invented.example/law'})]},
    {aplicavel:true,referencias:[selection('cp-317',corruption,{artigo:'999999'})]}
  ]) {
    const p=pipeline(corruption,{legal});const r=await p.run();assert.equal(p.observed().calls,1);
    assert.equal(r.geracao.status,'ia');assert.equal(r.feedbackGemini.texto,safeFeedback);assert.equal(r.contexto_juridico.aplicavel,false);
  }
});

test('HTTP route → real TensorFlow → single mocked Gemini → shared DOM renderer retains previous fields and legal details',async t=>{
  const p=pipeline(corruption,{references:[selection('cp-317',corruption)]});
  const server=createApp({analyze:p.analyze,dbReady:()=>false,rateLimits:false}).listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/verificar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texto:corruption})});
  const data=await response.json();assert.equal(response.status,200);assert.equal(data.sucesso,true);assert.equal(p.observed().calls,1);
  assert.equal(data.dados.schemaVersion,2);assert.equal(data.dados.porcentagem,data.dados.analiseVisual.porcentagem);assert.ok(data.dados.analiseVisual);
  const dom=new JSDOM('<div id="result"></div>'),previous=globalThis.document;globalThis.document=dom.window.document;
  try {const root=document.getElementById('result');renderAnalysis(root,data.dados);assert.ok(root.querySelector('.legal-context'));assert.equal(root.querySelector('.gemini-feedback-text').textContent,safeFeedback);assert.equal(root.querySelectorAll('.analysis-card').length,3);}
  finally {globalThis.document=previous;dom.window.close();}
});
