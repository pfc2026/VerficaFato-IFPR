import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderAnalysis } from '../public/js/result-renderer.js';

function reference(overrides={}) {
  return {
    id:'cp-317',lei:'Código Penal',artigo:'317',categoria:'acontecimento_noticiado',
    explicacao:'Trata da solicitação ou do recebimento de vantagem indevida por agente público.',
    relacao_com_noticia:'A notícia relata uma investigação sobre pedido de vantagem indevida.',
    trecho_noticia:'A polícia investiga suspeita de corrupção passiva.',
    consequencias:'As consequências dependem da conduta e das circunstâncias apuradas.',
    situacao_juridica:'Investigação',ressalvas:'A investigação não comprova a prática de crime.',
    fonte_oficial:'https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-2848-7-dezembro-1940-412868-publicacaooriginal-1-pe.html',
    verificada:true,verificado_em:'2026-11-11',revisar_ate:'2026-12-11',...overrides
  };
}
function browser(t) {
  const dom=new JSDOM('<div id="result"></div>');
  const previous=globalThis.document;
  globalThis.document=dom.window.document;
  t.after(()=>{globalThis.document=previous;dom.window.close();});
  const root=document.getElementById('result');
  return {
    root,
    render(contexto_juridico,extra={}) {renderAnalysis(root,{schemaVersion:2,contexto_juridico,...extra});return root;}
  };
}

test('notícia comum, contexto não aplicável e referência não verificada não criam seção nem aviso vazio',t=>{
  const app=browser(t);
  for(const context of [undefined,{aplicavel:false,referencias:[]},{aplicavel:false,referencias:[reference()]},{aplicavel:true,referencias:[]},{aplicavel:true,referencias:[reference({verificada:false})]}]) {
    app.render(context);
    assert.equal(app.root.querySelector('.legal-context'),null);
    assert.doesNotMatch(app.root.textContent,/Nenhuma lei encontrada|Contexto Jurídico/);
    assert.ok(app.root.querySelector('.factual-summary'));
    assert.ok(app.root.querySelector('.gemini-feedback'));
  }
});

test('referência verificada exibe artigo, relação, situação, ressalva e fonte em seção separada',t=>{
  const app=browser(t),ref=reference();
  const root=app.render({aplicavel:true,referencias:[ref]});
  const section=root.querySelector('.legal-context');
  assert.match(section.querySelector('h6').textContent,/Contexto Jurídico/);
  assert.ok(section.querySelector('.fa-scale-balanced[aria-hidden="true"]'));
  assert.ok(section.querySelector('.legal-reference[open]'));
  for(const value of [ref.lei,'Art. 317','Acontecimento noticiado',ref.explicacao,ref.relacao_com_noticia,ref.consequencias,ref.situacao_juridica,ref.ressalvas,ref.trecho_noticia,'11/11/2026']) assert.ok(section.textContent.includes(value),value);
  const source=section.querySelector('.legal-official-source');
  assert.equal(source.href,ref.fonte_oficial);
  assert.equal(source.target,'_blank');
  assert.equal(source.rel,'noopener noreferrer');
  assert.equal(section.previousElementSibling.classList.contains('gemini-feedback'),true);
});

test('riscos da publicação ficam expressamente distintos dos acontecimentos noticiados',t=>{
  const app=browser(t);
  const root=app.render({aplicavel:true,referencias:[reference(),reference({id:'cp-138',artigo:'138',categoria:'publicacao',situacao_juridica:'Situação não identificada'})]});
  assert.deepEqual([...root.querySelectorAll('.legal-category')].map(node=>node.textContent),['Acontecimento noticiado','Própria publicação']);
  assert.match(root.querySelectorAll('.legal-reference')[1].textContent,/Situação não identificada/);
});

test('até três referências aparecem inicialmente; demais ficam recolhidas e total é limitado a seis',t=>{
  const app=browser(t);
  const root=app.render({aplicavel:true,referencias:Array.from({length:8},(_,index)=>reference({id:'ref-'+index,artigo:String(100+index)}))});
  assert.equal(root.querySelectorAll('.legal-initial-references > .legal-reference').length,3);
  assert.equal(root.querySelectorAll('.legal-reference').length,6);
  const more=root.querySelector('.legal-more-references');
  assert.equal(more.open,false);
  assert.match(more.querySelector('summary').textContent,/Mais referências jurídicas \(3\)/);
  assert.equal(root.querySelectorAll('.legal-reference[open]').length,1);
});

test('links não oficiais, inseguros e referências incompletas são rejeitados sem esconder análise principal',t=>{
  const app=browser(t);
  const invalid=[
    ...['https://inventada.example/lei','https://www.tse.jus.br.evil.example/lei','https://www.tse.jus.br@evil.example/lei','javascript:alert(1)','http://www.tse.jus.br/lei','https://www.tse.jus.br:1234/lei','https://www.tse.jus.br/lei\n'].map(fonte_oficial=>reference({fonte_oficial})),
    reference({lei:''}),reference({artigo:''}),reference({categoria:'outra'}),reference({explicacao:null}),null
  ];
  const root=app.render({aplicavel:true,referencias:invalid});
  assert.equal(root.querySelector('.legal-context'),null);
  assert.ok(root.querySelector('.factual-summary'));
});

test('texto jurídico hostil não executa conteúdo e referências duplicadas não geram cards repetidos',t=>{
  const app=browser(t),attack='<img src=x onerror="alert(1)"><script>alert(1)</script>';
  const ref=reference({lei:attack,explicacao:attack,relacao_com_noticia:attack,consequencias:attack,trecho_noticia:attack,ressalvas:attack});
  const root=app.render({aplicavel:true,referencias:[ref,ref]});
  assert.equal(root.querySelectorAll('.legal-reference').length,1);
  assert.ok(root.querySelector('.legal-context').textContent.includes(attack));
  assert.equal(root.querySelectorAll('.legal-context script,.legal-context img,.legal-context [onerror],.legal-context [onclick]').length,0);
});

test('histórico v2 preserva jurídico e feedback identifica o provedor selecionado',t=>{
  const app=browser(t);
  renderAnalysis(app.root,{resultado:{schemaVersion:2,contexto_juridico:{aplicavel:true,referencias:[reference()]},feedbackGemini:{status:'ia',provedor:'openai',texto:'Confira as fontes originais antes de compartilhar.'}}});
  assert.ok(app.root.querySelector('.legal-context'));
  assert.match(app.root.querySelector('.gemini-feedback h6').textContent,/Feedback da OpenAI/);
  assert.doesNotMatch(app.root.querySelector('.gemini-feedback').textContent,/Gemini/);
});
