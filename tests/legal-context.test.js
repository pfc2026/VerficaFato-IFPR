import test from 'node:test';
import assert from 'node:assert/strict';
import { legalCandidates, legalResponseSchema, validateLegalContext } from '../services/legal-context.js';

const now = new Date('2026-11-11T12:00:00Z');
const culture = 'O centro cultural anunciou um festival de música gratuito na praça no próximo domingo, com artistas locais.';
const corruption = 'Um agente público está sendo investigado por possível corrupção passiva, após suspeita de receber propina por contratos municipais.';
const leak = 'Uma empresa investiga um vazamento de dados pessoais de clientes, incluindo CPF e informações de cadastro, após acesso não autorizado.';
const election = 'Durante a campanha eleitoral, a polícia investiga a divulgação de informação sabidamente falsa sobre um candidato e capaz de influenciar o eleitorado.';
const accusation = 'Uma publicação acusa João de cometer um crime, mas não apresenta documentos nem fontes suficientes para verificar a acusação.';
const factualError = 'Uma mensagem informa incorretamente que o festival cultural será na sexta-feira. A programação oficial informa que será no domingo.';
const selection = (text, id, extra = {}) => ({
  id, categoria: 'acontecimento_noticiado', trecho_noticia: text,
  situacao_juridica: 'Situação não identificada', trecho_situacao: '', ...extra
});
function validate(text, refs, extra = {}) {
  return validateLegalContext({ aplicavel: true, referencias: refs }, {
    text, candidates: legalCandidates(text, { now }), now, ...extra
  });
}
function assertUnidentified(result) {
  assert.equal(result.aplicavel, true);
  assert.equal(result.referencias.length, 1);
  assert.equal(result.referencias[0].situacao_juridica, 'Situação não identificada');
  assert.equal(result.referencias[0].trecho_situacao, '');
  assert.match(result.referencias[0].ressalvas, /etapa processual não pôde ser vinculada/);
}

test('ordinary culture, weather and factual mistakes offer no forced legal candidates', () => {
  for (const text of [culture, 'A previsão do tempo indica chuva fraca amanhã, com queda de temperatura durante a noite.', factualError]) {
    assert.deepEqual(legalCandidates(text, { now }), []);
    assert.deepEqual(validate(text, [selection(text, 'cp-171')]), { aplicavel: false, referencias: [] });
  }
});

test('corruption investigation has grounded canonical law and no attributed guilt', () => {
  const result = validate(corruption, [selection(corruption, 'cp-317', {
    situacao_juridica: 'Investigação', trecho_situacao: 'está sendo investigado por possível corrupção passiva'
  })]);
  assert.equal(result.aplicavel, true);
  assert.equal(result.referencias.length, 1);
  const reference = result.referencias[0];
  assert.equal(reference.artigo, '317');
  assert.equal(reference.categoria, 'acontecimento_noticiado');
  assert.equal(reference.situacao_juridica, 'Investigação');
  assert.match(reference.consequencias, /2 a 12 anos/);
  assert.match(reference.ressalvas, /não afirma culpa/);
  assert.match(reference.relacao_com_noticia, /Pode estar relacionado/);
  assert.equal(reference.verificada, true);
  assert.equal(new URL(reference.fonte_oficial).hostname, 'www2.camara.leg.br');
});

test('data leakage has LGPD context with the journalistic exception', () => {
  const result = validate(leak, [selection(leak, 'lgpd-46')]);
  assert.equal(result.aplicavel, true);
  assert.match(result.referencias[0].lei, /13\.709/);
  assert.match(result.referencias[0].ressalvas, /exclusivamente jornalísticos/);
  assert.deepEqual(validate(leak, [selection(leak, 'lgpd-46', { categoria: 'publicacao' })]), { aplicavel: false, referencias: [] });
  assert.deepEqual(legalCandidates('A notícia menciona Maria e o nome de seus clientes em evento cultural.', { now }), []);
});

test('electoral disinformation requires campaign, target and knowledge, with correct alternative penalty', () => {
  const result = validate(election, [selection(election, 'ce-323', {
    situacao_juridica: 'Investigação', trecho_situacao: 'a polícia investiga a divulgação'
  })]);
  assert.equal(result.aplicavel, true);
  assert.match(result.referencias[0].consequencias, /2 meses a 1 ano ou 120 a 150 dias-multa/);
  assert.match(result.referencias[0].ressalvas, /não comprovam/);
  for (const text of [
    'Um candidato divulgou uma informação incorreta sobre um festival cultural fora de contexto eleitoral.',
    'Durante a campanha eleitoral um candidato publicou informação ainda não verificada sobre outro candidato.',
    'Durante a campanha eleitoral circulou uma informação sabidamente falsa sobre a previsão do tempo.'
  ]) assert.ok(!legalCandidates(text, { now }).some(candidate => candidate.id === 'ce-323'));
});

test('unsupported accusation triggers no automatic crime against honour', () => {
  assert.ok(!legalCandidates(accusation, { now }).some(candidate => candidate.id.startsWith('cp-13')));
  const text = 'Uma publicação acusou falsamente João de cometer um crime de roubo; a acusação falsa foi documentada e está sendo investigada.';
  const result = validate(text, [selection(text, 'cp-138', { categoria: 'publicacao' })]);
  assert.equal(result.aplicavel, true);
  assert.equal(result.referencias[0].categoria, 'publicacao');
  assert.match(result.referencias[0].ressalvas, /não prova que a acusação seja falsa/);
});

test('nonexistent articles, unverified links, invented consequences and unknown fields are rejected', () => {
  for (const item of [
    selection(corruption, 'cp-99999'),
    { ...selection(corruption, 'cp-317'), artigo: '99999' },
    { ...selection(corruption, 'cp-317'), fonte_oficial: 'https://example.com/fake-law' },
    { ...selection(corruption, 'cp-317'), consequencias: 'Condenação automática a 99 anos.' },
    { ...selection(corruption, 'cp-317'), lei: 'Projeto de Lei inventado' }
  ]) assert.deepEqual(validate(corruption, [item]), { aplicavel: false, referencias: [] });
});

test('invalid legal item does not discard a valid legal item', () => {
  const result = validate(corruption, [selection(corruption, 'cp-99999'), selection(corruption, 'cp-317')]);
  assert.equal(result.aplicavel, true);
  assert.deepEqual(result.referencias.map(item => item.id), ['cp-317']);
});

test('unoffered law, unrelated snippet, fabricated quote and duplicate selection cannot pass', () => {
  assert.deepEqual(validate(corruption, [selection(corruption, 'cp-317')], { candidates: [] }), { aplicavel: false, referencias: [] });
  assert.deepEqual(validate(corruption, [selection('Um agente público recebeu propina confirmada pela Justiça.', 'cp-317')]), { aplicavel: false, referencias: [] });
  const combined = corruption + ' ' + culture;
  assert.deepEqual(validate(combined, [selection(culture, 'cp-317')]), { aplicavel: false, referencias: [] });
  const result = validate(corruption, [selection(corruption, 'cp-317'), selection(corruption, 'cp-317')]);
  assert.equal(result.referencias.length, 1);
});

test('legal situation must have literal, non-negated support and cannot confuse a complaint with prosecution', () => {
  assertUnidentified(validate(corruption, [selection(corruption, 'cp-317', {
    situacao_juridica: 'Condenação', trecho_situacao: 'está sendo investigado por possível corrupção passiva'
  })]));
  const negated = corruption + ' O agente não foi condenado.';
  assertUnidentified(validate(negated, [selection(corruption, 'cp-317', {
    situacao_juridica: 'Condenação', trecho_situacao: 'O agente não foi condenado.'
  })]));
  const future = corruption + ' O Ministério Público pede que ele seja condenado.';
  assertUnidentified(validate(future, [selection(corruption, 'cp-317', {
    situacao_juridica: 'Condenação', trecho_situacao: 'O Ministério Público pede que ele seja condenado.'
  })]));
  const policeComplaint = corruption + ' Moradores fizeram uma denúncia à polícia.';
  assertUnidentified(validate(policeComplaint, [selection(corruption, 'cp-317', {
    situacao_juridica: 'Denúncia', trecho_situacao: 'Moradores fizeram uma denúncia à polícia.'
  })]));
  const charge = 'O Ministério Público ofereceu denúncia criminal contra o agente público por corrupção passiva e recebimento de propina.';
  assert.equal(validate(charge, [selection(charge, 'cp-317', {
    situacao_juridica: 'Denúncia', trecho_situacao: 'O Ministério Público ofereceu denúncia criminal'
  })]).referencias[0].situacao_juridica, 'Denúncia');
});

test('cultural discussion of law is not an allegation of criminal conduct', () => {
  const text = 'O prefeito visitou a mostra cultural Combate à Corrupção, que reúne pinturas de alunos e não relata qualquer irregularidade.';
  assert.deepEqual(legalCandidates(text, { now }), []);
  assert.deepEqual(validate(text, [selection(text, 'cp-317')]), { aplicavel: false, referencias: [] });
});

test('cropping cannot remove negation from the original sentence', () => {
  const text = 'O prefeito é investigado por suposta corrupção, mas não foi condenado e nega as acusações.';
  assertUnidentified(validate(text, [selection(text, 'cp-317', {
    situacao_juridica: 'Condenação', trecho_situacao: 'foi condenado'
  })]));
  const noLeak = 'Não houve vazamento de dados pessoais de clientes, segundo a auditoria concluída pela empresa.';
  assert.deepEqual(validate(noLeak, [selection('vazamento de dados pessoais de clientes', 'lgpd-46')]), { aplicavel: false, referencias: [] });
});

test('stage from another case cannot be attached to a legal reference', () => {
  const first = 'O prefeito é investigado por possível corrupção.';
  const text = first + ' Em outro caso, o empresário foi condenado por fraude.';
  assertUnidentified(validate(text, [selection(first, 'cp-317', {
    situacao_juridica: 'Condenação', trecho_situacao: 'o empresário foi condenado por fraude'
  })]));
  assertUnidentified(validate(text, [selection(text, 'cp-317', {
    situacao_juridica: 'Condenação', trecho_situacao: 'o empresário foi condenado por fraude'
  })]));
});

test('reporting an investigated event does not become a publication offence', () => {
  const text = 'A reportagem relata que o empresário é investigado por racismo contra funcionários.';
  assert.deepEqual(validate(text, [selection(text, 'racismo-20', {
    categoria: 'publicacao', situacao_juridica: 'Investigação', trecho_situacao: 'o empresário é investigado por racismo'
  })]), { aplicavel: false, referencias: [] });
  assert.equal(validate(text, [selection(text, 'racismo-20', {
    categoria: 'acontecimento_noticiado', situacao_juridica: 'Investigação', trecho_situacao: 'o empresário é investigado por racismo'
  })]).aplicavel, true);
});

test('a victim report to the police is not a prosecutorial charge', () => {
  const text = 'A vítima registrou uma denúncia criminal de racismo na delegacia para iniciar uma apuração policial.';
  assertUnidentified(validate(text, [selection(text, 'racismo-20', {
    situacao_juridica: 'Denúncia', trecho_situacao: 'registrou uma denúncia criminal de racismo na delegacia'
  })]));
});

test('publication verbs followed by attributed reporting do not turn an event into a publication offence', () => {
  for (const text of [
    'O jornal publicou que a polícia investiga racismo contra trabalhadores em uma empresa.',
    'A reportagem divulga que o empresário é investigado por racismo contra funcionários.',
    'O jornal divulgou a investigação de racismo contra trabalhadores em uma empresa.'
  ]) {
    assert.deepEqual(validate(text, [selection(text, 'racismo-20', { categoria: 'publicacao' })]), { aplicavel: false, referencias: [] });
    assert.equal(validate(text, [selection(text, 'racismo-20')]).aplicavel, true);
  }
});

test('direct and indirect questions or negative answers do not establish a conviction', () => {
  for (const text of [
    'O jornal perguntou se o prefeito foi condenado por corrupção passiva, mas a Justiça respondeu que não.',
    'O jornal questionou se o prefeito foi condenado por corrupção passiva.',
    'O prefeito foi condenado por corrupção passiva?',
    'Caso o prefeito tenha sido condenado por corrupção passiva, a reportagem será atualizada.',
    'O prefeito foi condenado por corrupção passiva, mas a Justiça desmentiu a condenação.'
  ]) {
    assertUnidentified(validate(text, [selection(text, 'cp-317', {
      situacao_juridica: 'Condenação', trecho_situacao: text.includes('o prefeito foi condenado') ? 'o prefeito foi condenado' : text
    })]));
  }
});

test('malformed or inapplicable legal output stays absent with strict six-item cap', () => {
  for (const raw of [null, [], {}, { aplicavel: false, referencias: [selection(corruption, 'cp-317')] },
    { aplicavel: true, referencias: 'invalid' }, { aplicavel: true, referencias: [], extra: true },
    { aplicavel: true, referencias: Array(7).fill(selection(corruption, 'cp-317')) }]) {
    assert.deepEqual(validateLegalContext(raw, { text: corruption, candidates: legalCandidates(corruption, { now }), now }), { aplicavel: false, referencias: [] });
  }
});

test('review window expires fail-closed and future/unparsable verification dates are not trusted', () => {
  for (const date of ['2026-11-10T23:59:59Z', '2026-12-11T00:00:00Z', '2030-01-01', 'invalid']) {
    const expiredNow = new Date(date);
    assert.deepEqual(legalCandidates(corruption, { now: expiredNow }), []);
    assert.deepEqual(validate(corruption, [selection(corruption, 'cp-317')], { now: expiredNow }), { aplicavel: false, referencias: [] });
  }
  assert.ok(legalCandidates(corruption, { now: new Date('2026-12-10T23:59:59Z') }).length);
});

test('structured schema includes only reviewed candidate IDs and no model-supplied legal prose or URLs', () => {
  const candidates = legalCandidates(corruption, { now });
  const schema = legalResponseSchema(candidates);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.referencias.maxItems, 6);
  const item = schema.properties.referencias.items;
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(item.properties.id.enum, candidates.map(candidate => candidate.id));
  assert.ok(!item.properties.fonte_oficial && !item.properties.consequencias && !item.properties.artigo);
  assert.equal(legalResponseSchema([]).properties.referencias.maxItems, 0);
});

test('catalog has concrete candidates for other requested legal families without compulsory matching', () => {
  const cases = [
    ['racismo-2a', 'A polícia investiga ofensa racial dirigida a uma pessoa após denúncia de injúria racial.'],
    ['racismo-20', 'Uma entidade denunciou a prática de discriminação racial em estabelecimento comercial.'],
    ['eca-143', 'A reportagem divulgou nome e foto de um adolescente a quem se atribui ato infracional.'],
    ['ambiente-54', 'A empresa é investigada por poluição de um rio que causou mortandade de animais e danos à saúde.'],
    ['cdc-37', 'A empresa responde a reclamações de consumidores sobre publicidade enganosa de um produto.'],
    ['mci-7-i', 'A publicação na internet divulgou conversas privadas e expôs a intimidade de uma pessoa.'],
    ['autorais-29', 'O fotógrafo questiona o uso não autorizado de fotografia e uma reprodução sem autorização.'],
    ['resposta-2', 'Uma publicação apresenta acusação falsa contra pessoa identificada, que pediu direito de resposta por ofensa à honra.']
  ];
  for (const [id, text] of cases) assert.ok(legalCandidates(text, { now }).some(candidate => candidate.id === id), id);
});
