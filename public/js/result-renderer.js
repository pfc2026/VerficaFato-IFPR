import { element, appendSafeLink } from './safe-dom.js';
import { lessons } from './education-content.js';
import { recommendedLessons, isLessonAvailable } from './education.js';

const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value : '';
const FACTUAL = new Set(['Verdadeiro','Falso','Parcialmente verdadeiro','Enganoso','Sem evidências suficientes','Não verificável']);
const COLORS = { green:'#27AE60', yellow:'#F39C12', orange:'#E67E22', red:'#E74C3C', blue:'#3498DB' };
const percent = value => typeof value === 'number' && Number.isFinite(value) ? Math.max(0,Math.min(100,Math.round(value))) : null;
const count = value => typeof value === 'number' && Number.isFinite(value) ? Math.max(0,Math.floor(value)) : 0;
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
function visualVerdict(pct) {
  if(pct === null)return {cor:COLORS.yellow,bg:'rgba(243,156,18,0.15)',label:'Indicadores indisponíveis',icone:'fa-circle-question'};
  if(pct>=75)return {cor:COLORS.green,bg:'rgba(39,174,96,0.15)',label:'Mais referências e sinais formais',icone:'fa-chart-simple'};
  if(pct>=55)return {cor:'#7DCB7A',bg:'rgba(125,203,122,0.15)',label:'Alguns sinais formais no texto',icone:'fa-chart-simple'};
  if(pct>=40)return {cor:COLORS.yellow,bg:'rgba(243,156,18,0.15)',label:'Padrões mistos no texto',icone:'fa-chart-simple'};
  if(pct>=20)return {cor:COLORS.orange,bg:'rgba(230,126,34,0.15)',label:'Padrões que pedem atenção',icone:'fa-triangle-exclamation'};
  return {cor:COLORS.red,bg:'rgba(231,76,60,0.15)',label:'Mais padrões de alerta',icone:'fa-triangle-exclamation'};
}
export function normalizeResult(record={}) {
  const source=record&&typeof record==='object'?record:{};
  if(source.resultado?.schemaVersion===2)return source.resultado;
  if(source.schemaVersion===2)return source;
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
  const pct=percent(visual.porcentagem);
  const verdict=visualVerdict(pct);
  return {
    ...visual,porcentagem:pct,
    veredito:verdict.label,
    texto:text(visual.texto)||text(data.texto)||text(data.resumo),
    analiseLocal:visual.analiseLocal||data.analiseLocal||{},
    dimensoes:visual.dimensoes||data.dimensoes||{},
    explicacao:'O índice reúne sinais automáticos de linguagem, estrutura e referências. Um valor alto não confirma a mensagem; um valor baixo não prova que ela é falsa. A conclusão factual depende das evidências.',
    palette:verdict
  };
}
export function resultLabel(record) {
  const data=normalizeResult(record);
  if(data.legado)return 'Registro legado';
  return FACTUAL.has(data.veredito)?data.veredito:'Sem evidências suficientes';
}
export function resultBadge(record) {
  const data=normalizeResult(record),visual=getVisual(data);
  const badge=element('span','badge badge-veredito',resultLabel(data));
  if(data.legado)badge.classList.add('bg-secondary');
  else badge.classList.add('bg-secondary');
  return badge;
}
function header(data,visual) {
  const row=element('div','mb-3 d-flex align-items-center gap-2 flex-wrap');
  const tag=(label,className,name)=>{const node=element('span','badge '+className);if(name)node.append(icon(name));node.append(document.createTextNode(label));row.append(node);};
  if(data.legado)tag('Registro legado','bg-secondary','fa-clock me-1');
  else if(data.apiDisponivel===false)tag('Google indisponível','bg-warning text-dark fs-6','fa-cloud-slash me-1');
  else if(list(data.resultados).length){tag('Verificações encontradas','bg-success fs-6','fa-check-circle me-1');tag(list(data.resultados).length+' resultado(s)','bg-secondary');}
  else tag('Análise local aplicada','bg-warning text-dark fs-6','fa-magnifying-glass me-1');
  const info={cor:COLORS.blue,label:'Análise automática'};
  const badge=styled(element('span','badge'),{background:info.cor+'22',color:info.cor,border:'1px solid '+info.cor+'55'});
  badge.append(icon('fa-gauge-high me-1'),document.createTextNode(info.label));
  row.append(badge);
  return row;
}
function meter(visual,data) {
  const v=visual.palette;
  const card=styled(element('section','credibility-meter p-4 mb-3'),{background:v.bg,border:'1px solid '+v.cor+'33',borderRadius:'16px'});
  const top=element('div','d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2');
  const left=element('div');
  const title=element('div','d-flex align-items-center gap-2 mb-1');
  title.append(icon(v.icone+' fs-4',v.cor),styled(element('span','fw-bold fs-5',data.legado?'Registro legado':visual.veredito),{color:v.cor}));
  left.append(title,styled(element('small','','Indicadores de linguagem · não são uma conclusão factual'),{opacity:'0.8'}));
  const ring=styled(element('div','percentage-circle'),{
    width:'90px',height:'90px',borderRadius:'50%',
    background:'conic-gradient('+v.cor+' '+((visual.porcentagem??0)*3.6)+'deg, rgba(255,255,255,0.1) 0deg)',
    display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 0 6px '+v.cor+'22'
  });
  const inner=styled(element('div'),{width:'66px',height:'66px',borderRadius:'50%',background:'var(--surface-solid,#16241b)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'});
  inner.append(styled(element('span','meter-percentage',visual.porcentagem===null?'—':visual.porcentagem+'%'),{fontSize:'1.4rem',fontWeight:'800',color:v.cor,lineHeight:'1'}),styled(element('span','','índice'),{fontSize:'0.55rem',opacity:'0.7',textTransform:'uppercase',color:'var(--text-main)'}));
  ring.append(inner);top.append(left,ring);card.append(top);
  const progress=styled(element('div','progress mb-1'),{height:'10px',borderRadius:'8px',background:'rgba(255,255,255,0.1)'});
  const bar=styled(element('div','progress-bar'),{width:(visual.porcentagem??0)+'%',background:'linear-gradient(90deg,'+v.cor+','+v.cor+'bb)',borderRadius:'8px'});
  bar.setAttribute('role','progressbar');bar.setAttribute('aria-label','Índice heurístico de padrões');
  bar.setAttribute('aria-valuenow',String(visual.porcentagem??0));bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');
  progress.append(bar);card.append(progress);
  const scale=styled(element('div','d-flex justify-content-between mb-2'),{fontSize:'0.7rem',opacity:'0.6'});
  scale.append(element('span','','Mais alertas'),element('span','','Incerto'),element('span','','Mais sinais positivos'));card.append(scale);
  const explanation=styled(element('div','d-flex gap-2 align-items-start pt-2'),{borderTop:'1px solid '+v.cor+'22'});
  explanation.append(icon('fa-circle-info mt-1',v.cor),styled(element('small','meter-explanation',data.legado?data.justificativa:visual.explicacao),{opacity:'0.85',whiteSpace:'pre-line'}));card.append(explanation);
  card.append(element('small','heuristic-disclaimer d-block mt-2','Índice de padrões; não representa probabilidade de veracidade.'));
  return card;
}
function regional(data) {
  const items=list(data.noticiasRegionais);if(!items.length)return null;
  const section=styled(panel('regional-findings'),{background:'rgba(39,174,96,0.15)',borderColor:'rgba(39,174,96,0.4)'});
  heading(section,'Reportagens da imprensa regional','fa-newspaper me-2');
  paragraph(section,'Referências de contexto; a presença no acervo não confirma a afirmação.','small');
  items.forEach(item=>{
    const card=styled(element('article','p-2 mb-2'),{background:'rgba(0,0,0,0.2)',borderRadius:'10px',borderLeft:'4px solid '+COLORS.green});
    paragraph(card,text(item.titulo),'fw-semibold mb-1');
    paragraph(card,[text(item.fonte),text(item.data_publicacao)].filter(Boolean).join(' · '),'small mb-1');
    paragraph(card,text(item.texto),'small mb-2');
    appendSafeLink(card,item.url,'Ler reportagem completa no portal','btn btn-sm btn-outline-success');
    section.append(card);
  });return section;
}
function metrics(visual,data) {
  const row=element('div','row g-2 mb-3 result-metrics');
  const negative=list(visual.analiseLocal.alertasFalso).length,positive=list(visual.analiseLocal.alertasConfiavel).length;
  const wordCount=typeof visual.quantidadePalavras==='number'?count(visual.quantidadePalavras):visual.texto.trim().split(/\s+/).filter(Boolean).length;
  [[negative,'sinais de alerta',negative>3?COLORS.red:COLORS.green],[positive,'sinais positivos',COLORS.green],[wordCount,'palavras',''],[list(data.resultados).length,'fact-checks API',list(data.resultados).length?COLORS.green:COLORS.yellow]].forEach(([value,label,color])=>{
    const col=element('div','col-6 col-md-3');
    const card=styled(element('div','metric-card text-center p-2'),{background:'var(--card-bg,rgba(255,255,255,0.08))',border:'1px solid var(--border,rgba(255,255,255,0.15))',borderRadius:'12px'});
    card.append(styled(element('div','metric-value',value),{fontSize:'1.3rem',fontWeight:'700',color}),styled(element('div','metric-label',label),{fontSize:'0.7rem',opacity:'0.7'}));
    col.append(card);row.append(col);
  });return row;
}
function overview(dimensions) {
  const entries=[['sensacionalismo','Sensacionalismo','fa-bullhorn',COLORS.orange],['fonte','Qualidade da fonte','fa-link',COLORS.green],['estrutura','Completude do texto','fa-file-lines',COLORS.blue]];
  if(!entries.some(([key])=>dimensions[key]&&typeof dimensions[key]==='object'))return null;
  const section=element('section','analysis-overview mb-3');
  const top=element('div','d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3');
  heading(top,'Leitura detalhada da notícia','fa-chart-simple me-2','mb-0');
  top.append(element('small','analysis-disclaimer','Indicadores automáticos, não prova definitiva'));section.append(top);
  const row=element('div','row g-2');
  entries.forEach(([key,title,name,color])=>{
    const item=dimensions[key];if(!item||typeof item!=='object')return;
    const col=element('div','col-12 col-md-4');
    const card=element('div','analysis-card h-100');
    const line=element('div','d-flex justify-content-between align-items-center gap-2 mb-2');
    const label=element('span','analysis-card-title');label.append(icon(name+' me-2',color),document.createTextNode(title));
    const score=percent(item.pontuacao);
    line.append(label,styled(element('strong','',(score??0)+'/100'),{color}));card.append(line);
    const progress=element('div','progress analysis-progress mb-2');progress.setAttribute('role','progressbar');progress.setAttribute('aria-label',title);progress.setAttribute('aria-valuenow',String(score??0));progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax','100');
    progress.append(styled(element('div','progress-bar'),{width:(score??0)+'%',background:color}));card.append(progress);
    card.append(element('span','analysis-level',text(item.nivel)),element('small','',text(item.descricao)));
    col.append(card);row.append(col);
  });section.append(row);
  if(dimensions.evidencia){
    const evidence=element('div','analysis-evidence mt-2');evidence.append(icon('fa-shield-halved me-2'),document.createTextNode('Evidência usada: '),element('strong','',text(dimensions.evidencia.tipo)));
    if(dimensions.evidencia.quantidade)evidence.append(document.createTextNode(' ('+count(dimensions.evidencia.quantidade)+' resultado(s))'));
    section.append(evidence);
  }return section;
}
function information(info) {
  if(!info||typeof info!=='object')return null;
  const section=element('section','news-information mb-3');
  heading(section,'Informações extraídas do texto','fa-circle-info me-2','mb-3');
  const claim=element('div','news-claim');claim.append(element('span','','Alegação principal'),element('p','',text(info.alegacaoPrincipal)||'Não identificada'));section.append(claim);
  const grid=element('div','news-info-grid');
  [['Palavras importantes','fa-key','palavrasImportantes'],['Nomes e entidades','fa-user-tag','entidades'],['Números e valores','fa-hashtag','numeros'],['Datas','fa-calendar-days','datas']].forEach(([title,name,key])=>{
    const group=element('div','news-info-group'),label=element('strong');label.append(icon(name+' me-2'),document.createTextNode(title));
    const values=element('div','news-info-values');
    const items=list(info[key]);if(items.length)items.forEach(value=>values.append(element('span','',text(value))));else values.append(element('em','','Não identificado'));
    group.append(label,values);grid.append(group);
  });section.append(grid);
  if(list(info.links).length){const links=element('div','news-links mt-3');links.append(element('strong','','Links encontrados'));info.links.forEach(url=>appendSafeLink(links,url,url));section.append(links);}
  return section;
}
function articleSource(article) {
  if(!article?.url)return null;
  const section=element('section','article-source mb-3'),row=element('div','d-flex gap-2 align-items-start'),content=element('div','flex-grow-1 min-width-0');
  row.append(icon('fa-newspaper mt-1','#74b9ff'));heading(content,'Fonte enviada',null,'mb-1');
  if(article.titulo)content.append(element('strong','article-source-title',text(article.titulo)));
  paragraph(content,text(article.descricao),'article-source-description mb-2');
  appendSafeLink(content,article.url,article.url,'article-source-url');
  const status=element('small','d-block mt-2 '+(article.conteudoObtido?'text-success':'text-warning'));
  status.append(icon((article.conteudoObtido?'fa-circle-check':'fa-triangle-exclamation')+' me-1'),document.createTextNode(article.conteudoObtido?'Título e conteúdo da página foram analisados.':'O conteúdo da página não foi lido. '+(text(article.erroConteudo)||'')));
  content.append(status);row.append(content);section.append(row);return section;
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
function characteristics(visual,data) {
  const section=panel('text-characteristics');heading(section,'Características do texto','fa-file-lines me-2');
  const chars=typeof visual.quantidadeCaracteres==='number'?count(visual.quantidadeCaracteres):visual.texto.length;
  const words=typeof visual.quantidadePalavras==='number'?count(visual.quantidadePalavras):visual.texto.trim().split(/\s+/).filter(Boolean).length;
  const hasLink=/https?:\/\/[^\s]+/.test(visual.texto),hasDate=/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(visual.texto);
  const row=element('div','row g-1');
  [
    (chars>200?'✅':'⚠️')+' Tamanho: '+(chars<80?'muito curto':chars<200?'curto':chars<600?'médio':'longo')+' ('+chars+' caracteres)',
    (hasLink?'✅ Contém link/fonte':'❌ Sem link de fonte'),
    (hasDate?'✅ Contém data':'❌ Sem data clara'),
    (!list(visual.analiseLocal.alertasFalso).length?'✅ Linguagem neutra':'⚠️ Linguagem emocional/alarmista'),
    '📝 '+words+' palavra(s) no total',
    list(data.resultados).length?'🌐 '+list(data.resultados).length+' fact-check(s) consultado(s)':'🔍 Nenhum fact-check externo'
  ].forEach(value=>{const col=element('div','col-6');col.append(element('small','',value));row.append(col);});
  section.append(row);return section;
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
function geminiFeedback(data) {
  const section=panel('gemini-feedback');heading(section,'Feedback do Gemini','fa-wand-magic-sparkles me-2');
  const feedback=data.feedbackGemini||{};
  const content=text(feedback.texto)||'O feedback do Gemini não está disponível nesta análise. Os indicadores e as checagens acima continuam disponíveis.';
  paragraph(section,content,'gemini-feedback-text mb-2');
  if(feedback.status==='ia')paragraph(section,'Comentário gerado por IA; confira as fontes e o contexto.','small opacity-75 mb-1');
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
  const data=normalizeResult(record),visual=getVisual(data),output=document.createDocumentFragment();
  const root=element('div','restored-results');
  const conclusion=panel('factual-summary');
  conclusion.append(element('small','','Conclusão pelas evidências'),element('h3','',resultLabel(data)));
  paragraph(conclusion,text(data.justificativa)||'Leia as checagens e confira se correspondem à afirmação, à data e ao contexto enviados.','small mb-0');
  root.append(conclusion,header(data,visual),meter(visual,data));
  const related=regional(data);if(related)root.append(related);
  root.append(metrics(visual,data));
  const details=overview(visual.dimensoes);if(details)root.append(details);
  const info=information(visual.dimensoes.informacoes || {alegacaoPrincipal:visual.texto});if(info)root.append(info);
  const article=articleSource(data.noticia);if(article)root.append(article);
  const signals=patterns(visual.analiseLocal);if(signals)root.append(signals);
  root.append(characteristics(visual,data),reviewResults(data));
  const sources=sourceList(data);if(sources)root.append(sources);
  const guidance=panel('user-guidance');heading(guidance,'O que fazer com essa informação','fa-list-check me-2');
  paragraph(guidance,text(data.secoes?.orientacao)||'Consulte a fonte original e confira datas, nomes e contexto antes de compartilhar. Indicadores de linguagem não substituem checagens publicadas.','small mb-0');root.append(guidance);
  const learning=panel('learning-recommendations');
  heading(learning,'Continue aprendendo','fa-book-open me-2');
  paragraph(learning,'Aulas para ajudar você a dar o próximo passo na investigação.','small mb-0');
  const links=element('div','learning-links');
  recommendedLessons(data).forEach(id=>{
    if(!isLessonAvailable(id))return;
    const lesson=lessons.find(item=>item.lessonId===id);
    if(!lesson)return;
    const link=element('a','',lesson.titulo+' →');
    link.href='/#licao-'+id;
    link.dataset.openLesson=id;
    links.append(link);
  });
  if(links.childElementCount){learning.append(links);root.append(learning);}
  root.append(geminiFeedback(data));
  const limits=[...new Set([...list(data.limitacoes),data.avisoHistorico].filter(value=>typeof value==='string'&&value))];
  if(limits.length){const note=element('details','analysis-limitations small mb-3');note.append(element('summary','','Limitações da análise'));const ul=element('ul','analysis-list mt-2');limits.forEach(value=>ul.append(element('li','',value)));note.append(ul);root.append(note);}
  paragraph(root,'A análise de padrões é automática e não substitui verificação jornalística humana. Sempre consulte fontes primárias antes de compartilhar.','result-disclaimer mt-3 mb-0 text-center');
  output.append(root);container.replaceChildren(output);return data;
}

