import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderAnalysis, renderHistoryAnalysis } from '../public/js/result-renderer.js';
import { analyzeLanguage } from '../services/tensorflow.js';
import { analisarConteudo } from '../services/analysis.js';
import { generateExplanation } from '../services/explanation.js';
import { criarAnaliseVisual } from '../services/verification-indicators.js';
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

test('leitura e informações da notícia reaproveitam os dados sem alterar a verificação',t=>{
  const visual=criarAnaliseVisual('Segundo a Polícia Federal, a operação em Brasília envolveu 150 pessoas em 13/11/2025.');
  const data=analysisFixture({tipoEntrada:'url',analiseVisual:visual});
  const before=structuredClone(data),root=render(t,data);
  assert.equal(root.querySelectorAll('.analysis-card').length,3);
  assert.deepEqual([...root.querySelectorAll('.analysis-score')].map(node=>node.textContent),['—/100','—/100','—/100']);
  assert.equal(root.querySelector('.analysis-overview .progress-bar'),null);
  assert.match(root.querySelector('.analysis-overview').textContent,/Indicadores automáticos, não prova definitiva/);
  const info=root.querySelector('.news-information');
  assert.equal(info.querySelector('.news-claim p').textContent,visual.dimensoes.informacoes.alegacaoPrincipal);
  const groups=[...info.querySelectorAll('.news-info-group')];
  for(const [index,key] of ['palavrasImportantes','entidades','numeros','datas'].entries()){
    assert.deepEqual([...groups[index].querySelectorAll('.news-info-values span')].map(node=>node.textContent),visual.dimensoes.informacoes[key]);
  }
  assert.deepEqual(data,before);
  const scores=structuredClone(data);
  for(const [key,value] of [['sensacionalismo',0],['fonte',45],['estrutura',80]])scores.analiseVisual.dimensoes[key].pontuacao=value;
  const scoresBefore=structuredClone(scores);
  renderAnalysis(root,scores);
  assert.deepEqual([...root.querySelectorAll('.analysis-score')].map(node=>node.textContent),['0/100','45/100','80/100']);
  assert.deepEqual([...root.querySelectorAll('.analysis-progress')].map(node=>node.getAttribute('aria-valuenow')),['0','45','80']);
  assert.deepEqual(scores,scoresBefore);
  renderHistoryAnalysis(root,{resultado:scores});
  assert.ok(root.querySelector('.news-information'));
  assert.deepEqual([...root.querySelectorAll('.analysis-score')].map(node=>node.textContent),['0/100','45/100','80/100']);
});

test('informações extraídas só aparecem para entrada por link, inclusive no histórico',t=>{
  const visual=criarAnaliseVisual('Uma mensagem com referência https://example.com/noticia e data 13/11/2025.');
  const data=analysisFixture({tipoEntrada:'texto',analiseVisual:visual,noticia:{url:'https://example.com/noticia'}});
  const root=render(t,data);
  assert.ok(root.querySelector('.analysis-overview'));
  assert.equal(root.querySelector('.news-information'),null);
  renderHistoryAnalysis(root,{resultado:data});
  assert.equal(root.querySelector('.news-information'),null);
  renderHistoryAnalysis(root,{...data,tipoEntrada:undefined});
  assert.equal(root.querySelector('.news-information'),null);
  const attack='<img src=x onerror="alert(1)">',linked=structuredClone(data);
  linked.tipoEntrada='url';
  Object.assign(linked.analiseVisual.dimensoes.informacoes,{
    alegacaoPrincipal:attack,palavrasImportantes:[attack],entidades:[attack],numeros:[attack],datas:[attack],links:['javascript:alert(1)']
  });
  renderAnalysis(root,linked);
  assert.ok(root.querySelector('.news-information').textContent.includes(attack));
  assert.equal(root.querySelector('.news-information img, .news-information script, .news-information [onerror], .news-information a'),null);
});

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
