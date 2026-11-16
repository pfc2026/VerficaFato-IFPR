import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {analysisFixture} from './helpers/analysis-fixture.js';

const html=await readFile(new URL('../public/html/index.html',import.meta.url),'utf8');
const invalid=[null,{}, {sucesso:true,dados:null},{sucesso:true,dados:{}},{sucesso:true,dados:{schemaVersion:2}}, {sucesso:true},{sucesso:true,dados:{schemaVersion:2,veredito:'Conteúdo verdadeiro'}}];
const faults=[...invalid.map(payload=>({payload,name:JSON.stringify(payload),expected:/resposta inválida ou incompleta/})),
  {name:'network',network:true,expected:/conectar.*conexão/},
  ...['Unexpected end of JSON input','Unexpected token < in JSON'].map(parser=>({name:parser,parser,expected:/resposta inválida ou incompleta/})),
  ...[429,500,503,504].map(status=>({name:'HTTP '+status,status,expected:status===429?/Muitas consultas/:status===504?/demorou/:status===503?/indisponível/:/concluir a análise/})),
  {name:'frontend deadline',pending:true,expected:/demorou mais/}];
let sequence=0;
async function exercise(fault) {
  const dom=new JSDOM(html,{url:'https://local.example/'});
  const names=['window','document','DOMParser','localStorage','navigator','bootstrap','fetch','setTimeout','clearTimeout'];
  const original=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const bind=(name,value)=>Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  let success=false,shows=0,hides=0,timeoutCallback;const diagnostics=[];
  const oldWarn=console.warn;console.warn=(...args)=>diagnostics.push(args);
  bind('window',dom.window);bind('document',dom.window.document);bind('DOMParser',dom.window.DOMParser);bind('localStorage',dom.window.localStorage);bind('navigator',dom.window.navigator);
  bind('bootstrap',{Modal:{getInstance:()=>({hide(){hides++;}}),getOrCreateInstance:()=>({show(){shows++;}})}});
  bind('setTimeout',(callback,ms)=>{if(ms===90000)timeoutCallback=callback;return 1;});bind('clearTimeout',()=>{});
  bind('fetch',async(url,options={})=>{
    if(url==='/api/education')return {ok:true,json:async()=>({sucesso:true,licoes:[]})};
    if(success)return {ok:true,status:200,json:async()=>({sucesso:true,dados:analysisFixture()})};
    if(fault.network)throw new TypeError('Failed to fetch SECRET_PROVIDER');
    if(fault.pending)return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('internal'),{name:'AbortError'})),{once:true}));
    return {ok:!fault.status,status:fault.status||200,json:async()=>{
      if(fault.parser)throw new SyntaxError(fault.parser+' SECRET_PROVIDER');
      return fault.status?{sucesso:false,erro:'SECRET_PROVIDER <raw stack>'}:fault.payload;
    }};
  });
  const settle=async()=>{for(let i=0;i<5;i++)await new Promise(setImmediate);};
  try {
    await import('../public/js/main.js?contract='+ ++sequence);
    await settle();
    const form=document.getElementById('verificationForm'),button=document.getElementById('submitBtn');
    document.getElementById('newsText').value='A prefeitura anunciou uma nova biblioteca em 2025.';
    document.getElementById('modalContent').textContent='PARECER_ANTERIOR';
    form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
    assert.equal(button.disabled,true);assert.equal(form.getAttribute('aria-busy'),'true');
    await settle();if(fault.pending){assert.equal(typeof timeoutCallback,'function');timeoutCallback();await settle();}
    const alert=document.getElementById('alertContainer').textContent;
    assert.match(alert,fault.expected);assert.doesNotMatch(alert,/Failed to fetch|Unexpected|Cannot read|SECRET_PROVIDER|stack/);
    assert.equal(shows,0);assert.ok(hides>0);assert.equal(document.getElementById('modalContent').textContent,'');
    assert.equal(button.disabled,false);assert.equal(form.getAttribute('aria-busy'),'false');assert.ok(button.querySelector('.loading-spinner').classList.contains('d-none'));
    assert.doesNotMatch(JSON.stringify(diagnostics),/SECRET_PROVIDER|raw stack/);
    success=true;
    form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await settle();
    assert.equal(shows,1);assert.equal(button.disabled,false);assert.equal(form.getAttribute('aria-busy'),'false');
    assert.match(document.querySelector('.factual-summary').textContent,/Sem evidências suficientes/);
    assert.equal(document.querySelector('.credibility-meter'),null);
    assert.equal(document.querySelector('.analysis-card strong'),null);
    assert.equal(document.querySelector('.service-availability'),null);
    assert.match(document.querySelector('.linguistic-comparisons').textContent,/runtime disponível; nenhuma comparação executada; nenhum modelo treinado utilizado/);
  } finally {
    console.warn=oldWarn;dom.window.close();
    for(const name of names){const descriptor=original.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
  }
}
for(const fault of faults)test('F01/F04/F06/F07 formulário real recupera após '+fault.name,()=>exercise(fault));
