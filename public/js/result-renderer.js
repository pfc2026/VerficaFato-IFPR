import { element, appendSafeLink } from './safe-dom.js';
import { assertAnalysisResult } from './result-contract.js';
import { assertAiEstimate, estimateClassification } from './ai-estimate.js';

const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value : '';
const VERDICT_HELP = Object.freeze({
  'Conteúdo verdadeiro':'A afirmação e seus detalhes relevantes são confirmados por evidências confiáveis, com data, local, autoria e contexto coerentes.',
  'Parcialmente verdadeiro':'A mesma afirmação reúne partes comprovadas e erros relevantes. Resultados diferentes de afirmações independentes não bastam para esta classificação.',
  'Adulterado':'Há evidência de modificação ou fabricação do material que altera seu significado. Aparência, estilo ou suspeita de IA não comprovam adulteração.',
  'Distorcido':'Fatos ou dados reais são apresentados com exagero, comparação inadequada, omissão decisiva ou interpretação enganosa.',
  'Fora de contexto':'Um conteúdo autêntico é atribuído a outra data, local, pessoa ou situação, ou perde o contexto original necessário.',
  'Falso':'A afirmação central é contradita por evidências confiáveis ou descreve um fato comprovadamente inventado.',
  'Sem evidências suficientes':'Faltam evidências pertinentes, há conflito entre fontes ou a consulta incompleta impede uma conclusão.',
  'Não verificável':'Não foi identificada uma afirmação factual objetivamente verificável, como em opiniões ou previsões. A extração automática pode falhar.'
});
const FACTUAL = new Set(Object.keys(VERDICT_HELP));
const COLORS = { green:'#27AE60', yellow:'#F39C12', orange:'#E67E22', red:'#E74C3C', blue:'#3498DB' };
const count = value => typeof value === 'number' && Number.isFinite(value) ? Math.max(0,Math.floor(value)) : 0;
const regionalNames = { g1_parana: 'G1 Paraná', o_parana: 'Jornal O Paraná', gazeta_do_povo: 'Gazeta do Povo', jornal_de_toledo: 'Jornal de Toledo', radio_colmeia: 'Rádio Colmeia (Cascavel)', radio_cultura_toledo: 'Rádio Cultura Toledo' };
function publicationDate(value) {
  const original = text(value);
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(original)) return original;
  const date = new Date(original);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
function styled(node, style) { Object.assign(node.style,style); return node; }
function icon(name,color) {
  const node=element('i','fas '+name);
  node.setAttribute('aria-hidden','true');
  if(color)node.style.color=color;
  return node;
}
function heading(parent,title,name,className='mb-2') {
  const node=element('h6',className);
  if(name)node.append(icon(name));
  node.append(document.createTextNode(title));
  parent.append(node);
  return node;
}
function paragraph(parent,value,className='') {
  if(!value)return;
  const node=element('p',className,value);
  parent.append(node);
  return node;
}
function panel(className='') {
  return styled(element('section','mb-3 p-3 '+className),{
    background:'var(--card-bg,rgba(255,255,255,0.06))',border:'1px solid var(--border,rgba(255,255,255,0.12))',borderRadius:'14px'
  });
}
export function normalizeResult(record={}) {
  const source=record&&typeof record==='object'?record:{};
  const stored=source.resultado?.schemaVersion===2 ? source.resultado : source.schemaVersion===2 ? source : null;
  if(stored){
    if(stored.veredito==='Enganoso')return {...stored,veredito:'Sem evidências suficientes',classificacao:'Sem evidências suficientes',
      justificativa:'O registro anterior usava o rótulo genérico “Enganoso”, que não distingue adulteração, distorção e contexto incorreto.',
      avisoHistorico:'A classificação anterior não foi remapeada. Faça uma nova consulta para avaliar os critérios atuais.'};
    return stored.veredito==='Verdadeiro' ? {...stored,veredito:'Conteúdo verdadeiro',classificacao:'Conteúdo verdadeiro',avisoHistorico:'Classificação registrada anteriormente como “Verdadeiro”, sem nova consulta às fontes.'} : stored;
  }
  return {
    schemaVersion:1,legado:true,veredito:'Sem evidências suficientes',
    texto:text(source.texto),
    justificativa:'Registro legado: a pontuação e o veredito anteriores não foram revalidados com a metodologia atual.',
    resultados:list(source.dadosAPI),fontes:[],noticiasRegionais:[],
    limitacoes:['Faça uma nova consulta para obter os indicadores atuais e o feedback do Gemini.']
  };
}
function getVisual(data) {
  const visual=data.analiseVisual&&typeof data.analiseVisual==='object'?data.analiseVisual:{};
  return {texto:text(visual.texto)||text(data.texto)||text(data.resumo),analiseLocal:visual.analiseLocal||data.analiseLocal||{}};
}
export function resultLabel(record) {
  const data=normalizeResult(record);
  if(data.legado)return 'Registro legado';
  const estimate=validEstimate(data);
  if(estimate)return estimate.classificacao;
  return FACTUAL.has(data.veredito)?data.veredito:'Sem evidências suficientes';
}
export function resultBadge(record) {
  const data=normalizeResult(record),visual=getVisual(data);
  const badge=element('span','badge badge-veredito',resultLabel(data));
  if(data.legado)badge.classList.add('bg-secondary');
  else badge.classList.add('bg-secondary');
  return badge;
}
function validEstimate(data) {
  const estimate=data.estimativaIA;
  if(data.legado||estimate?.status!=='disponivel')return null;
  try {assertAiEstimate(estimate,{result:data});}
  catch {return null;}
  return estimate.classificacao===estimateClassification(estimate.porcentagem)?estimate:null;
}
// Índice calculado pelo servidor com TensorFlow + Google Fact Check (services/indice-veracidade.js).
function validIndex(data) {
  const index=data.indiceVeracidade;
  if(data.legado||index?.status!=='disponivel'||!Number.isInteger(index.porcentagem)||index.porcentagem<0||index.porcentagem>100)return null;
  return {porcentagem:index.porcentagem,classificacao:estimateClassification(index.porcentagem),componentes:index.componentes||{}};
}
function indexDescription(index) {
  const tf=index.componentes.tensorflow,fc=index.componentes.factCheck,gm=index.componentes.gemini,parts=[];
  if(fc){
    const top=list(fc.checagens)[0];
    parts.push('Checagens do Google Fact Check: '+fc.porcentagem+'% (peso '+Math.round(fc.peso*100)+'%)'+(top?', a mais parecida é de '+text(top.verificador)+': “'+text(top.avaliacao).slice(0,60)+'”.':'.'));
  }
  if(gm)parts.push('Nenhuma checagem publicada parecida foi encontrada. Conhecimento geral do Gemini: '+gm.porcentagem+'% (peso '+Math.round(gm.peso*100)+'%).');
  if(tf)parts.push('Padrões de linguagem (TensorFlow): '+tf.porcentagem+'%'+(fc||gm?' (peso '+Math.round(tf.peso*100)+'%).':'.'));
  if(!fc&&!gm)parts.push('Nenhuma checagem publicada parecida foi encontrada, então o número vem só do estilo do texto.');
  return parts.join(' ');
}
function applyEstimateAppearance(section,percentage) {
  const tone=percentage<40?'low':percentage<=65?'medium':'high';
  const hue=tone==='low'?4+percentage*6/39:tone==='medium'?42+(percentage-40)*10/25:138+(percentage-66)*16/34;
  section.dataset.estimateTone=tone;
  section.style.setProperty('--estimate-hue',hue.toFixed(1));
}
function estimateSummary(data) {
  const index=validIndex(data);
  if(index)return indexSummary(data,index);
  const estimate=validEstimate(data),section=panel('ai-estimate-summary');
  const notApplicable=data.estimativaIA?.status==='nao_aplicavel'||(!data.estimativaIA&&data.veredito==='Não verificável');
  const label=estimate?estimate.classificacao:data.legado?'Registro legado':notApplicable?'Opinião ou previsão':'Estimativa indisponível';
  if(estimate)applyEstimateAppearance(section,estimate.porcentagem);
  const row=element('div','estimate-heading'),title=element('div','estimate-title'),line=element('div','estimate-title-line');
  line.append(icon('fa-circle-question estimate-symbol'),element('h3','',label));
  title.append(line,element('span','estimate-kicker',data.legado?'Histórico':'Estimativa de veracidade · IA'));
  if(!estimate){
    section.classList.add('estimate-unavailable');
    paragraph(title,data.legado?data.justificativa:notApplicable?'Este conteúdo não apresenta um fato que possa receber uma estimativa de veracidade.':'A IA não conseguiu estimar este conteúdo nesta tentativa. Tente novamente.','estimate-status mb-0');
  }
  const gauge=element('div','estimate-gauge'),inner=element('div','estimate-gauge-inner');
  section.style.setProperty('--estimate-angle',((estimate?.porcentagem||0)*3.6)+'deg');
  gauge.setAttribute('role','img');
  gauge.setAttribute('aria-label',estimate?'Estimativa de veracidade por IA: '+estimate.porcentagem+' por cento':'Percentual indisponível');
  inner.append(element('span',estimate?'estimate-percentage':'estimate-empty',estimate?estimate.porcentagem+'%':'—'),element('span','estimate-gauge-label',data.legado?'REGISTRO':'VERACIDADE'));
  gauge.append(inner);row.append(title,gauge);section.append(row);
  const meter=element('div','estimate-track'),bar=element('div','estimate-fill');
  bar.style.width=(estimate?.porcentagem||0)+'%';meter.setAttribute('aria-hidden','true');meter.append(bar);section.append(meter);
  const scale=element('div','estimate-scale');scale.setAttribute('aria-hidden','true');
  for(const text of ['Menos provável','Incerto','Mais provável'])scale.append(element('span','',text));
  section.append(scale);
  if(!data.legado){
    const description=element('div','estimate-description');
    description.append(icon('fa-circle-info'),element('span','','A IA estima a veracidade a partir do texto, das checagens disponíveis e da análise de linguagem.'));
    section.append(description);
  }
  if(!data.legado)section.append(element('small','estimate-disclaimer','Estimativa feita por IA. Pode conter erros e não substitui a conferência das fontes.'));
  return section;
}
function indexSummary(data,index) {
  const section=panel('ai-estimate-summary');
  applyEstimateAppearance(section,index.porcentagem);
  const row=element('div','estimate-heading'),title=element('div','estimate-title'),line=element('div','estimate-title-line');
  line.append(icon('fa-circle-question estimate-symbol'),element('h3','',index.classificacao));
  title.append(line,element('span','estimate-kicker',index.componentes.gemini?'Índice de veracidade · TensorFlow + conhecimento do Gemini':'Índice de veracidade · TensorFlow + Google Fact Check'));
  const gauge=element('div','estimate-gauge'),inner=element('div','estimate-gauge-inner');
  section.style.setProperty('--estimate-angle',(index.porcentagem*3.6)+'deg');
  gauge.setAttribute('role','img');
  gauge.setAttribute('aria-label','Índice de veracidade: '+index.porcentagem+' por cento');
  inner.append(element('span','estimate-percentage',index.porcentagem+'%'),element('span','estimate-gauge-label','VERACIDADE'));
  gauge.append(inner);row.append(title,gauge);section.append(row);
  const meter=element('div','estimate-track'),bar=element('div','estimate-fill');
  bar.style.width=index.porcentagem+'%';meter.setAttribute('aria-hidden','true');meter.append(bar);section.append(meter);
  const scale=element('div','estimate-scale');scale.setAttribute('aria-hidden','true');
  for(const text of ['Menos provável','Incerto','Mais provável'])scale.append(element('span','',text));
  section.append(scale);
  const description=element('div','estimate-description');
  description.append(icon('fa-circle-info'),element('span','',indexDescription(index)));
  section.append(description);
  section.append(element('small','estimate-disclaimer','Estimativa feita por IA. Pode conter erros e não substitui a conferência das fontes.'));
  return section;
}
function regional(data) {
  const items=list(data.noticiasRegionais);if(!items.length)return null;
  const section=styled(panel('regional-findings'),{background:'rgba(39,174,96,0.15)',borderColor:'rgba(39,174,96,0.4)'});
  heading(section,'Reportagens da imprensa regional','fa-newspaper me-2');
  paragraph(section,'Referências de contexto; a presença no acervo não confirma a afirmação.','small');
  items.forEach(item=>{
    const card=styled(element('article','p-2 mb-2'),{background:'rgba(0,0,0,0.2)',borderRadius:'10px',borderLeft:'4px solid '+COLORS.green});
    paragraph(card,text(item.titulo),'fw-semibold mb-1');
    paragraph(card,[Object.hasOwn(regionalNames, item.fonte) ? regionalNames[item.fonte] : text(item.fonte),publicationDate(item.data_publicacao)].filter(Boolean).join(' · '),'small mb-1');
    paragraph(card,text(item.texto),'small mb-2');
    appendSafeLink(card,item.url,'Ler reportagem completa no portal','btn btn-sm btn-outline-success');
    section.append(card);
  });return section;
}
function articleSource(article) {
  if(!article?.url)return null;
  const section=element('section','article-source mb-3'),row=element('div','d-flex gap-2 align-items-start'),content=element('div','flex-grow-1 min-width-0');
  row.append(icon('fa-newspaper mt-1','#74b9ff'));heading(content,'Endereço da publicação enviada',null,'mb-1');
  if(article.titulo)content.append(element('strong','article-source-title',text(article.titulo)));
  paragraph(content,text(article.descricao),'article-source-description mb-2');
  appendSafeLink(content,article.url,article.url,'article-source-url');
  const status=element('small','d-block mt-2 '+(article.conteudoObtido?'text-success':'text-warning'));
  status.append(icon((article.conteudoObtido?'fa-circle-check':'fa-triangle-exclamation')+' me-1'),document.createTextNode(article.conteudoObtido?'Título e conteúdo da página foram analisados.':'O conteúdo da página não foi lido. '+(text(article.erroConteudo)||'')));
  content.append(status);row.append(content);section.append(row);return section;
}
function detailedReading(data) {
  const dimensions=data.analiseVisual?.dimensoes||data.dimensoes;
  if(!dimensions)return null;
  const section=element('section','analysis-overview mb-3');
  const header=element('div','d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3');
  heading(header,'Leitura detalhada da notícia',null,'mb-0');
  header.append(element('small','analysis-disclaimer','Indicadores automáticos, não prova definitiva'));
  const cards=element('div','row g-2');
  for(const [key,title,name,color] of [
    ['sensacionalismo','Sensacionalismo','fa-bullhorn',COLORS.orange],
    ['fonte','Referências citadas no texto','fa-link',COLORS.green],
    ['estrutura','Completude do texto','fa-file-lines',COLORS.blue]
  ]){
    const dimension=dimensions[key]||{},column=element('div','col-12 col-sm-4');
    const card=element('div','analysis-card h-100'),top=element('div','d-flex justify-content-between align-items-start gap-2 mb-2');
    const label=element('span','analysis-card-title');
    label.append(icon(name+' me-2',color),document.createTextNode(title));
    const score=dimension.pontuacao;
    const available=typeof score==='number'&&Number.isFinite(score)&&score>=0&&score<=100;
    top.append(label,element('strong','analysis-score text-nowrap',available?score+'/100':'—/100'));card.append(top);
    if(available){
      const track=element('div','progress analysis-progress mb-2'),bar=element('div','progress-bar');
      track.setAttribute('role','progressbar');track.setAttribute('aria-label',title);
      track.setAttribute('aria-valuenow',String(score));track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
      styled(bar,{width:score+'%',backgroundColor:color});track.append(bar);card.append(track);
    }
    paragraph(card,text(dimension.nivel),'analysis-level');
    paragraph(card,text(dimension.descricao),'small mb-0');
    column.append(card);cards.append(column);
  }
  section.append(header,cards);return section;
}
function extractedInformation(data) {
  if(data.tipoEntrada!=='url')return null;
  const info=(data.analiseVisual?.dimensoes||data.dimensoes)?.informacoes;
  if(!info)return null;
  const section=element('section','news-information mb-3');
  heading(section,'Informações extraídas do texto','fa-circle-info me-2');
  if(text(info.alegacaoPrincipal)){
    const claim=element('div','news-claim');
    claim.append(element('span','','Alegação principal'),element('p','',text(info.alegacaoPrincipal)));section.append(claim);
  }
  const grid=element('div','news-info-grid');
  for(const [key,title,name] of [
    ['palavrasImportantes','Palavras importantes','fa-key'],
    ['entidades','Nomes e entidades','fa-user-group'],
    ['numeros','Números e valores','fa-hashtag'],
    ['datas','Datas','fa-calendar-days']
  ]){
    const group=element('div','news-info-group'),label=element('strong');
    label.append(icon(name+' me-2'),document.createTextNode(title));
    const values=element('div','news-info-values'),items=list(info[key]).map(text).filter(Boolean);
    if(items.length)items.forEach(value=>values.append(element('span','',value)));
    else values.append(element('em','','Não identificados'));
    group.append(label,values);grid.append(group);
  }
  section.append(grid);
  const links=list(info.links).map(text).filter(Boolean);
  if(links.length){
    const group=element('div','news-links mt-3'),label=element('strong');
    label.append(icon('fa-link me-2'),document.createTextNode('Links citados no texto'));group.append(label);
    links.forEach(url=>appendSafeLink(group,url,url));section.append(group);
  }
  return section;
}
function patterns(local) {
  const negative=list(local.alertasFalso),positive=list(local.alertasConfiavel);
  if(!negative.length&&!positive.length)return null;
  const section=panel('language-patterns');heading(section,'Padrões encontrados no texto','fa-magnifying-glass-chart me-2','mb-3');
  [[negative,'Sinais de alerta',COLORS.red,'#ff7675'],[positive,'Sinais positivos',COLORS.green,'#55efc4']].forEach(([items,title,color,foreground])=>{
    if(!items.length)return;
    const group=element('div','mb-3');group.append(styled(element('small','text-uppercase fw-bold',title+' ('+items.length+')'),{color,letterSpacing:'.05em'}));
    const categories=new Map();
    items.forEach(item=>{const key=text(item.categoria)||'Outros';if(!categories.has(key))categories.set(key,[]);categories.get(key).push(item);});
    for(const [category,entries] of categories){
      const block=element('div','mt-2');block.append(styled(element('div','',category),{fontSize:'.68rem',opacity:'.6',textTransform:'uppercase',marginBottom:'4px'}));
      const badges=element('div','d-flex flex-wrap gap-1');
      entries.forEach(item=>badges.append(styled(element('span','badge',text(item.label)+(count(item.ocorrencias)>1?' (×'+count(item.ocorrencias)+')':'')),{background:color+'22',color:foreground,border:'1px solid '+color+'55',fontWeight:'500'})));
      block.append(badges);group.append(block);
    }section.append(group);
  });return section;
}
function reviewResults(data) {
  const reviews=list(data.resultados);
  if(!reviews.length){
    const warning=styled(panel('fact-check-status'),{background:data.apiDisponivel===false?'rgba(231,76,60,.1)':'rgba(243,156,18,.1)',borderColor:data.apiDisponivel===false?'rgba(231,76,60,.3)':'rgba(243,156,18,.3)'});
    heading(warning,data.apiDisponivel===false?'A consulta ao Google Fact Check não pôde ser concluída':'Nenhuma verificação externa indexada encontrada',data.apiDisponivel===false?'fa-cloud-slash me-2':'fa-circle-info me-2');
    paragraph(warning,data.apiDisponivel===false?(text(data.erroAPI)||'A consulta está temporariamente indisponível.'):'A Google Fact Check API pesquisa checagens já publicadas. Não encontrar resultados não confirma nem nega a veracidade do conteúdo.','small mb-0');
    if(data.palavrasChaveUsadas)paragraph(warning,'Termos pesquisados: '+text(data.palavrasChaveUsadas),'small mt-2 mb-0');
    return warning;
  }
  const section=element('section','external-reviews mb-3');heading(section,'Verificações externas encontradas','fa-globe me-2');
  reviews.forEach(review=>{
    const card=styled(element('article','verification-item p-3 mb-2'),{borderLeft:'4px solid '+COLORS.green,background:'var(--card-bg,rgba(255,255,255,0.06))',borderRadius:'0 12px 12px 0'});
    const top=element('div','d-flex justify-content-between align-items-start mb-1 gap-2 flex-wrap');
    top.append(element('h6','mb-0 flex-grow-1',text(review.titulo_verificacao)),element('span','badge bg-secondary',text(review.avaliacao)));card.append(top);
    paragraph(card,text(review.texto_verificado),'mb-2 small');
    paragraph(card,'Avaliação publicada: '+text(review.avaliacao),'small mb-1');
    const attribution=element('div','d-flex gap-3 align-items-center flex-wrap');
    attribution.append(element('small','',text(review.verificador)),element('small','',text(review.data_verificacao)));
    if(review.url_verificacao)appendSafeLink(attribution,review.url_verificacao,'Ver verificação completa','btn btn-sm ms-auto analysis-source-link');
    card.append(attribution,element('small','d-block mt-2 opacity-75','Confira se a afirmação, a data e o contexto da checagem correspondem ao conteúdo enviado.'));
    section.append(card);
  });return section;
}
function sourceList(data) {
  const reviews=new Set(list(data.resultados).map(item=>item.url_verificacao));
  const sources=list(data.fontes).filter(source=>source.tipo!=='noticia'&&!reviews.has(source.url));
  if(!sources.length)return null;
  const section=panel('consulted-sources');heading(section,'Fontes consultadas','fa-link me-2');
  sources.forEach(source=>{const item=element('div','mb-2');appendSafeLink(item,source.url,source.titulo||source.verificador||'Consultar fonte','analysis-source-link');paragraph(item,[text(source.verificador),text(source.data)].filter(Boolean).join(' · '),'small mb-0');section.append(item);});return section;
}
function compactSources(data) {
  const sources=list(data.fontes).filter(source=>source.tipo==='checagem'&&source.url);
  if(!sources.length)return null;
  const unique=sources.filter((source,index)=>sources.findIndex(item=>item.url===source.url)===index);
  const section=element('section','compact-sources mb-3');heading(section,'Fontes encontradas','fa-link me-2');
  unique.slice(0,3).forEach(source=>appendSafeLink(section,source.url,text(source.verificador)||text(source.titulo)||'Ler fonte','analysis-source-link'));
  if(unique.length>3)paragraph(section,'Mais '+(unique.length-3)+' fonte(s) nos detalhes abaixo.','small mb-0 mt-2');
  return section;
}
function claimResults(data) {
  const claims=list(data.afirmacoes);
  if(!claims.length)return null;
  const section=panel('claim-results');heading(section,'Resultado por afirmação','fa-list-check me-2');
  claims.forEach((claim,index)=>{
    const card=element('article','claim-result p-3 mb-2');
    heading(card,'Afirmação '+(index+1),null,'small mb-2');
    paragraph(card,text(claim.texto),'claim-text fw-semibold');
    const label=claim.veredito==='Verdadeiro'?'Conteúdo verdadeiro':FACTUAL.has(claim.veredito)?claim.veredito:'Sem evidências suficientes';
    card.append(element('strong','claim-verdict d-block mb-2',label));
    paragraph(card,text(claim.justificativa),'small');
    const findings=claim.constatacoes||{};
    const fields=element('dl','claim-findings small');
    [['confirmado','Confirmado'],['refutado','Refutado'],['semComprovacao','Sem comprovação']].forEach(([key,title])=>{
      const items=list(findings[key]).filter(value=>typeof value==='string'&&value);
      if(items.length){fields.append(element('dt','',title));items.forEach(value=>fields.append(element('dd','',value)));}
    });
    if(fields.childElementCount)card.append(fields);
    const used=new Set(list(claim.evidenciasUtilizadas));
    list(claim.evidencias).forEach(evidence=>{
      const item=element('div','claim-evidence small mt-2');
      paragraph(item,(used.has(evidence.id)?'Fonte da classificação: ':'Referência sem conclusão para esta afirmação: ')+text(evidence.verificador)+(evidence.data_verificacao?' · '+publicationDate(evidence.data_verificacao):''),'mb-1');
      paragraph(item,'Afirmação checada: '+text(evidence.texto_verificado),'mb-1');
      paragraph(item,'Avaliação original: '+text(evidence.avaliacao),'mb-1');
      if(evidence.autor_alegacao)paragraph(item,'Autoria atribuída à alegação: '+text(evidence.autor_alegacao),'mb-1');
      if(evidence.data_alegacao)paragraph(item,'Data da alegação: '+publicationDate(evidence.data_alegacao),'mb-1');
      appendSafeLink(item,evidence.url_verificacao,'Ler checagem original','analysis-source-link');card.append(item);
    });
    list(claim.limitacoes).filter(limit=>!list(findings.semComprovacao).includes(limit)).forEach(limit=>paragraph(card,text(limit),'small mb-1'));
    section.append(card);
  });return section;
}
function classificationGuide(data) {
  const section=panel('classification-guide'),details=element('details');
  details.append(element('summary','fw-semibold','O que significa cada classificação?'));
  const definitions=data.classificacoes&&typeof data.classificacoes==='object'?data.classificacoes:VERDICT_HELP;
  const fields=element('dl','small mt-3 mb-0');
  Object.keys(VERDICT_HELP).forEach(label=>fields.append(element('dt','mt-2',label),element('dd','mb-2',text(definitions[label])||VERDICT_HELP[label])));
  details.append(fields);section.append(details);return section;
}
function linguisticComparisons(data) {
  const language=data.analiseLinguagem;
  if(!language?.tensorflow)return null;
  const section=panel('linguistic-comparisons'),details=element('details');
  const summary=element('summary','fw-semibold','Comparação do texto com as checagens');
  details.append(summary);
  const local=language.tensorflow,executed=count(local.comparacoesExecutadas);
  const status=local.disponivel ? executed ? executed+' comparação(ões) lexical(is) executada(s)'+(local.modelo?' e modelo treinado utilizado: '+text(local.modelo):'; nenhum modelo treinado utilizado') : 'runtime disponível; nenhuma comparação executada; nenhum modelo treinado utilizado' : 'indisponível nesta análise';
  paragraph(details,'TensorFlow.js: '+status+'.','tensorflow-status small mt-2');
  paragraph(details,'A comparação mede palavras em comum. Mesmo textos muito parecidos podem discordar entre si; o resultado não confirma fatos nem identifica contradições.','small mt-2 mb-2');
  const claims=list(data.afirmacoes),reviews=list(data.resultados);
  const comparisons=list(language.comparacoes).flatMap(item=>{
    const claim=claims.find(claim=>claim.id===item?.afirmacaoId),review=reviews.find(review=>review.id===item?.evidenciaId);
    const score=item?.similaridadeLexical;
    return claim&&review&&typeof score==='number'&&Number.isFinite(score)&&score>=0&&score<=1 ? [{...item,claim,review}] : [];
  }).sort((a,b)=>b.similaridadeLexical-a.similaridadeLexical);
  if(!language.tensorflow.disponivel)paragraph(details,'A comparação de palavras não pôde ser executada nesta análise. As checagens e suas fontes continuam disponíveis acima.','small mb-0');
  else if(!comparisons.length)paragraph(details,'Não há pares de afirmações e checagens disponíveis para comparar nesta análise. Nenhum valor foi estimado.','small mb-0');
  else {
    paragraph(details,'Valores de similaridade lexical vão de 0 a 1. A lista mostra até seis pares com maior sobreposição de palavras.','small opacity-75');
    const pairs=element('div','comparison-pairs');
    comparisons.slice(0,6).forEach(item=>{
      const pair=element('article','comparison-pair p-2 mb-2');
      paragraph(pair,'Trecho analisado: '+text(item.claim.texto),'small mb-1');
      paragraph(pair,'Checagem: '+(text(item.review.titulo_verificacao)||text(item.review.texto_verificado)),'small mb-1');
      paragraph(pair,'Similaridade lexical: '+item.similaridadeLexical.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}),'comparison-lexical small mb-1');
      const semantic=item.similaridadeSemantica;
      if(typeof semantic==='number'&&Number.isFinite(semantic)&&semantic>=-1&&semantic<=1)paragraph(pair,'Similaridade por modelo de linguagem: '+semantic.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+' (escala de −1 a 1; não verifica a afirmação).','comparison-semantic small mb-1');
      if(item.review.url_verificacao)appendSafeLink(pair,item.review.url_verificacao,'Conferir checagem','analysis-source-link small');
      pairs.append(pair);
    });
    details.append(pairs);
  }
  if(language.tensorflow.modeloSemantico==='indisponivel')paragraph(details,'A comparação por modelo de linguagem configurada está indisponível. Os valores lexicais são calculados separadamente.','small mt-2 mb-0');
  else if(!language.tensorflow.modelo)paragraph(details,'Não foi utilizado um modelo treinado de interpretação de sentido.','small opacity-75 mt-2 mb-0');
  section.append(details);return section;
}
function officialLegalUrl(value) {
  if(typeof value!=='string'||/[\u0000-\u0020\u007f]/.test(value))return null;
  try {
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&/(?:^|\.)(?:gov|jus|leg)\.br$/i.test(url.hostname) ? url.href : null;
  } catch {return null;}
}
function legalContext(data) {
  if(data.contexto_juridico?.aplicavel!==true)return null;
  const references=list(data.contexto_juridico.referencias).filter(reference=>
    reference?.verificada===true&&officialLegalUrl(reference.fonte_oficial)&&
    ['acontecimento_noticiado','publicacao'].includes(reference.categoria)&&
    ['lei','artigo','explicacao','relacao_com_noticia','situacao_juridica','ressalvas'].every(key=>text(reference[key]).trim())
  ).filter((reference,index,items)=>items.findIndex(item=>item.id===reference.id&&item.artigo===reference.artigo&&item.categoria===reference.categoria)===index).slice(0,6);
  if(!references.length)return null;
  const section=panel('legal-context');
  heading(section,'Contexto Jurídico','fa-scale-balanced me-2');
  paragraph(section,'A aplicação da legislação depende dos fatos e das circunstâncias. As referências abaixo não concluem culpa nem substituem avaliação jurídica.','small mb-3');
  function card(reference,index) {
    const item=element('details','legal-reference mb-2');
    if(index===0)item.open=true;
    const summary=element('summary','legal-reference-summary');
    summary.append(element('strong','',reference.lei),document.createTextNode(' · '),element('span','legal-article','Art. '+reference.artigo));
    const category=reference.categoria==='acontecimento_noticiado'?'Acontecimento noticiado':'Própria publicação';
    summary.append(element('span','legal-category',category));item.append(summary);
    const content=element('div','legal-reference-content');
    const fields=element('dl','legal-reference-fields');
    [
      ['O que a lei estabelece',reference.explicacao],
      ['Relação com a notícia',reference.relacao_com_noticia],
      ['Trecho relacionado',text(reference.relacao_com_noticia).includes(text(reference.trecho_noticia))?'':reference.trecho_noticia],
      ['Possíveis consequências',reference.consequencias],
      ['Situação jurídica relatada',reference.situacao_juridica],
      ['Ressalvas',reference.ressalvas]
    ].forEach(([label,value])=>{
      if(!text(value).trim())return;
      fields.append(element('dt','',label),element('dd','',value));
    });
    content.append(fields);
    appendSafeLink(content,officialLegalUrl(reference.fonte_oficial),'Consultar legislação na fonte oficial','analysis-source-link legal-official-source');
    if(/^\d{4}-\d{2}-\d{2}$/.test(text(reference.verificado_em)))paragraph(content,'Fonte conferida em '+publicationDate(reference.verificado_em)+'.','small opacity-75 mb-0 mt-2');
    item.append(content);return item;
  }
  const initial=element('div','legal-initial-references');
  references.slice(0,3).forEach((reference,index)=>initial.append(card(reference,index)));
  section.append(initial);
  if(references.length>3){
    const more=element('details','legal-more-references mt-2');
    more.append(element('summary','small fw-semibold','Mais referências jurídicas ('+(references.length-3)+')'));
    const remaining=element('div','mt-2');references.slice(3).forEach(reference=>remaining.append(card(reference,1)));more.append(remaining);section.append(more);
  }
  return section;
}
function geminiFeedback(data) {
  const feedback=data.feedbackGemini||{};
  const provider=feedback.provedor||data.geracao?.provedor;
  const section=panel('gemini-feedback');heading(section,provider==='openai'?'Análise da OpenAI':'Análise do Gemini','fa-wand-magic-sparkles me-2');
  const disabled = feedback.estado === 'desativado' || data.geracao?.estado === 'desativado' || feedback.status === 'desativado' || data.geracao?.status === 'desativado' || /IA opcional não configurada|recurso desativado/i.test(text(data.geracao?.motivo));
  const estimate=validEstimate(data);
  const reasons={conhecimento_geral:'A IA considerou seu conhecimento geral sobre o assunto.',checagem_concordante:'Há checagens que dão suporte ao conteúdo.',checagem_discordante:'Há checagens que contestam o conteúdo.',contexto_insuficiente:'As informações de contexto disponíveis são limitadas.',contexto_temporal:'A data e o contexto influenciam esta estimativa.',comparacao_textual:'A IA considerou a comparação do texto com as checagens disponíveis.',sinais_linguagem:'Os sinais de linguagem foram considerados como contexto, sem comprovar o fato.'};
  const selected=estimate?list(estimate.motivos).map(id=>reasons[id]).filter(Boolean).slice(0,2):[];
  const explanation=text(feedback.explicacao);
  const content=explanation ? explanation : estimate ? selected.join(' ')||'O percentual expressa a avaliação da IA sobre o conteúdo enviado, considerando as informações disponíveis.' : disabled ? 'A estimativa por IA está desativada nesta versão. As fontes disponíveis podem ser consultadas abaixo.' : text(feedback.texto)||(provider==='openai'?'A análise da OpenAI não está disponível nesta tentativa.':'A análise do Gemini não está disponível nesta tentativa.');
  paragraph(section,content,'gemini-feedback-text mb-2');
  const sources=list(data.fontes);
  const references=list(feedback.referencias).flatMap(reference=>{
    if(typeof reference==='string'){
      const match=sources.find(source=>source.id===reference||source.url===reference);
      return match?[match]:[];
    }
    if(reference&&typeof reference==='object'){
      const match=sources.find(source=>source.id===reference.id||source.url===reference.url);
      return match?[match]:[];
    }
    return [];
  });
  if(references.length){const links=element('div','feedback-references');links.append(element('strong','small d-block mb-1','Fontes mencionadas'));references.forEach(source=>appendSafeLink(links,source.url,source.titulo||source.verificador||'Consultar fonte','analysis-source-link d-block'));section.append(links);}
  return section;
}
export function renderAnalysis(container,record) {
  return renderValidated(container,assertAnalysisResult(record));
}
export function renderHistoryAnalysis(container,record) {
  return renderValidated(container,normalizeResult(record));
}
function renderValidated(container,data) {
  const visual=getVisual(data),output=document.createDocumentFragment();
  const root=element('div','restored-results compact-results');
  root.append(estimateSummary(data),geminiFeedback(data));
  const legal=legalContext(data);if(legal)root.append(legal);
  const quickSources=compactSources(data);if(quickSources)root.append(quickSources);
  const reading=detailedReading(data);if(reading)root.append(reading);
  const information=extractedInformation(data);if(information)root.append(information);
  const details=element('details','result-details');
  details.append(element('summary','','Fontes e detalhes da análise'));
  const body=element('div','result-details-content');
  const conclusion=panel('factual-summary');
  const factualLabel=data.legado?'Registro legado':FACTUAL.has(data.veredito)?data.veredito:'Sem evidências suficientes';
  conclusion.append(element('small','','Conclusão pelas evidências publicadas'),element('h3','',factualLabel));
  paragraph(conclusion,text(data.justificativa)||'Leia as checagens e confira se correspondem à afirmação, à data e ao contexto enviados.','small mb-0');
  body.append(conclusion);
  const claims=claimResults(data);if(claims)body.append(claims);
  const article=articleSource(data.noticia);if(article)body.append(article);
  const related=regional(data);if(related)body.append(related);
  body.append(reviewResults(data));
  const sources=sourceList(data);if(sources)body.append(sources);
  const signals=patterns(visual.analiseLocal);if(signals)body.append(signals);
  const comparisons=linguisticComparisons(data);if(comparisons)body.append(comparisons);
  body.append(classificationGuide(data));
  const limits=[...new Set([...list(data.limitacoes),data.avisoHistorico].filter(value=>typeof value==='string'&&value))];
  if(limits.length){const note=element('details','analysis-limitations small mb-3');note.append(element('summary','','Ressalvas desta análise'));const ul=element('ul','analysis-list mt-2');limits.forEach(value=>ul.append(element('li','',value)));note.append(ul);body.append(note);}
  details.append(body);root.append(details);
  output.append(root);container.replaceChildren(output);return data;
}

