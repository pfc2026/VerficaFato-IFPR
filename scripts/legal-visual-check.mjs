// Real Gemini results -> shared browser renderer. This script makes no AI calls.
// First run: node scripts/verify-gemini-live.mjs
// Then: node scripts/legal-visual-check.mjs
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { analisarConteudo } from '../services/analysis.js';
import { generateExplanation } from '../services/explanation.js';
import { legalCandidates, validateLegalContext } from '../services/legal-context.js';

const root=process.cwd(),artifacts=path.join(root,'.artifacts');
await mkdir(artifacts,{recursive:true});
const fixture=process.argv.includes('--fixture');
let source;
if(fixture) {
  const text='Um servidor público é investigado por solicitar vantagem indevida e por apropriação de dinheiro público, descrita como peculato. Um empresário teria oferecido propina a outro funcionário público para influenciar ato de ofício. Uma empresa confirmou vazamento de dados pessoais de clientes, com acesso não autorizado e risco relevante aos titulares; a autoridade apura a comunicação do incidente. Em caso distinto, o Ministério Público investiga discriminação racial e incitação ao preconceito.';
  const candidates=legalCandidates(text);
  const selections=candidates.slice(0,6).map(candidate=>({id:candidate.id,categoria:'acontecimento_noticiado',trecho_noticia:text,situacao_juridica:'Situação não identificada',trecho_situacao:''}));
  const context=validateLegalContext({aplicavel:true,referencias:selections},{text,candidates});
  assert.equal(context.referencias.length,6,'Boundary fixture must contain six backend-validated references.');
  const result=await analisarConteudo({texto:text},{
    check:async trecho=>({apiDisponivel:true,resultados:[{id:'qa-'+createHash('sha256').update(trecho).digest('hex').slice(0,12),texto_verificado:trecho,titulo_verificacao:'Comparação local de UI; não é checagem publicada',url_verificacao:'https://example.com/fixture-ui',verificador:'Fixture local de UI',avaliacao:'Não classificada'}]}),
    explain:value=>generateExplanation(value,{enabled:false})
  });
  result.contexto_juridico=context;
  result.geracao={status:'local',estado:'fixture',metodo:'fixture visual; sem chamada ao Gemini'};
  result.feedbackGemini={status:'local',estado:'fixture',texto:'Cenário local de inspeção visual. As referências passaram pelo validador do backend e as comparações foram calculadas pelo TensorFlow. Não houve chamada ao Gemini nem consulta real a checagens.'};
  source={cases:[{id:'fixture-limite',http:200,resultado:result}]};
} else source=JSON.parse(await readFile(path.join(artifacts,'gemini-live-results.json'),'utf8'));
const cases=source.cases.filter(item=>item.resultado&&item.http===200);
assert.ok(cases.length,'No successful HTTP results available for browser QA.');
assert.ok(cases.some(item=>item.resultado.contexto_juridico?.referencias?.length),'No verified legal references available for browser QA.');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
const server=createServer(async(req,res)=>{
  if(req.url==='/qa-results.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({cases}));return;}
  if(req.url==='/api/education'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({sucesso:true,licoes:[]}));return;}
  let relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(relative==='/')relative='/html/index.html';
  const file=path.resolve(root,'public','.'+relative);
  if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}
  try{const content=await readFile(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(content);}
  catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const profile=path.join(artifacts,'chrome-legal-qa-'+process.pid);
const chrome=spawn(process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[
  '--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--remote-allow-origins=*',
  '--user-data-dir='+profile,'--disable-background-networking','--disable-component-update','--disable-crash-reporter','--disable-breakpad','about:blank'
],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let stderr='',socket,commandId=0;
chrome.stderr.on('data',chunk=>{stderr+=chunk.toString();});
const pending=new Map(),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const report={executado_em:new Date().toISOString(),origem:fixture?'fixture visual local; contexto validado no backend e TensorFlow real; sem Gemini':'resultados reais do Gemini; sem novas chamadas de IA',cases:[]};
try {
  let debugPort;
  for(let attempt=0;attempt<80;attempt++){try{debugPort=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await pause(125);}}
  if(!debugPort)throw new Error('Chrome debugging unavailable: '+stderr.slice(-400));
  const targets=await (await fetch('http://127.0.0.1:'+debugPort+'/json/list')).json();
  socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id&&pending.has(message.id)){const request=pending.get(message.id);pending.delete(message.id);message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);}
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++commandId;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const ready=async expression=>{for(let attempt=0;attempt<120;attempt++){if(await evaluate(expression))return;await pause(100);}throw new Error('Browser readiness timeout: '+expression);};
  const screenshot=async name=>{const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,name),Buffer.from(png.data,'base64'));};
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin});
  await ready("document.readyState==='complete'&&Boolean(window.bootstrap?.Modal)");
  await evaluate("document.fonts.ready.then(()=>true)");
  await evaluate("document.documentElement.setAttribute('data-theme','dark'); true");
  for(const item of cases) {
    const id=item.id;
    await evaluate(`(async()=>{const data=await(await fetch('/qa-results.json')).json();const item=data.cases.find(item=>item.id===${JSON.stringify(id)});const{renderAnalysis}=await import('/js/result-renderer.js');renderAnalysis(document.getElementById('modalContent'),item.resultado);bootstrap.Modal.getOrCreateInstance(document.getElementById('resultsModal')).show();return true;})()`);
    await pause(180);
    const output={id,legalEsperado:item.resultado.contexto_juridico?.aplicavel===true&&Boolean(item.resultado.contexto_juridico?.referencias?.length),viewports:[]};
    for(const viewport of [{name:'desktop',width:1440,height:1100,mobile:false},{name:'mobile',width:390,height:844,mobile:true}]) {
      await send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:viewport.mobile});
      await pause(150);
      const state=await evaluate(`(()=>{const root=document.getElementById('modalContent'),legal=root.querySelector('.legal-context'),ml=root.querySelector('.linguistic-comparisons');if(legal){legal.querySelectorAll('.legal-reference').forEach((item,index)=>item.open=index===0);const more=legal.querySelector('.legal-more-references');if(more)more.open=false;legal.scrollIntoView({block:'start'});}else if(ml)ml.scrollIntoView({block:'start'});return{body:document.body.scrollWidth,viewport:innerWidth,container:root.scrollWidth,available:root.clientWidth,legal:!!legal,initial:root.querySelectorAll('.legal-initial-references>.legal-reference').length,moreClosed:!root.querySelector('.legal-more-references')?.open,feedback:root.querySelector('.gemini-feedback-text')?.textContent,ml:!!ml};})()`);
      assert.equal(state.legal,output.legalEsperado,id+' legal visibility');
      assert.ok(state.initial<=3,id+' initial reference limit');
      assert.equal(state.moreClosed,true,id+' additional references initially collapsed');
      assert.ok(state.container<=state.available+1,id+' horizontal modal overflow');
      assert.ok(state.body<=state.viewport+1,id+' horizontal page overflow');
      assert.ok(state.feedback,id+' feedback missing');
      await screenshot('legal-'+id+'-'+viewport.name+'.png');
      if(state.legal){
        const expanded=await evaluate("(()=>{const root=document.getElementById('modalContent');root.querySelectorAll('.legal-reference').forEach(item=>item.open=true);const more=root.querySelector('.legal-more-references');if(more)more.querySelector('summary').click();const links=root.querySelectorAll('.legal-official-source');links[links.length-1]?.scrollIntoView({block:'center'});return{overflow:root.scrollWidth-root.clientWidth,extraExpanded:more?more.open:null,total:root.querySelectorAll('.legal-reference').length};})()");
        assert.ok(expanded.overflow<=1,id+' expanded legal cards overflow');
        assert.ok(expanded.total<=6,id+' total reference limit');
        if(expanded.extraExpanded!==null)assert.equal(expanded.extraExpanded,true,id+' native disclosure of additional references');
        state.expanded=expanded;
        await screenshot('legal-'+id+'-'+viewport.name+'-sources.png');
      }
      if(state.ml){
        const overflow=await evaluate("(()=>{const details=document.querySelector('.linguistic-comparisons details');details.open=true;details.scrollIntoView({block:'start'});const root=document.getElementById('modalContent');return root.scrollWidth-root.clientWidth;})()");
        assert.ok(overflow<=1,id+' expanded ML comparison overflow');
        await screenshot('legal-'+id+'-'+viewport.name+'-ml.png');
      }
      output.viewports.push({name:viewport.name,...state});
      console.log(id+' '+viewport.name+': legal='+state.legal+', initial='+state.initial+', overflow='+(state.container-state.available));
    }
    report.cases.push(output);
  }
  await writeFile(path.join(artifacts,fixture?'legal-visual-fixture-report.json':'legal-visual-report.json'),JSON.stringify(report,null,2)+'\n');
  await send('Browser.close').catch(()=>{});
} catch(error){console.error(error.message);process.exitCode=1;}
finally{socket?.close();chrome.kill();await new Promise(resolve=>server.close(resolve));}
