import test from 'node:test';
import assert from 'node:assert/strict';
import {analisarConteudo} from '../services/analysis.js';
import {generateExplanation} from '../services/explanation.js';
import {calcularIndice,factCheckComponent,ratingScore} from '../services/indice-veracidade.js';

const text='A prefeitura de Curitiba anunciou uma nova escola em 2025.';
const options={
  check:async()=>({apiDisponivel:true,resultados:[]}),
  nlp:async()=>({indicadores:[],comparacoes:[],tensorflow:{disponivel:true,modelo:null,comparacoesExecutadas:0,limitacoes:[],
    padroes:{porcentagem:83,sinais:['instituicao'],modelo:{nome:'fixture'}}}}),
  explain:result=>generateExplanation(result,{enabled:false})
};
async function ask(base,estimate,{inspect,fetchError,explicacao}={}) {
  return generateExplanation(base,{enabled:true,provider:'gemini',apiKey:'fixture-key',model:'gemini-fixture',retryDelayMs:0,
    fetchImpl:async(_url,init)=>{
      if(fetchError)throw new Error('PRIVATE_NETWORK_ERROR');
      const request=JSON.parse(init.body),schema=request.generationConfig.responseFormat.text.schema,fields=schema.properties;
      const payload=JSON.parse(request.contents[0].parts[0].text);
      inspect?.(request,payload,schema);
      const output={resumo:fields.resumo.enum[0],orientacao:fields.orientacao.enum[0],feedback:fields.feedback.enum[0],
        destaques:[],referencias:[],classificacao:base.veredito,contexto_juridico:{aplicavel:false,referencias:[]},
        ...(explicacao?{explicacao}:{}),...(estimate===undefined?{}:{estimativa:estimate})};
      return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(output)}]}}]}));
    }});
}

for(const score of [8,61,94]) {
  test('a number returned by Gemini ('+score+') is ignored; the index comes from TensorFlow + Fact Check',async()=>{
    const base=await analisarConteudo({texto:text},options),before=structuredClone(base);
    const result=await ask(base,{verificavel:true,porcentagem:score,motivos:['conhecimento_geral']},{explicacao:'Explicação de contexto suficientemente longa para ser exibida.'});
    assert.equal(result.geracao.status,'ia');assert.equal(result.estimativaIA.status,'indisponivel');assert.equal(result.estimativaIA.porcentagem,null);
    assert.equal(result.feedbackGemini.explicacao,'Explicação de contexto suficientemente longa para ser exibida.');
    assert.equal(base.indiceVeracidade.porcentagem,83);
    assert.deepEqual(base,before);assert.equal(base.veredito,'Sem evidências suficientes');assert.equal(base.porcentagem,null);
  });
}

test('Gemini receives the analysis inputs and the computed index, and is no longer asked for a number',async()=>{
  const base=await analisarConteudo({texto:text},options);
  base.analiseLinguagem.comparacoes=[{afirmacaoId:'a1',evidenciaId:'e1',similaridadeLexical:0.67,similaridadeSemantica:null}];
  base.fontes=[{id:'e1',url:'https://example.org/checagem',tipo:'checagem',utilizada:false}];
  let requests=0;
  const result=await ask(base,{verificavel:true,porcentagem:87,motivos:['comparacao_textual']},{inspect:(request,payload,schema)=>{
    requests++;assert.ok(schema.required.includes('explicacao'));assert.ok(!schema.required.includes('estimativa'));
    assert.equal(payload.indice_veracidade.porcentagem,base.indiceVeracidade.porcentagem);
    assert.equal(payload.contexto.texto,text);
    assert.equal(payload.indicadores.tensorflow.disponivel,true);
    assert.equal(payload.indicadores.comparacoes[0].similaridadeLexical,0.67);
    assert.equal(payload.fontes[0].id,'e1');
    assert.equal(payload.servicos.googleFactCheck.status,'ok');
    assert.match(request.systemInstruction.parts[0].text,/índice de veracidade/i);
  }});
  assert.equal(requests,1);assert.equal(result.geracao.status,'ia');assert.equal(result.estimativaIA.porcentagem,null);
});

test('provider outage leaves the explanation unavailable and keeps the index',async()=>{
  const base=await analisarConteudo({texto:text},options);
  const result=await ask(base,undefined,{fetchError:true});
  assert.equal(result.estimativaIA.status,'indisponivel');assert.equal(result.estimativaIA.porcentagem,null);
  assert.equal(result.geracao.codigo,'AI_NETWORK_ERROR');assert.ok(!JSON.stringify(result).includes('PRIVATE_NETWORK_ERROR'));
  assert.equal(result.secoes.resultado,base.secoes.resultado);assert.equal(base.indiceVeracidade.porcentagem,83);
});

test('index uses only TensorFlow when no matching fact check exists, with no default value',()=>{
  for(const tf of [0,7,50,74,98,100]){
    const index=calcularIndice({tensorflow:{porcentagem:tf}});
    assert.equal(index.porcentagem,tf);assert.equal(index.componentes.factCheck,null);assert.equal(index.componentes.tensorflow.peso,1);
  }
  assert.equal(calcularIndice({}).status,'indisponivel');assert.equal(calcularIndice({}).porcentagem,null);
});

test('a matching published fact check pulls the index toward its rating, weighted by similarity',()=>{
  const reviews=[{id:'e1',avaliacao:'Falso',verificador:'Estadão',texto_verificado:'Criança desenvolve autismo após vacina'}];
  const claims=[{id:'a1',texto:'Criança desenvolve autismo após vacina'}];
  const fc=factCheckComponent(reviews,[{afirmacaoId:'a1',evidenciaId:'e1',similaridadeLexical:1}],claims);
  const index=calcularIndice({tensorflow:{porcentagem:84},factCheck:fc});
  assert.equal(fc.porcentagem,0);assert.equal(index.componentes.factCheck.peso,0.8);assert.equal(index.porcentagem,17);
  // Checagem de outra alegação do mesmo tema (semelhança baixa) não entra no número.
  assert.equal(factCheckComponent(reviews,[{afirmacaoId:'a1',evidenciaId:'e1',similaridadeLexical:0.3}],claims),null);
  // Negação oposta inverte a avaliação.
  const neg=factCheckComponent(reviews,[{afirmacaoId:'a1',evidenciaId:'e1',similaridadeLexical:0.9}],[{id:'a1',texto:'Criança não desenvolve autismo após vacina'}]);
  assert.equal(neg.porcentagem,100);
});

test('Gemini general knowledge enters only without a matching fact check, and null means it is not used',()=>{
  const fc={porcentagem:0,semelhancaMaxima:1,checagens:[]};
  const without=calcularIndice({tensorflow:{porcentagem:18},gemini:100});
  assert.equal(without.porcentagem,67);assert.equal(without.componentes.gemini.peso,0.6);assert.equal(without.componentes.tensorflow.peso,0.4);
  const withCheck=calcularIndice({tensorflow:{porcentagem:84},factCheck:fc,gemini:100});
  assert.equal(withCheck.componentes.gemini,null);assert.equal(withCheck.porcentagem,17);
  assert.equal(calcularIndice({tensorflow:{porcentagem:98},gemini:null}).porcentagem,98);
});

test('agency ratings map to scores without guessing unknown labels',()=>{
  assert.equal(ratingScore('Falso'),0);assert.equal(ratingScore('Verdadeiro'),100);assert.equal(ratingScore('Parcialmente verdadeiro'),50);
  assert.equal(ratingScore('Enganoso'),0);assert.equal(ratingScore('não_é_bem_assim'),null);assert.equal(ratingScore(''),null);
});
