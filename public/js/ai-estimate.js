// A model judgment, separate from the source-backed factual verdict.
// Presentation bands are conventions, not statistical calibration.
export const AI_ESTIMATE_REASONS=Object.freeze([
  'checagem_concordante','checagem_discordante','conhecimento_geral','contexto_insuficiente',
  'contexto_temporal','conteudo_opinativo','previsao','comparacao_textual','sinais_linguagem'
]);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const score=value=>Number.isInteger(value)&&value>=0&&value<=100;
const reasons=value=>Array.isArray(value)&&value.length>0&&value.length<=5&&new Set(value).size===value.length&&value.every(id=>AI_ESTIMATE_REASONS.includes(id));
export function estimateClassification(value) {
  if(!score(value))return null;
  return value>=70?'Provavelmente verdadeiro':value<=30?'Provavelmente falso':'Veracidade incerta';
}
export function allowedEstimateReasons(result) {
  if(!result)return [...AI_ESTIMATE_REASONS];
  const allowed=['conhecimento_geral','contexto_insuficiente','contexto_temporal','conteudo_opinativo','previsao'];
  const used=result.parecerIntegrado?.evidenciasUtilizadas||[];
  if(used.length&&result.veredito==='Conteúdo verdadeiro')allowed.push('checagem_concordante');
  if(used.length&&result.veredito==='Falso')allowed.push('checagem_discordante');
  if((result.analiseLinguagem?.comparacoes||[]).length>0&&result.analiseLinguagem?.tensorflow?.disponivel===true)allowed.push('comparacao_textual');
  if((result.analiseLinguagem?.indicadores||[]).length>0)allowed.push('sinais_linguagem');
  return allowed;
}
export function assertAiEstimate(value,{result}={}) {
  const reject=()=>{const error=new Error('A estimativa da IA recebida é inválida.');error.code='INVALID_AI_ESTIMATE';throw error;};
  if(!object(value)||Object.keys(value).some(key=>!['status','porcentagem','classificacao','provedor','modelo','metodo','motivos'].includes(key))||
    !['disponivel','indisponivel','nao_aplicavel'].includes(value.status)||value.metodo!=='estimativa_ia'||
    !['gemini','openai',null].includes(value.provedor)||!(value.modelo===null||(typeof value.modelo==='string'&&value.modelo.trim().length>0&&value.modelo.length<=200))||
    !Array.isArray(value.motivos))reject();
  if(value.status==='disponivel') {
    if(!score(value.porcentagem)||value.classificacao!==estimateClassification(value.porcentagem)||!['gemini','openai'].includes(value.provedor)||!value.modelo||!reasons(value.motivos))reject();
    if(result&&value.motivos.some(id=>!allowedEstimateReasons(result).includes(id)))reject();
    if(result?.veredito==='Conteúdo verdadeiro'&&(result.parecerIntegrado?.evidenciasUtilizadas||[]).length&&value.porcentagem<70)reject();
    if(result?.veredito==='Falso'&&(result.parecerIntegrado?.evidenciasUtilizadas||[]).length&&value.porcentagem>30)reject();
  } else {
    if(value.porcentagem!==null||value.classificacao!==null)reject();
    if(value.status==='indisponivel'&&value.motivos.length)reject();
    if(value.status==='nao_aplicavel'&&(!reasons(value.motivos)||!value.motivos.some(id=>['conteudo_opinativo','previsao'].includes(id))))reject();
    if(value.status==='nao_aplicavel'&&result&&!['Sem evidências suficientes','Não verificável'].includes(result.veredito)&&(result.parecerIntegrado?.evidenciasUtilizadas||[]).length)reject();
  }
  return value;
}
export function normalizeAiEstimate(raw,{provider='gemini',model=null,result}={}) {
  const empty={status:'indisponivel',porcentagem:null,classificacao:null,provedor:['gemini','openai'].includes(provider)?provider:null,
    modelo:typeof model==='string'&&model.trim()&&model.length<=200?model:null,metodo:'estimativa_ia',motivos:[]};
  try {
    if(!object(raw)||Object.keys(raw).length!==3||!['verificavel','porcentagem','motivos'].every(key=>Object.hasOwn(raw,key))||typeof raw.verificavel!=='boolean'||!reasons(raw.motivos))return empty;
    const value={...empty,status:raw.verificavel?'disponivel':'nao_aplicavel',porcentagem:raw.porcentagem,
      classificacao:raw.verificavel?estimateClassification(raw.porcentagem):null,motivos:[...raw.motivos]};
    return assertAiEstimate(value,{result});
  } catch {return empty;}
}
