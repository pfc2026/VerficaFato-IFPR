import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { renderAnalysis, normalizeResult, resultLabel } from '../public/js/result-renderer.js';
import { safeWebUrl, sanitizeLessonHtml, showNotice } from '../public/js/safe-dom.js';
import { detectInput } from '../public/js/input.js';
import { criarAnaliseVisual } from '../services/verification-indicators.js';

const attack = '<img src=x onerror="window.pwned=1"><script>window.pwned=2</script>';
function browser() {
  const dom = new JSDOM('<!doctype html><body><div id="result"></div><div id="alertContainer"></div></body>', {url:'https://verificafato.example'});
  globalThis.document = dom.window.document;
  globalThis.DOMParser = dom.window.DOMParser;
  return { dom, root: dom.window.document.getElementById('result') };
}
function result(overrides={}) {
  return { schemaVersion:2, veredito:'Sem evidências suficientes', resumo:'Uma afirmação enviada.',
    justificativa:'As fontes não permitem concluir.', afirmacoes:[], resultados:[], fontes:[],
    analiseLinguagem:{indicadores:[],tensorflow:{disponivel:false,limitacoes:[]}}, secoes:{},limitacoes:[], ...overrides };
}
test('texto, afirmação curta, mensagem e URL são detectados sem exigir link', () => {
  assert.deepEqual(detectInput('Uma afirmação de teste.'), {texto:'Uma afirmação de teste.',link:''});
  assert.deepEqual(detectInput('https://example.com/noticia'), {texto:'',link:'https://example.com/noticia'});
  assert.deepEqual(detectInput('', 'https://example.com/noticia'), {texto:'',link:'https://example.com/noticia'});
  assert.equal(detectInput('https://example.com\nEsta é uma mensagem encaminhada.').link, '');
  assert.throws(()=>detectInput('texto válido de entrada','https://example.com'));
  assert.throws(()=>detectInput('muito pouco'.repeat(2001)), /20.000/);
  assert.throws(()=>detectInput('oi'), /10/);
  assert.throws(()=>detectInput('ftp://example.com'));
});
test('URLs ativas, credenciais e caracteres de controle são rejeitados', () => {
  for (const url of ['javascript:alert(1)','data:text/html,x','ftp://example.com','https://user:pass@example.com','java\nscript:alert(1)','https://example.com\nx']) assert.equal(safeWebUrl(url),null,url);
  assert.equal(safeWebUrl('https://example.com/check?q=a&b=c'),'https://example.com/check?q=a&b=c');
});
test('resultado restaura medidor, contadores e cartões da imagem com feedback separado', () => {
  const {dom,root}=browser();
  const input='flavio bolsonaro teve um romance com o lula?';
  const visual=criarAnaliseVisual(input);
  const feedback='A pergunta precisa de contexto e fontes verificáveis. Confira a origem da mensagem antes de compartilhar.';
  renderAnalysis(root,result({porcentagem:null,confianca:null,analiseVisual:visual,
    feedbackGemini:{texto:feedback,status:'ia',provedor:'gemini',referencias:[]}}));
  assert.equal(root.querySelector('.meter-percentage').textContent,'50%');
  assert.deepEqual([...root.querySelectorAll('.metric-value')].map(node=>node.textContent),['0','0','8','0']);
  assert.match(root.querySelector('.credibility-meter').textContent,/Inconclusivo \/ Verificar/);
  assert.match(root.querySelector('.credibility-meter').textContent,/não representa probabilidade/);
  assert.deepEqual([...root.querySelectorAll('.analysis-card strong')].map(node=>node.textContent),['0/100','0/100','8/100']);
  assert.match(root.querySelector('.news-information').textContent,/flavio bolsonaro teve um romance com o lula\?/);
  assert.match(root.querySelector('.text-characteristics').textContent,/8 palavra/);
  assert.equal(root.querySelectorAll('.gemini-feedback').length,1);
  assert.equal(root.querySelector('.gemini-feedback-text').textContent,feedback);
  const nodes=[...root.querySelector('.restored-results').children];
  assert.ok(nodes.indexOf(root.querySelector('.gemini-feedback'))>nodes.indexOf(root.querySelector('.text-characteristics')));
  assert.equal(root.querySelectorAll('h3').length,0);
  assert.equal(resultLabel({resultado:result({analiseVisual:visual})}),'Inconclusivo / Verificar');
  dom.window.close();
});

test('resultado sem indicadores armazenados não recebe porcentagem inventada', () => {
  const {dom,root}=browser();
  renderAnalysis(root,result({porcentagem:99,confianca:'alta'}));
  assert.equal(root.querySelector('.meter-percentage').textContent,'—');
  assert.doesNotMatch(root.textContent,/99%|Confiança alta/);
  assert.match(root.querySelector('.gemini-feedback').textContent,/não está disponível/);
  dom.window.close();
});

test('conteúdo hostil em todos os campos é renderizado como texto e links ativos são bloqueados', () => {
  const {dom,root}=browser();
  renderAnalysis(root,result({
    resumo:attack, justificativa:attack,
    afirmacoes:[{texto:attack,tipo:'fato',veredito:attack,justificativa:attack,evidencias:[{texto_verificado:attack,url:'javascript:alert(1)'}]}],
    resultados:[{titulo_verificacao:attack,texto_verificado:attack,avaliacao:attack,verificador:attack,data_verificacao:attack,url_verificacao:'javascript:alert(1)'}],
    fontes:[{titulo:attack,verificador:attack,data:attack,url:'data:text/html,x'}],
    analiseLinguagem:{indicadores:[{label:attack,trecho:attack}],tensorflow:{disponivel:false,limitacoes:[attack]}},
    secoes:{encontramos:attack,linguagem:attack,orientacao:attack,limitacoes:attack},
    noticiasRegionais:[{titulo:attack,fonte:attack,url:'javascript:alert(1)'}],limitacoes:[attack]
  }));
  assert.equal(root.querySelectorAll('script,img,iframe,svg,[onerror],[onclick]').length,0);
  assert.equal(root.querySelectorAll('a').length,0);
  assert.ok(root.textContent.includes(attack));
  assert.equal(dom.window.pwned,undefined);
  dom.window.close();
});
test('fontes reais mantêm URL, atribuição, datas e avaliação original', () => {
  const {dom,root}=browser();
  renderAnalysis(root,result({resultados:[{
    titulo_verificacao:'Checagem original',texto_verificado:'A afirmação verificada.',
    avaliacao:'Falso',verificador:'Verificador de exemplo',data_verificacao:'2026-10-20',url_verificacao:'https://example.com/checagem'
  }]}));
  assert.match(root.textContent,/Avaliação publicada: Falso/);
  assert.match(root.textContent,/Verificador de exemplo/);
  assert.match(root.textContent,/2026-10-20/);
  for (const link of root.querySelectorAll('a')) {
    assert.equal(link.href,'https://example.com/checagem');
    assert.equal(link.rel,'noopener noreferrer');
    assert.equal(link.target,'_blank');
  }
  dom.window.close();
});
test('pontuações legadas nunca são revalidadas nem reproduzidas como verdade', () => {
  const {dom,root}=browser();
  const old={texto:'Uma notícia antiga.',porcentagem:100,veredito:'Provavelmente Verdadeira'};
  assert.equal(resultLabel(old),'Registro legado');
  assert.equal(normalizeResult(old).veredito,'Sem evidências suficientes');
  renderAnalysis(root,old);
  assert.match(root.textContent,/Registro legado/);
  assert.match(root.textContent,/não foram revalidados/);
  assert.doesNotMatch(root.textContent,/100%|Provavelmente Verdadeira/);
  assert.equal(resultLabel({resultado:result({veredito:'Falso'})}),'Falso');
  dom.window.close();
});
test('sanitização preserva formatação de lições e remove execução, atributos e links perigosos', () => {
  const {dom}=browser();
  const html=sanitizeLessonHtml('<h3 onclick="alert(1)">Título</h3><p>Texto <strong>importante</strong></p><img src=x onerror=alert(1)><script>alert(1)</script><svg onload=alert(1)></svg><a href="javascript:alert(1)">ruim</a><a href="https://example.com" style="color:red">Fonte</a>');
  const output=document.createElement('div');
  output.innerHTML=html;
  assert.equal(output.querySelectorAll('script,img,svg,[onclick],[onerror],[style]').length,0);
  assert.equal(output.querySelector('h3').textContent,'Título');
  assert.equal(output.querySelector('strong').textContent,'importante');
  assert.equal(output.querySelectorAll('a[href]').length,1);
  assert.equal(output.querySelector('a[href]').href,'https://example.com/');
  dom.window.close();
});
test('mensagens de erro não interpretam marcação HTML', () => {
  const {dom}=browser();
  const realTimeout=globalThis.setTimeout;
  globalThis.setTimeout=()=>0;
  try { showNotice(attack,'danger'); }
  finally { globalThis.setTimeout=realTimeout; }
  assert.equal(document.querySelectorAll('#alertContainer img, #alertContainer script').length,0);
  assert.ok(document.getElementById('alertContainer').textContent.includes(attack));
  dom.window.close();
});
test('telas usam módulos e não possuem manipuladores inline', async () => {
  for (const page of ['index','Historico','Admin','Login']) {
    const html=await readFile(new URL('../public/html/'+page+'.html',import.meta.url),'utf8');
    assert.doesNotMatch(html,/\son(?:click|submit|error|load)=/i);
    assert.match(html,/<script type="module" src="\/js\//);
  }
});

test('nomes, perfil, foto e erros externos permanecem inertes no modal da conta', async () => {
  const {dom}=browser();
  const original={fetch:globalThis.fetch,bootstrap:globalThis.bootstrap,localStorage:globalThis.localStorage,window:globalThis.window};
  globalThis.window=dom.window;
  globalThis.localStorage=dom.window.localStorage;
  globalThis.bootstrap={Modal:{getOrCreateInstance:()=>({show(){},hide(){}})}};
  globalThis.fetch=async()=>({json:async()=>({sucesso:true,usuario:{nome:attack,email:attack,cidade:attack,fotoPerfil:'javascript:alert(1)',totalVerificacoes:attack,createdAt:'2026-10-20',role:'user'}})});
  try {
    const {mostrarModalPerfil}=await import('../public/js/account.js');
    mostrarModalPerfil();
    await new Promise(setImmediate);
    const body=document.getElementById('profileModalBody');
    assert.equal(body.querySelectorAll('script,img,[onerror],[onclick]').length,0);
    assert.ok(body.textContent.includes(attack));
    globalThis.fetch=async()=>({json:async()=>({sucesso:false,erro:attack})});
    mostrarModalPerfil();
    await new Promise(setImmediate);
    assert.equal(body.querySelectorAll('script,img').length,0);
    assert.ok(body.textContent.includes(attack));
  } finally {Object.assign(globalThis,original);dom.window.close();}
});
test('troca de senha limpa a sessão invalidada no servidor', async () => {
  const {dom}=browser();
  const original={fetch:globalThis.fetch,bootstrap:globalThis.bootstrap,localStorage:globalThis.localStorage,window:globalThis.window,setTimeout:globalThis.setTimeout};
  globalThis.window=dom.window;
  globalThis.localStorage=dom.window.localStorage;
  globalThis.bootstrap={Modal:{getOrCreateInstance:()=>({show(){},hide(){}})}};
  localStorage.setItem('vf-token','old-token');
  localStorage.setItem('vf-user','{"nome":"Leitor"}');
  globalThis.fetch=async()=>({ok:true,json:async()=>({sucesso:true,usuario:{nome:'Leitor',email:'leitor@example.com',createdAt:'2026-10-20',role:'user'}})});
  try {
    const {mostrarModalPerfil}=await import('../public/js/account.js');
    mostrarModalPerfil();
    await new Promise(setImmediate);
    document.querySelector('[data-account-action=senha]').click();
    document.getElementById('accountCurrentPassword').value='senha-atual-123';
    document.getElementById('accountNewPassword').value='nova-senha-1234';
    document.getElementById('accountConfirmPassword').value='nova-senha-1234';
    let redirectScheduled=false;
    globalThis.setTimeout=()=>{redirectScheduled=true;return 0;};
    document.getElementById('accountActionForm').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
    await new Promise(setImmediate);
    assert.equal(localStorage.getItem('vf-token'),null);
    assert.equal(localStorage.getItem('vf-user'),null);
    assert.equal(redirectScheduled,true);
    assert.match(document.getElementById('accountActionMessage').textContent,/login novamente/);
  } finally {Object.assign(globalThis,original);dom.window.close();}
});

test('CRUD administrativo mantém texto, nomes, fontes e IDs hostis inertes', async () => {
  const html=await readFile(new URL('../public/html/Admin.html',import.meta.url),'utf8');
  const dom=new JSDOM(html,{url:'https://verificafato.example/html/Admin.html'});
  const original={fetch:globalThis.fetch,bootstrap:globalThis.bootstrap,localStorage:globalThis.localStorage,window:globalThis.window,document:globalThis.document,DOMParser:globalThis.DOMParser};
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;globalThis.DOMParser=dom.window.DOMParser;
  globalThis.bootstrap={Modal:{getOrCreateInstance:()=>({show(){},hide(){}})}};
  localStorage.setItem('vf-token','token');
  localStorage.setItem('vf-user','{"id":"self","nome":"Admin","role":"admin"}');
  const hostileId="x');alert(1)//";
  const record={_id:hostileId,texto:attack,userId:{nome:attack,email:attack},createdAt:'2026-10-20',resultado:result({resumo:attack})};
  globalThis.fetch=async url=>({ok:true,json:async()=>({
    sucesso:true,
    resumo:{totalUsuarios:1,totalFontes:1,totalLicoes:1,totalVerificacoes:1,ultimasVerificacoes:[record]},
    fontes:[{_id:hostileId,nome:attack,url:'javascript:alert(1)',ordem:0,ativo:true}],
    licoes:[{_id:hostileId,lessonId:attack,titulo:attack,categoria:attack,nivel:attack,ordem:0,ativo:true}],
    usuarios:[{_id:hostileId,nome:attack,email:attack,ativo:true,role:'user'}],
    verificacoes:[record]
  })});
  try {
    await import('../public/js/Admin.js');
    for (const tab of ['resumo','fontes','licoes','usuarios','verificacoes']) {
      window.switchTab(tab);
      await new Promise(setImmediate);
    }
    for (const id of ['resumo-recentes-list','fontes-table-body','licoes-table-body','usuarios-table-body','verificacoes-table-body']) {
      const table=document.getElementById(id);
      assert.equal(table.querySelectorAll('img,script,svg,[onclick],[onerror],a[href^="javascript:"]').length,0,id);
      assert.ok(table.textContent.includes(attack),id);
    }
    document.querySelector('#verificacoes-table-body button').click();
    assert.equal(document.getElementById('modalContent').querySelectorAll('script,img,[onerror]').length,0);
    assert.ok(document.getElementById('modalContent').textContent.includes(attack));
  } finally {Object.assign(globalThis,original);dom.window.close();}
});

test('feedback e limitações aparecem uma vez e fontes da IA vêm do servidor', () => {
  const {dom,root}=browser();
  const feedback='Confira o documento original e o contexto antes de compartilhar a mensagem recebida.';
  const limitation='A busca tem cobertura limitada.';
  const real={id:'e1',titulo:'Fonte original',url:'https://example.com/checagem',tipo:'checagem'};
  renderAnalysis(root,result({
    fontes:[real],
    feedbackGemini:{texto:feedback,status:'ia',provedor:'gemini',referencias:[
      {id:'e1',url:'https://inventada.example/fonte'}, {id:'desconhecido',url:'https://outra.example/fonte'}
    ]},
    secoes:{limitacoes:limitation},limitacoes:[limitation,limitation]
  }));
  assert.equal(root.textContent.split(feedback).length-1,1);
  assert.equal(root.textContent.split(limitation).length-1,1);
  const links=[...root.querySelectorAll('.feedback-references a')];
  assert.equal(links.length,1);assert.equal(links[0].href,real.url);
  assert.doesNotMatch(root.textContent,/inventada\.example|outra\.example/);
  dom.window.close();
});

test('feedback e indicadores hostis ficam inertes sem executar conteúdo', () => {
  const {dom,root}=browser();
  const visual=criarAnaliseVisual('Uma mensagem de teste que precisa ser conferida.');
  visual.veredito=attack;visual.explicacao=attack;
  visual.dimensoes.informacoes.alegacaoPrincipal=attack;
  visual.dimensoes.informacoes.links=['javascript:alert(1)'];
  renderAnalysis(root,result({analiseVisual:visual,feedbackGemini:{texto:attack,status:'ia',referencias:[{id:'inventada',url:'javascript:alert(1)'}]}}));
  assert.equal(root.querySelector('.gemini-feedback-text').textContent,attack);
  assert.equal(root.querySelectorAll('script,img,iframe,svg,[onerror],[onclick],a[href^="javascript:"]').length,0);
  assert.equal(dom.window.pwned,undefined);
  dom.window.close();
});
