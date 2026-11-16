import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderAnalysis, renderHistoryAnalysis } from '../public/js/result-renderer.js';
import { analyzeLanguage } from '../services/tensorflow.js';
import { analisarConteudo } from '../services/analysis.js';
import { generateExplanation } from '../services/explanation.js';
import { analysisFixture } from './helpers/analysis-fixture.js';

function render(t, data, historical = false) {
  const dom=new JSDOM('<div id="result"></div>');
  const previous=globalThis.document;
  globalThis.document=dom.window.document;
  t.after(()=>{globalThis.document=previous;dom.window.close();});
  const root=document.getElementById('result');
  if (historical) renderHistoryAnalysis(root,{schemaVersion:2,...data});
  else renderAnalysis(root,analysisFixture(data));
  return root;
}

test('resultado real do TensorFlow associa comparação ao trecho e à fonte sem afirmar verdade',async t=>{
  const texto='A prefeitura anunciou obras na escola municipal.';
  const review={id:'r1',texto_verificado:texto,titulo_verificacao:'Anúncio de obras',
    avaliacao:'Não avaliado',verificador:'Verificador de exemplo',data_verificacao:'2025-08-10',
    data_alegacao:'2025-08-01',url_verificacao:'https://example.com/checagem'};
  const result=await analisarConteudo({texto},{
    check:async()=>({apiDisponivel:true,resultados:[review]}),
    nlp:(text,claims,reviews)=>analyzeLanguage(text,claims,reviews,{modelDir:''}),
    explain:data=>generateExplanation(data,{enabled:false})
  });
  assert.equal(result.analiseLinguagem.tensorflow.disponivel,true);
  const root=render(t,result);
  const section=root.querySelector('.linguistic-comparisons');
  assert.ok(section.querySelector('details:not([open])'));
  assert.match(section.textContent,/Trecho analisado: A prefeitura/);
  assert.match(section.textContent,/Checagem: Anúncio de obras/);
  assert.match(section.querySelector('.comparison-lexical').textContent,/1,000/);
  assert.equal(section.querySelector('a').href,'https://example.com/checagem');
  assert.match(section.textContent,/não confirma fatos nem identifica contradições/);
  assert.match(section.textContent,/Não foi utilizado um modelo treinado/);
  assert.equal(section.querySelector('.comparison-semantic'),null);
});

test('TensorFlow disponível sem checagens e falha real não geram comparações fictícias',t=>{
  const root=render(t,{analiseLinguagem:{indicadores:[],tensorflow:{disponivel:true,modelo:null,comparacoesExecutadas:0},comparacoes:[]}});
  assert.match(root.querySelector('.linguistic-comparisons').textContent,/Não há pares/);
  assert.equal(root.querySelector('.comparison-pair'),null);
  renderAnalysis(root,analysisFixture({analiseLinguagem:{indicadores:[],tensorflow:{disponivel:false},comparacoes:[]}}));
  assert.match(root.querySelector('.linguistic-comparisons').textContent,/não pôde ser executada/);
  assert.equal(root.querySelector('.comparison-lexical'),null);
});

test('comparações desconhecidas ou inválidas são ignoradas e trechos hostis permanecem texto',t=>{
  const attack='<img src=x onerror="alert(1)">';
  const root=render(t,{
    afirmacoes:[{id:'a1',texto:attack}],
    resultados:[{id:'r1',titulo_verificacao:attack,url_verificacao:'javascript:alert(1)'}],
    analiseLinguagem:{tensorflow:{disponivel:true,modelo:'local'},comparacoes:[
      {afirmacaoId:'missing',evidenciaId:'r1',similaridadeLexical:0.9},
      {afirmacaoId:'a1',evidenciaId:'r1',similaridadeLexical:NaN},
      {afirmacaoId:'a1',evidenciaId:'r1',similaridadeLexical:0.7,similaridadeSemantica:Infinity}
    ]}
  },true);
  const section=root.querySelector('.linguistic-comparisons');
  assert.equal(section.querySelectorAll('.comparison-pair').length,1);
  assert.ok(section.textContent.includes(attack));
  assert.equal(section.querySelectorAll('img,script,a[href^="javascript:"],.comparison-semantic').length,0);
});

test('histórico v2 utiliza o mesmo detalhe recolhível e legado não inventa análise ML',t=>{
  const root=render(t,{});
  renderHistoryAnalysis(root,{resultado:{schemaVersion:2,analiseLinguagem:{tensorflow:{disponivel:true,modelo:null},comparacoes:[]}}});
  assert.ok(root.querySelector('.linguistic-comparisons'));
  renderHistoryAnalysis(root,{texto:'Texto de registro legado'});
  assert.equal(root.querySelector('.linguistic-comparisons'),null);
});
