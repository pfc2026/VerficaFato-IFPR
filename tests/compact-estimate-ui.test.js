import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {renderAnalysis,renderHistoryAnalysis,resultLabel,resultBadge} from '../public/js/result-renderer.js';
import {analysisFixture} from './helpers/analysis-fixture.js';
import {estimateClassification} from '../public/js/ai-estimate.js';

function browser(t) {
  const dom=new JSDOM('<main id="result"></main>'),previous=globalThis.document;globalThis.document=dom.window.document;
  t.after(()=>{globalThis.document=previous;dom.window.close();});return document.getElementById('result');
}
function estimate(porcentagem) {return {status:'disponivel',porcentagem,classificacao:estimateClassification(porcentagem),provedor:'gemini',modelo:'gemini-controlled',metodo:'estimativa_ia',motivos:['conhecimento_geral']};}
for(const percentage of [8,61,94])test('estimativa '+percentage+'% é o resultado primário e preserva o parecer factual nos detalhes',t=>{
  const root=browser(t),data=analysisFixture({estimativaIA:estimate(percentage)});
  renderAnalysis(root,data);
  const card=root.querySelector('.ai-estimate-summary');assert.equal(root.querySelector('.restored-results').firstElementChild,card);
  assert.equal(card.querySelector('.estimate-percentage').textContent,percentage+'%');
  assert.equal(card.querySelector('.estimate-gauge .estimate-percentage').textContent,percentage+'%');
  assert.equal(card.querySelector('.estimate-gauge').getAttribute('aria-label'),'Estimativa de veracidade por IA: '+percentage+' por cento');
  assert.equal(card.querySelector('.estimate-fill').style.width,percentage+'%');
  assert.equal(card.style.getPropertyValue('--estimate-angle'),(percentage*3.6)+'deg');
  assert.deepEqual([...card.querySelectorAll('.estimate-scale span')].map(node=>node.textContent),['Menos provável','Incerto','Mais provável']);
  assert.equal(card.querySelector('h3').textContent,estimateClassification(percentage));
  assert.equal(root.querySelectorAll('.estimate-percentage').length,1);
  assert.match(card.querySelector('.estimate-disclaimer').textContent,/Estimativa feita por IA\. Pode conter erros/);
  const details=root.querySelector('.result-details');assert.equal(details.open,false);
  assert.equal(details.querySelector('.factual-summary h3').textContent,'Sem evidências suficientes');
  assert.equal(data.veredito,'Sem evidências suficientes');assert.equal(data.porcentagem,null);
  assert.equal(resultLabel({resultado:data}),estimateClassification(percentage));
  assert.equal(resultBadge({resultado:data}).textContent,estimateClassification(percentage));
  for(const selector of ['.service-availability','.learning-recommendations','.user-guidance','.credibility-meter','.result-metrics','.news-information','.text-characteristics'])assert.equal(root.querySelector(selector),null,selector);
  assert.ok(root.querySelector('.analysis-overview'));
  assert.equal(root.querySelectorAll('.analysis-card strong').length,3);
  assert.ok(details.querySelector('.claim-results'));assert.ok(details.querySelector('.linguistic-comparisons'));
});

test('falha, opinião e registro antigo não recebem porcentagem inventada',t=>{
  const root=browser(t);
  for(const status of ['indisponivel','nao_aplicavel']) {
    const data=analysisFixture({estimativaIA:{status,porcentagem:null,classificacao:null,provedor:'gemini',modelo:'gemini-controlled',metodo:'estimativa_ia',motivos:status==='nao_aplicavel'?['conteudo_opinativo']:[]}});
    renderAnalysis(root,data);assert.equal(root.querySelector('.estimate-percentage'),null);
    assert.equal(root.querySelector('.estimate-gauge .estimate-empty').textContent,'—');
    assert.match(root.querySelector('.ai-estimate-summary').textContent,status==='nao_aplicavel'?/Opinião ou previsão/:/Estimativa indisponível/);
  }
  renderHistoryAnalysis(root,{texto:'Registro antigo',porcentagem:74});assert.equal(root.querySelector('.estimate-percentage'),null);
  assert.match(root.querySelector('.ai-estimate-summary').textContent,/Registro legado/);
});

test('falha da estimativa não vira opinião por causa do tipo heurístico anterior',t=>{
  const root=browser(t),data=analysisFixture({veredito:'Não verificável',classificacao:'Não verificável',estimativaIA:{status:'indisponivel',porcentagem:null,classificacao:null,provedor:'gemini',modelo:'gemini-controlled',metodo:'estimativa_ia',motivos:[]}});
  renderHistoryAnalysis(root,data);
  assert.match(root.querySelector('.ai-estimate-summary').textContent,/Estimativa indisponível/);
  assert.doesNotMatch(root.querySelector('.ai-estimate-summary').textContent,/Opinião ou previsão/);
  assert.equal(root.querySelector('.estimate-percentage'),null);
});

test('histórico com estimativa adulterada não exibe número nem executa HTML',t=>{
  const root=browser(t),attack='<img src=x onerror="alert(1)">';
  for(const value of [{...estimate(94),classificacao:attack},{...estimate(94),porcentagem:101},{...estimate(94),motivos:[attack]}]) {
    renderHistoryAnalysis(root,analysisFixture({estimativaIA:value}));
    assert.equal(root.querySelector('.estimate-percentage'),null);assert.equal(root.querySelector('img,script,[onerror]'),null);
  }
});

test('muitas checagens ficam completas nos detalhes e só três links ocupam a visão principal',t=>{
  const root=browser(t),data=analysisFixture({estimativaIA:estimate(61)});
  data.fontes=Array.from({length:5},(_,index)=>({id:'e'+index,tipo:'checagem',verificador:'Fonte '+index,titulo:'Checagem '+index,url:'https://example.org/checagem-'+index}));
  data.resultados=data.fontes.map(source=>({id:source.id,verificador:source.verificador,titulo_verificacao:source.titulo,texto_verificado:'Afirmação contextualizada.',avaliacao:'Sem avaliação',url_verificacao:source.url}));
  renderHistoryAnalysis(root,data);
  assert.equal(root.querySelectorAll('.compact-sources a').length,3);
  assert.equal(root.querySelectorAll('.result-details .verification-item').length,5);
  assert.equal(root.querySelector('.result-details').open,false);
});

test('como é feita a verificação concentra serviços e limites fora do resultado',async()=>{
  const dom=new JSDOM(await readFile(new URL('../public/html/index.html',import.meta.url),'utf8'));
  try {const method=dom.window.document.getElementById('como-funciona');
    for(const label of ['Como é feita a verificação','Google Fact Check','TensorFlow','Gemini','não uma probabilidade estatística comprovada','IA pode errar'])assert.ok(method.textContent.includes(label),label);
  }finally{dom.window.close();}
});
