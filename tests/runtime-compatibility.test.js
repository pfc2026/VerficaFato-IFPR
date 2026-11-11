import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { sanitizeLesson } from '../routes/admin.js';

const root = fileURLToPath(new URL('../', import.meta.url));

test('Vercel entry point loads when require() cannot load ESM dependencies', () => {
  // Reproduce the restrictive loader from the reported deployment. Importing
  // the handler must not start the HTTP server or connect to a database.
  const child = spawnSync(process.execPath, [
    '--no-experimental-require-module',
    '--input-type=module',
    '--eval',
    "const { default: handler } = await import('./api/index.js'); if (typeof handler !== 'function') throw new Error('Missing serverless handler'); console.log('handler-ready');"
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    env: {
      ...process.env,
      NODE_OPTIONS: '',
      MONGO_URI: '',
      ENABLE_AI_EXPLANATION: 'false',
      GEMINI_API_KEY: '',
      OPENAI_API_KEY: '',
      GOOGLE_API_KEY: ''
    }
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr || child.stdout);
  assert.match(child.stdout, /handler-ready/);
});

test('Vercel entry point starts with the runtime environment declared for deployment', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const child = spawnSync(process.execPath, [
    '--input-type=module', '--eval',
    "const { default: handler } = await import('./api/index.js'); if (typeof handler !== 'function') throw new Error('Missing serverless handler'); console.log('runtime-ready');"
  ], {
    cwd: root, encoding: 'utf8', timeout: 20000, windowsHide: true,
    env: { ...process.env, ...config.env, MONGO_URI: '', ENABLE_AI_EXPLANATION: 'false', GEMINI_API_KEY: '', OPENAI_API_KEY: '', GOOGLE_API_KEY: '' }
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr || child.stdout);
  assert.match(child.stdout, /runtime-ready/);
});

test('lesson sanitization remains safe after reparsing hostile HTML in a browser', async t => {
  const payloads = [
    ['textarea solidus close', '<textarea></textarea/><img src=x onerror="alert(1)">'],
    ['xmp script passthrough', '<xmp><script>alert(1)</script></xmp>'],
    ['xmp solidus close', '<xmp></xmp/><img src=x onerror="alert(1)">'],
    ['iframe fallback', '<iframe><textarea></textarea/><img src=x onerror="alert(1)"></iframe>'],
    ['nested iframe fallback', '<iframe>'.repeat(35) + '<img src=x onerror="alert(1)">'],
    ['noscript breakout', '<noscript><a title="</noscript><img src=x onerror=alert(1)>">x</a></noscript>'],
    ['SVG script and handlers', '<svg><foreignObject><p onload="alert(1)">x</p></foreignObject><script>alert(1)</script></svg>'],
    ['MathML embedded markup', '<math><annotation-xml encoding="text/html"><svg><script>alert(1)</script></svg></annotation-xml></math>'],
    ['zero-padded javascript URL', '<a href="&#0000106;avascript:alert(1)">link</a>'],
    ['control character in URL', '<a href="java&#x000A;script:alert(1)">link</a>'],
    ['relative-protocol URL', '<a href="//unsafe.example">link</a>'],
    ['style and onclick attributes', '<p style="background:url(javascript:alert(1))" onclick="alert(1)">Texto <strong>legível</strong></p>'],
    ['style raw text', '<style><img src=x onerror="alert(1)"></style>'],
    ['title solidus close', '<title></title/><img src=x onerror="alert(1)">']
  ];
  for (const [name, payload] of payloads) {
    await t.test(name, () => {
      const output = sanitizeLesson(payload);
      // jsdom uses the browser HTML parsing rules, so this catches markup that
      // only becomes executable after sanitization and a second parse.
      const dom = new JSDOM('<!doctype html><body>' + output + '</body>');
      try {
        const body = dom.window.document.body;
        const allowedTags = new Set(['H2','H3','H4','P','BR','STRONG','EM','B','I','UL','OL','LI','BLOCKQUOTE','A']);
        for (const node of body.querySelectorAll('*')) {
          assert.ok(allowedTags.has(node.tagName), output);
          for (const attribute of node.attributes) {
            assert.ok(node.tagName === 'A' && ['href','title'].includes(attribute.name), output);
          }
        }
        for (const link of body.querySelectorAll('a[href]')) {
          assert.ok(['http:', 'https:'].includes(new URL(link.href).protocol), output);
        }
      } finally { dom.window.close(); }
    });
  }
});

test('lesson sanitization preserves headings, emphasis and valid source links', () => {
  const output = sanitizeLesson('<h3>Uma aula</h3><p>Confira a <strong>fonte original</strong>: <a href="https://example.org/noticia" title="Fonte">abrir</a>.</p>');
  const dom = new JSDOM('<!doctype html><body>' + output + '</body>');
  try {
    assert.equal(dom.window.document.querySelector('h3').textContent, 'Uma aula');
    assert.equal(dom.window.document.querySelector('strong').textContent, 'fonte original');
    assert.equal(dom.window.document.querySelector('a').href, 'https://example.org/noticia');
  } finally { dom.window.close(); }
});
