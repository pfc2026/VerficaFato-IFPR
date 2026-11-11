import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.js';
import { educationCatalog } from '../services/education.js';
import { lessons } from '../public/js/education-content.js';
import ConteudoEdu from '../models/ConteudoEdu.js';

async function endpoint(t, dbReady = false) {
  const server = createApp({ dbReady: () => dbReady, rateLimits: false }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return () => fetch(`http://127.0.0.1:${server.address().port}/api/education`);
}

function mockRecords(t, records) {
  t.mock.method(ConteudoEdu, 'find', () => ({ sort: () => ({ limit: () => ({ lean: async () => records }) }) }));
}

const oldSources = {
  lessonId: 'fontes',
  titulo: 'Verificando as fontes',
  descricao: 'A origem da informação é uma das primeiras pistas de confiabilidade.',
  categoria: 'verificacao', nivel: 'intermediario', icone: 'fa-link', ordem: 3, ativo: true,
  conteudoHTML: `
    <h3>A importância de verificar fontes</h3>
    <p>Uma das melhores formas de detectar fake news é verificar a origem da informação. Sempre procure a fonte original da notícia.</p>
    <h3>Passos para verificar:</h3>
    <ul>
      <li><strong>1. Encontre o link original:</strong> Clique no link da notícia e observe a URL</li>
      <li><strong>2. Verifique o domínio:</strong> É de um site de notícias conhecido e respeitável?</li>
      <li><strong>3. Pesquise a fonte:</strong> Busque "nome do site + críticas" ou "nome do site + confiável"</li>
      <li><strong>4. Procure em outro lugar:</strong> A mesma notícia aparece em outros jornais?</li>
      <li><strong>5. Veja se tem byline:</strong> Tem nome de jornalista e data clara?</li>
    </ul>
    <h3>Sinais de alerta em websites:</h3>
    <ul>
      <li>Muitos anúncios e pop-ups</li>
      <li>Conteúdo publicado sem assinatura clara</li>
      <li>Design amador ou descuidado</li>
      <li>Nenhuma página "Sobre Nós" ou de contato</li>
    </ul>
  `
};

test('educação pública entrega o catálogo completo sem banco ou consultas ao MongoDB', async t => {
  t.mock.method(ConteudoEdu, 'find', () => { throw new Error('Não deve consultar o banco offline.'); });
  const request = await endpoint(t);
  const response = await request();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.sucesso, true);
  assert.equal(data.origem, 'local');
  assert.equal(data.licoes.length, 10);
  assert.deepEqual(new Set(data.licoes.map(lesson => lesson.lessonId)), new Set(lessons.map(lesson => lesson.lessonId)));
  for (const lesson of data.licoes) {
    assert.ok(lesson.tempoLeitura >= 1);
    assert.match(lesson.atualizadoEm, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(lesson.autoria);
    assert.ok(lesson.conteudoHTML.includes('https://educamidia.org.br/guia/'));
  }
});

test('falha ao ler o banco mantém as aulas e não revela erro interno', async t => {
  t.mock.method(ConteudoEdu, 'find', () => { throw new Error('mongo-internal-secret'); });
  const response = await (await endpoint(t, true))();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.origem, 'local');
  assert.equal(data.licoes.length, 10);
  assert.doesNotMatch(JSON.stringify(data), /mongo-internal-secret/);
});

test('catálogo combina aulas administradas e padrões respeitando desativação', async t => {
  mockRecords(t, [
    { lessonId: 'fontes', ativo: false },
    { lessonId: 'oficina', titulo: 'Oficina local', descricao: 'Atividade da turma.', categoria: 'pratica', nivel: 'basico', ordem: 99, conteudoHTML: '<p>Procure a origem do comunicado.</p>', ativo: true, updatedAt: '2026-10-27T12:00:00.000Z' }
  ]);
  const data = await (await (await endpoint(t, true))()).json();
  assert.equal(data.origem, 'catalogo');
  assert.equal(data.licoes.some(lesson => lesson.lessonId === 'fontes'), false);
  assert.equal(data.licoes.find(lesson => lesson.lessonId === 'oficina').atualizadoEm, '2026-10-27');
  assert.equal(data.licoes.length, 10);
});

test('seed histórico intacto recebe texto revisado sem modificar o registro recebido', () => {
  const record = structuredClone(oldSources);
  const data = educationCatalog([record]);
  const source = data.find(lesson => lesson.lessonId === 'fontes');
  assert.equal(source.conteudoHTML, educationCatalog().find(lesson => lesson.lessonId === 'fontes').conteudoHTML);
  assert.doesNotMatch(source.conteudoHTML, /Design amador ou descuidado/);
  assert.deepEqual(record, oldSources);
});

test('edições administrativas em texto ou título não são substituídas pelo currículo padrão', () => {
  const editedTitle = { ...oldSources, titulo: 'Aula da professora' };
  const renamed = educationCatalog([editedTitle]).find(lesson => lesson.lessonId === 'fontes');
  assert.equal(renamed.titulo, 'Aula da professora');
  assert.match(renamed.conteudoHTML, /Design amador ou descuidado/);
  const editedBody = { ...oldSources, conteudoHTML: '<h3>Atividade autoral</h3><p>Consulte o edital da turma.</p>' };
  assert.match(educationCatalog([editedBody]).find(lesson => lesson.lessonId === 'fontes').conteudoHTML, /Atividade autoral/);
});

test('HTML e links hostis são removidos e campos internos não entram na resposta', () => {
  const data = educationCatalog([{ lessonId: 'custom', titulo: 'Aula', conteudoHTML: '<h3 onclick="alert(1)">Título</h3><script>alert(1)</script><img onerror=alert(1) src=x><a href="javascript:alert(1)">Clique</a><a href="https://example.org/">Referência</a>', ativo: true, segredo: 'interno', icone: 'fa-book onclick=alert(1)' }]);
  const custom = data.find(lesson => lesson.lessonId === 'custom');
  assert.doesNotMatch(custom.conteudoHTML, /script|onerror|onclick|javascript:/i);
  assert.match(custom.conteudoHTML, /https:\/\/example.org\//);
  assert.equal(custom.icone, 'fa-book');
  assert.equal('segredo' in custom, false);
});

test('IDs inválidos e registros desativados personalizados não aparecem', () => {
  const data = educationCatalog([{ lessonId: '<script>', conteudoHTML: '<p>oi</p>' }, { lessonId: 'oficina', ativo: false }]);
  assert.equal(data.length, lessons.length);
});

test('a lição alarmista antiga usa o novo ID sem duplicar o assunto e pode ser desativada', () => {
  const legacy = {
    lessonId: 'alarmista', titulo: 'Palavras alarmistas e sensacionalistas',
    descricao: 'Termos como "urgente" e "bomba" tentam provocar reação imediata.',
    categoria: 'linguagem', nivel: 'basico', icone: 'fa-bell', ordem: 2,
    conteudoHTML: `
      <h3>O poder das palavras sensacionalistas</h3>
      <p>Fake news frequentemente usam palavras como "URGENTE", "BOMBA", "IMPACTANTE" e "REVELAÇÃO" para criar senso de imediatismo e urgência. Essas técnicas exploram a psicologia humana para gerar compartilhamentos impulsivos.</p>
      <h3>Palavras de alerta:</h3>
      <ul>
        <li>URGENTE / BREAKING NEWS</li>
        <li>BOMBA / EXPLOSIVO</li>
        <li>IMPACTANTE / CHOCANTE</li>
        <li>REVELAÇÃO / SECRETO</li>
        <li>VOCÊ NÃO SABIA</li>
        <li>MÉDICOS ODEIAM ESTE TRUQUE</li>
        <li>CONFIRA ANTES QUE REMOVAM</li>
      </ul>
      <h3>Por que funcionam?</h3>
      <p>Quando o cérebro sente urgência e emoção forte, tendemos a compartilhar ANTES de verificar. Isso é explorado pragmática e propositalmente por criadores de conteúdo sensacionalista.</p>
      <h3>Dica importante:</h3>
      <p>Se uma notícia é verdadeiramente importante e confiável, ela não precisa de palavras sensacionalistas para convencer você. Jornalismo sério deixa os fatos falarem por si.</p>
    `
  };
  const revised = educationCatalog([legacy]);
  assert.equal(revised.length, lessons.length);
  assert.equal(revised.some(lesson => lesson.lessonId === 'alarmista'), false);
  assert.equal(revised.filter(lesson => lesson.lessonId === 'sensacionalismo').length, 1);
  const disabled = educationCatalog([{ ...legacy, ativo: false }]);
  assert.equal(disabled.some(lesson => lesson.lessonId === 'sensacionalismo'), false);
});
