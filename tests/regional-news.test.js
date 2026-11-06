import test from 'node:test';
import assert from 'node:assert/strict';
import NoticiaColetada from '../models/NoticiaColetada.js';
import { regionalTerms, rankRegionalNews } from '../services/regional-news.js';

const query = 'O vídeo de um domo não comprova que a Terra seja plana.';
const longQuery = 'Circula nas redes sociais um vídeo que mostra uma construção em forma de domo. Na legenda, o autor afirma que o vídeo comprova que a Terra é plana. Mas isso não é verdade, de acordo com especialistas consultados pela reportagem. O vídeo foi registrado no Paraná e mostra pessoas em um local público. O autor da publicação disse que as imagens seriam prova de que existe um domo sobre a Terra. A construção faz parte de um parque de diversões e não tem relação com o formato do planeta.';
const unrelated = [
  { titulo: 'Paciente recebe transfusão de sangue em hospital', texto: 'A família disse que o paciente foi atendido em um hospital no Paraná.', url: 'https://example.org/hospital' },
  { titulo: 'Casas são soterradas após temporal', texto: 'Um caso de deslizamento foi registrado na cidade. A casa ficou enterrada.', url: 'https://example.org/temporal' }
];
const related = { titulo: 'Domo em vídeo não prova Terra plana', texto: 'O domo é uma atração turística. A Terra não é plana.', url: 'https://example.org/domo' };

function database(records) {
  return {
    db: { readyState: 1 },
    find() {
      return { sort() { return this; }, limit() { return this; }, maxTimeMS() { return this; }, lean: async () => records };
    },
    findOne() { return { maxTimeMS() { return this; }, lean: async () => null }; }
  };
}

test('regional matching removes stop words, accent differences and substring matches', () => {
  assert.deepEqual(regionalTerms('A vídeo mostra notícias sobre a transfusão no Paraná.'), ['transfusao', 'parana']);
  assert.deepEqual(rankRegionalNews(unrelated, query), []);
  assert.deepEqual(rankRegionalNews([{ titulo: 'Casa soterrada', texto: 'Terraplanagem na cidade', url: 'https://example.org/solo' }], 'Terra plana'), []);
  assert.equal(rankRegionalNews([{ titulo: 'Transfusão no Paraná', texto: '' }], 'transfusao parana').length, 1);
});

test('regional matching requires shared topic terms and ranks pertinent stories', () => {
  assert.deepEqual(rankRegionalNews([...unrelated, related], query).map(item => item.url), [related.url]);
  assert.deepEqual(rankRegionalNews(unrelated, 'foi uma notícia e o vídeo mostra isso'), []);
  assert.deepEqual(rankRegionalNews(unrelated, 'hospital'), []);
});

test('MongoDB text results receive the same minimum relevance filter as the local archive', async () => {
  const result = await NoticiaColetada.buscarCorrespondentes.call(database(unrelated), query);
  assert.deepEqual(result, []);
  const pertinent = await NoticiaColetada.buscarCorrespondentes.call(database([...unrelated, related]), query);
  assert.deepEqual(pertinent.map(item => item.url), [related.url]);
  assert.equal(pertinent[0].correspondencia, 'termos');
});

test('the local archive returns no regional stories for an unrelated flat-Earth query', async () => {
  assert.deepEqual(await NoticiaColetada.buscarCorrespondentes.call({ db: { readyState: 0 } }, query), []);
  assert.deepEqual(await NoticiaColetada.buscarCorrespondentes.call({ db: { readyState: 0 } }, longQuery), []);
});

test('generic body overlap and one shared location never substitute for the actual topic', async () => {
  const irrelevant = { titulo: 'Câmeras em banheiros de escolas do Paraná', texto: 'A forma do equipamento foi registrada de acordo com pessoas no local público. O formato e a prova foram apresentados para a comunidade.', url: 'https://example.org/camera' };
  assert.deepEqual(rankRegionalNews([irrelevant], longQuery), []);
  assert.deepEqual(await NoticiaColetada.buscarCorrespondentes.call(database([irrelevant]), longQuery), []);
  assert.deepEqual(rankRegionalNews([irrelevant, related], longQuery).map(item => item.url), [related.url]);
});

test('an exact stored publication URL remains a context reference even without query terms', async () => {
  const model = database([]);
  model.findOne = () => ({ maxTimeMS() { return this; }, lean: async () => related });
  const result = await NoticiaColetada.buscarCorrespondentes.call(model, '', related.url);
  assert.equal(result.length, 1);
  assert.equal(result[0].correspondencia, 'url');
});
