// Opt-in live smoke test. Uses synthetic news, the HTTP route and the real
// Google/Gemini/TensorFlow services; never writes environment variables or keys.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createApp } from '../server.js';
import { analisarConteudo } from '../services/analysis.js';
import { generateExplanation } from '../services/explanation.js';
import { renderAnalysis } from '../public/js/result-renderer.js';

if (process.env.ENABLE_AI_EXPLANATION !== 'true' || !process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL) {
  console.error('Configure ENABLE_AI_EXPLANATION=true, GEMINI_API_KEY e GEMINI_MODEL no servidor.');
  process.exit(1);
}
const only = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const model = process.argv.find(arg => arg.startsWith('--model='))?.slice(8) || process.env.GEMINI_MODEL;
const examples = [
  {id:'comum',nome:'Evento cultural',legal:false,texto:'A prefeitura informou que o festival cultural será realizado no parque municipal no sábado. A programação inclui apresentações de música e teatro, com entrada gratuita. A organização recomenda consultar os horários na agenda oficial.'},
  {id:'corrupcao',nome:'Investigação de corrupção',legal:true,texto:'A Polícia Federal informou que investiga um servidor público suspeito de solicitar vantagem indevida para liberar contratos. Segundo a corporação, foram cumpridos mandados de busca. A investigação apura possível corrupção passiva. A defesa nega as acusações. Não há condenação.'},
  {id:'dados',nome:'Exposição de dados de clientes',legal:true,texto:'Uma empresa confirmou acesso não autorizado ao banco de dados dos clientes, com exposição de CPF e endereços. O incidente foi descrito como vazamento de dados pessoais. O comunicado informa que os titulares foram notificados e que uma investigação técnica foi iniciada.'},
  {id:'eleitoral',nome:'Desinformação em campanha eleitoral',legal:true,texto:'O Ministério Público Eleitoral investiga a divulgação, durante a campanha eleitoral, de fatos sabidamente inverídicos sobre um candidato, capazes de exercer influência perante o eleitorado. A investigação busca apurar quem produziu e divulgou o material de propaganda eleitoral. A defesa contesta a acusação e não há condenação.'},
  {id:'acusacao',nome:'Acusação sem comprovação',legal:false,texto:'Uma publicação afirma que um morador teria praticado um crime, mas não apresenta documentos, testemunhas identificadas ou outras fontes verificáveis. A pessoa citada nega a acusação. Não há informações suficientes para saber se a imputação é falsa nem para concluir se houve crime contra a honra.'},
  {id:'erro-factual',nome:'Informação incorreta sem infração identificada',legal:false,texto:'Uma mensagem informou incorretamente que o festival começaria na terça-feira. A organização esclareceu que a data correta é quinta-feira, conforme o calendário oficial. O erro de data foi corrigido. O texto não acusa ninguém nem apresenta qualquer elemento de infração legal.'}
].filter(item => !only || item.id === only);
if (!examples.length) throw new Error('Cenário desconhecido.');
let calls = 0, upstream = [], selection;
const app = createApp({ dbReady:()=>false, rateLimits:false,
  analyze:(body,options)=>analisarConteudo(body,{...options,buscarRegionais:undefined,
    explain:(result,opts)=>generateExplanation(result,{...opts,provider:'gemini',model,
      fetchImpl:async(url,init)=>{
        calls++; const response=await fetch(url,init); upstream.push(response.status);
        if (response.ok) {
          try {
            const data=await response.clone().json();
            selection=JSON.parse(data.candidates?.[0]?.content?.parts?.filter(part=>!part.thought).map(part=>part.text || '').join('')).contexto_juridico;
          } catch { /* contract failures are recorded below, without dumping raw provider data */ }
        }
        return response;
      }
    })
  })
});
const server = app.listen(0,'127.0.0.1');
await once(server,'listening');
const report={executado_em:new Date().toISOString(),modelo:model,
  escopo:'HTTP local → Google Fact Check e TensorFlow reais → Gemini real → renderizador DOM. Banco e acervo regional não utilizados; avaliação editorial permanece manual.',cases:[]};
const previousDocument=globalThis.document;
try {
  for (const example of examples) {
    calls=0; upstream=[]; selection=undefined;
    const started=Date.now();
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/verificar`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texto:example.texto})
    });
    const data=await response.json();
    const entry={id:example.id,nome:example.nome,http:response.status,geminiHttp:upstream.at(-1) ?? null,upstreamStatuses:[...upstream],calls,durationMs:Date.now()-started,selecao_juridica:selection,resultado:data.dados,validacao:{}};
    report.cases.push(entry);
    try {
      assert.equal(response.status,200); assert.equal(data.sucesso,true);
      const result=data.dados;
      assert.ok(calls>=1&&calls<=2,'Uma chamada normal e no máximo uma repetição após falha temporária');
      assert.equal(calls,result.geracao.tentativas);
      if(calls===2)assert.ok([408,429,500,502,503,504].includes(upstream[0]),'Repetição somente após HTTP temporário');
      assert.equal(result.geracao.status,'ia','A resposta precisa passar pela validação, além de HTTP 200');
      assert.equal(result.feedbackGemini.status,'ia'); assert.ok(result.feedbackGemini.texto.length>=20);
      const legal=result.contexto_juridico?.aplicavel === true;
      assert.equal(legal,example.legal,'Pertinência jurídica do cenário sintético');
      if (legal) {
        assert.ok(result.contexto_juridico.referencias.length>0);
        for (const ref of result.contexto_juridico.referencias) {
          assert.equal(ref.verificada,true);assert.ok(ref.fonte_oficial.startsWith('https://'));
          assert.notEqual(ref.situacao_juridica,'Condenação');
        }
      }
      const dom=new JSDOM('<main id="resultado"></main>');
      globalThis.document=dom.window.document;
      const root=document.getElementById('resultado');renderAnalysis(root,result);
      assert.equal(root.querySelector('.gemini-feedback-text')?.textContent,result.feedbackGemini.texto);
      assert.equal(Boolean(root.querySelector('.legal-context')),example.legal);
      assert.ok(!root.textContent.includes('undefined'));dom.window.close();
      const serialized=JSON.stringify(entry);
      for (const key of ['GEMINI_API_KEY','GOOGLE_API_KEY','OPENAI_API_KEY','JWT_SECRET']) {
        if (process.env[key]) assert.ok(!serialized.includes(process.env[key]),'Segredo ausente do resultado');
      }
      entry.validacao={aprovada:true,dom:true,contexto_juridico:legal,checagensGoogle:result.apiDisponivel,tensorflow:result.analiseLinguagem?.tensorflow?.disponivel};
    } catch { entry.validacao={aprovada:false,codigo:data.dados?.geracao?.codigo || 'LIVE_CONTRACT_MISMATCH'};process.exitCode=1; }
    console.log(JSON.stringify({cenario:entry.id,http:entry.http,geminiHttp:entry.geminiHttp,calls:entry.calls,...entry.validacao}));
  }
} finally {
  globalThis.document=previousDocument;
  await mkdir('.artifacts',{recursive:true});
  let serialized=JSON.stringify(report,null,2);
  for (const key of ['GEMINI_API_KEY','GOOGLE_API_KEY','OPENAI_API_KEY','JWT_SECRET']) {
    if (process.env[key]) serialized=serialized.replaceAll(process.env[key],'[REDACTED]');
  }
  await writeFile('.artifacts/gemini-live-results.json',serialized);
  const timestamp=report.executado_em.replace(/[:.]/g,'-');
  await writeFile('.artifacts/gemini-live-'+timestamp+'.json',serialized);
  await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
}
