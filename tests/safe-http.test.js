import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { assertPublicUrl,parsePublicUrl,isPublicAddress,safeGet } from '../services/safe-http.js';
const publicDNS=async()=>[{address:'93.184.216.34',family:4}];
function stubTransport(responses,inspected=[]) {
  return (url,options,callback)=>{
    inspected.push({url:url.href,options});
    const req=new EventEmitter();
    const abort=()=>{const e=new Error('AbortError');e.name='AbortError';req.emit('error',e);};
    options.signal.addEventListener('abort',abort,{once:true});
    req.end=()=>queueMicrotask(()=>{
      const response=responses.shift();
      if(response?.hang){ const timer=setTimeout(()=>{},1000);options.signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});return; }
      const stream=Readable.from(response?.chunks || [Buffer.from(response?.text || '')]);
      stream.statusCode=response?.status || 200;stream.headers=response?.headers || {};
      stream.once('close',()=>options.signal.removeEventListener('abort',abort));callback(stream);
    });
    return req;
  };
}
test('SSRF: loopback, private, metadata, multicast, reserved, mapped IPv6 and alternate IPv4 syntax blocked',()=>{
  const values=['http://127.0.0.1','http://127.1','http://2130706433','http://0x7f000001','http://0177.0.0.1','http://10.0.0.1','http://172.16.0.1','http://192.168.1.1','http://169.254.169.254','http://0.0.0.0','http://100.64.0.1','http://198.18.0.1','http://224.0.0.1','http://[::1]','http://[::ffff:127.0.0.1]','http://[fc00::1]','http://[fe80::1]','http://[2001:db8::1]','http://localhost','http://foo.internal','file:///etc/passwd','ftp://example.org','https://user:password@example.org','http://example.org:8080'];
  for(const value of values)assert.throws(()=>parsePublicUrl(value),undefined,value);
  assert.equal(isPublicAddress('8.8.8.8'),true);assert.equal(isPublicAddress('2606:4700:4700::1111'),true);
});
test('DNS responses with any non-public answer are rejected',async()=>{
  await assert.rejects(()=>assertPublicUrl('https://news.example.org',{lookup:async()=>[{address:'8.8.8.8',family:4},{address:'10.1.2.3',family:4}]}),error=>error.code==='SSRF_BLOCKED');
});
test('redirect is checked before any request to private target',async()=>{
  const requests=[];
  await assert.rejects(()=>safeGet('https://news.example.org',{lookup:publicDNS,requestFn:stubTransport([
    {status:302,headers:{location:'https://127.0.0.1/private'}}
  ],requests)}),error=>error.code==='SSRF_BLOCKED');
  assert.equal(requests.length,1);
});
test('DNS pinning prevents a second resolving connection lookup',async()=>{
  let lookups=0;const requests=[];
  const result=await safeGet('https://news.example.org',{lookup:async()=>{lookups++;return [{address:'93.184.216.34',family:4}];},requestFn:stubTransport([{text:'ok'}],requests)});
  assert.equal(result.text,'ok');assert.equal(lookups,1);
  const answer=await new Promise((resolve,reject)=>requests[0].options.lookup('news.example.org',{},(err,address)=>err?reject(err):resolve(address)));
  assert.equal(answer,'93.184.216.34');assert.equal(lookups,1);assert.equal(requests[0].options.agent,false);
});
test('redirect downgrade, host allowlist, total timeout and body size are bounded',async()=>{
  await assert.rejects(()=>safeGet('https://news.example.org',{lookup:publicDNS,requestFn:stubTransport([{status:301,headers:{location:'http://news.example.org/a'}}])}),error=>error.code==='REDIRECT_BLOCKED');
  await assert.rejects(()=>safeGet('https://news.example.org',{lookup:publicDNS,allowDomains:['allowed.example.org'],requestFn:stubTransport([])}),error=>error.code==='DOMAIN_BLOCKED');
  await assert.rejects(()=>safeGet('https://news.example.org',{lookup:publicDNS,maxBytes:3,requestFn:stubTransport([{text:'four'}])}),error=>error.code==='RESPONSE_TOO_LARGE');
  await assert.rejects(()=>safeGet('https://news.example.org',{lookup:publicDNS,timeoutMs:10,requestFn:stubTransport([{hang:true}])}),error=>error.code==='TIMEOUT');
});
test('redirect hook checks access rules for each public destination',async()=>{
  const checked=[];
  const result=await safeGet('https://news.example.org/a',{lookup:publicDNS,beforeRequest:async url=>{checked.push(url.href);},requestFn:stubTransport([
    {status:302,headers:{location:'/b'}},{text:'article'}
  ])});
  assert.equal(result.text,'article');assert.deepEqual(checked,['https://news.example.org/a','https://news.example.org/b']);
});
