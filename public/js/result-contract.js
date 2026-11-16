import { parseEvidenceDate } from './evidence-dates.js';
import { assertAiEstimate } from './ai-estimate.js';
// Shared wire contract for NEW analyses. Historical records have a separate reader.
const labels=['Conteúdo verdadeiro','Parcialmente verdadeiro','Adulterado','Distorcido','Fora de contexto','Falso','Sem evidências suficientes','Não verificável'];
const uncertain=new Set(labels.slice(6));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const string=value=>typeof value==='string'&&value.trim().length>0;
const strings=value=>Array.isArray(value)&&value.every(string);
const ids=value=>Array.isArray(value)&&value.every(string)&&new Set(value).size===value.length;
const same=(a,b)=>a.length===b.length&&a.every(id=>b.includes(id));
const normalized=value=>String(value).normalize('NFC').replace(/[“”„«»]/g,'"').replace(/[’‘]/g,"'").replace(/[.!?]+$/g,'').replace(/\s+/g,' ').trim();
const published=value=>{
  const key=String(value).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[.!]+$/,'').trim();
  const groups=[['verdadeiro','verdadeira','true','correto','correta','conteudo verdadeiro'],['parcialmente verdadeiro','parcialmente verdadeira','parcialmente correto','parcialmente correta','partially true'],['adulterado','adulterada','imagem adulterada','video adulterado','audio adulterado','documento adulterado','captura de tela adulterada','citacao adulterada'],['distorcido','distorcida'],['fora de contexto','out of context'],['falso','falsa','false','incorreto','incorreta']];
  return labels[groups.findIndex(group=>group.includes(key))]||labels[6];
};
const web=value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!/[\u0000-\u0020\u007f]/.test(value);}catch{return false;}};
export const INVALID_RESULT_MESSAGE='O serviço retornou uma resposta inválida ou incompleta. Tente analisar novamente em instantes.';
export function assertAnalysisResult(data) {
  const reject=()=>{const error=new Error(INVALID_RESULT_MESSAGE);error.code='INVALID_ANALYSIS_RESULT';throw error;};
  if(!object(data)||data.schemaVersion!==2||!labels.includes(data.veredito)||data.classificacao!==data.veredito||
    !['texto','url'].includes(data.tipoEntrada)||data.porcentagem!==null||data.confianca!==null||!string(data.justificativa)||
    !Array.isArray(data.afirmacoes)||!Array.isArray(data.resultados)||!Array.isArray(data.fontes)||!strings(data.limitacoes)||
    !object(data.secoes)||!['resumo','resultado','encontramos','linguagem','orientacao','limitacoes'].every(key=>string(data.secoes[key]))||
    !object(data.analiseLinguagem)||!Array.isArray(data.analiseLinguagem.indicadores)||!object(data.analiseLinguagem.tensorflow)||
    !object(data.parecerIntegrado)||data.parecerIntegrado.classificacao!==data.veredito||!ids(data.parecerIntegrado.evidenciasUtilizadas)||
    !object(data.servicos)||!object(data.servicos.googleFactCheck)||!object(data.geracao)||!['ia','local'].includes(data.geracao.status)||
    !object(data.feedbackGemini)||!string(data.feedbackGemini.texto)||!object(data.analiseVisual)||
    !['ia','local'].includes(data.feedbackGemini.status)||!Array.isArray(data.feedbackGemini.referencias)||
    !Array.isArray(data.noticiasRegionais)||!object(data.noticia)||![true,false,null].includes(data.apiDisponivel)||
    typeof data.encontrados!=='boolean'||data.encontrados!==(data.resultados.length>0)||data.quantidade!==data.resultados.length||
    !Array.isArray(data.analiseLinguagem.comparacoes)||typeof data.analiseLinguagem.tensorflow.disponivel!=='boolean'||
    !['ok','incompleto','nao_consultado'].includes(data.servicos.googleFactCheck.status)||!Array.isArray(data.servicos.googleFactCheck.consultas)||
    !object(data.classificacoes)||!labels.every(label=>string(data.classificacoes[label])))reject();
  for(const collection of [data.afirmacoes,data.resultados,data.fontes])if(!ids(collection.map(item=>object(item)?item.id:null)))reject();
  const sources=new Map(data.fontes.map(source=>[source.id,source]));
  const reviews=new Map(data.resultados.map(review=>[review.id,review]));
  for(const source of data.fontes)if(!['checagem','noticia'].includes(source.tipo)||!string(source.titulo)||!web(source.url)||!string(source.verificador)||(source.tipo==='checagem'&&!reviews.has(source.id))||(source.tipo==='noticia'&&source.utilizada===true))reject();
  for(const review of data.resultados) {
    const source=sources.get(review.id);
    if(!string(review.texto_verificado)||!string(review.avaliacao)||!string(review.verificador)||!web(review.url_verificacao)||
      !source||source.tipo!=='checagem'||source.url!==review.url_verificacao||source.verificador!==review.verificador||source.afirmacaoVerificada!==review.texto_verificado||source.avaliacaoOriginal!==review.avaliacao||source.data!==review.data_verificacao||source.dataAlegacao!==(review.data_alegacao||null))reject();
  }
  const used=[];
  for(const claim of data.afirmacoes) {
    if(!string(claim.texto)||!['fato','opiniao','previsao','instrucao','editorial','ambiguo'].includes(claim.tipo)||!labels.includes(claim.veredito)||
      !string(claim.justificativa)||!Array.isArray(claim.evidencias)||!ids(claim.evidenciasUtilizadas)||typeof claim.consultaCompleta!=='boolean'||
      !ids(claim.evidencias.map(item=>item?.id)))reject();
    for(const evidence of claim.evidencias)if(!reviews.has(evidence.id)||['texto_verificado','url_verificacao','avaliacao','verificador','data_alegacao','data_verificacao'].some(key=>evidence[key]!==reviews.get(evidence.id)[key]))reject();
    for(const id of claim.evidenciasUtilizadas) {
      const evidence=claim.evidencias.find(item=>item.id===id),source=sources.get(id);
      const allegation=parseEvidenceDate(evidence?.data_alegacao),reviewDate=parseEvidenceDate(evidence?.data_verificacao);
      if(!evidence||!source||source.utilizada!==true||evidence.utilizavel!==true||evidence.fonteReconhecida!==true||evidence.datasCoerentes!==true||evidence.contextoCompativel!==true||
        evidence.correspondencia!=='exata'||evidence.classificacaoPublicada!==claim.veredito||!string(evidence.data_alegacao)||!string(evidence.data_verificacao)||claim.consultaCompleta!==true)reject();
      if(normalized(evidence.texto_verificado)!==normalized(claim.texto)||published(evidence.avaliacao)!==claim.veredito||!allegation||!reviewDate||allegation.instant>reviewDate.instant||reviewDate.instant>Date.now())reject();
      used.push(id);
    }
    if(!uncertain.has(claim.veredito)&&(claim.tipo!=='fato'||claim.conflito===true||claim.evidenciasUtilizadas.length===0))reject();
    if(uncertain.has(claim.veredito)&&claim.evidenciasUtilizadas.length)reject();
  }
  if(!same([...new Set(used)],data.parecerIntegrado.evidenciasUtilizadas))reject();
  for(const source of data.fontes)if(source.tipo==='checagem'&&source.utilizada!==used.includes(source.id))reject();
  const facts=data.afirmacoes.filter(claim=>claim.tipo==='fato');
  const queries=data.servicos.googleFactCheck.consultas;
  if(!ids(queries.map(query=>query?.afirmacaoId))||queries.length!==facts.length||queries.some(query=>!facts.some(claim=>claim.id===query.afirmacaoId)||typeof query.completa!=='boolean'))reject();
  if(data.analiseLinguagem.comparacoes.some(pair=>!object(pair)||!data.afirmacoes.some(claim=>claim.id===pair.afirmacaoId)||!reviews.has(pair.evidenciaId)||!Number.isFinite(pair.similaridadeLexical)||pair.similaridadeLexical<0||pair.similaridadeLexical>1))reject();
  if(!uncertain.has(data.veredito)&&(!facts.length||facts.some(claim=>claim.veredito!==data.veredito||!claim.consultaCompleta)||data.servicos.googleFactCheck.status!=='ok'))reject();
  if(data.veredito==='Não verificável'&&facts.length)reject();
  if(data.analiseVisual.porcentagem!==null&&(!Number.isFinite(data.analiseVisual.porcentagem)||data.analiseVisual.porcentagem<0||data.analiseVisual.porcentagem>100||uncertain.has(data.veredito)||!used.length))reject();
  for(const ref of data.feedbackGemini.referencias||[])if(!used.includes(typeof ref==='string'?ref:ref?.id))reject();
  if(data.estimativaIA!==undefined){try{assertAiEstimate(data.estimativaIA,{result:data});}catch{reject();}}
  return data;
}
export function assertAnalysisEnvelope(envelope) {
  if(!object(envelope)||envelope.sucesso!==true)return assertAnalysisResult(null);
  return assertAnalysisResult(envelope.dados);
}
