const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const config = fs.readFileSync(path.join(root, 'site-config.js'), 'utf8');
const campaign = 'https://apps.apple.com/app/apple-store/id6800209010?pt=129293983&ct=instagram_jp_paid_202610&mt=8';

function render(url, window = {}) {
  const links = Array.from({ length: 2 }, () => ({
    writes: 0,
    set href(value) { this.url = value; this.writes++; },
    classList: { remove(value) { assert.equal(value, 'is-disabled'); } },
    removeAttribute(value) { assert.equal(value, 'aria-disabled'); },
  }));
  window.location = new URL(url);
  window.matchMedia = () => ({ matches: true, addEventListener() {} });
  window.addEventListener = () => {};
  const document = {
    documentElement: { classList: { add() {} } },
    querySelector: () => null,
    querySelectorAll: selector => selector === '[data-app-store-link]' ? links : [],
  };
  const context = vm.createContext({ window, document, URLSearchParams });
  vm.runInContext(config, context);
  vm.runInContext(script, context);
  return { links, window, normal: window.HIRO_APP_WORKS_CONFIG.apps.consignmentNote.appStoreUrl };
}

const cases = [
  ['normal', '/consignment-note/', false],
  ['paid', '/consignment-note/?src=instagram_jp_paid_202610', true],
  ['other parameters', '/consignment-note/?utm_source=instagram&src=instagram_jp_paid_202610&fbclid=test', true],
  ['src absent', '/consignment-note/?utm_source=instagram', false],
  ['empty', '/consignment-note/?src=', false],
  ['unknown', '/consignment-note/?src=organic', false],
  ['similar', '/consignment-note/?src=instagram_jp_paid_202610_extra', false],
  ['case differs', '/consignment-note/?src=Instagram_jp_paid_202610', false],
  ['duplicate matching', '/consignment-note/?src=instagram_jp_paid_202610&src=instagram_jp_paid_202610', false],
  ['duplicate empty first', '/consignment-note/?src=&src=instagram_jp_paid_202610', false],
  ['duplicate unknown last', '/consignment-note/?src=instagram_jp_paid_202610&src=organic', false],
  ['top', '/?src=instagram_jp_paid_202610', false],
  ['English', '/en/consignment-note/?src=instagram_jp_paid_202610', false],
  ['subpage', '/consignment-note/feedback/?src=instagram_jp_paid_202610', false],
  ['similar path', '/consignment-note-extra/?src=instagram_jp_paid_202610', false],
  ['no slash before redirect', '/consignment-note?src=instagram_jp_paid_202610', false],
  ['arbitrary destination', '/consignment-note/?src=https%3A%2F%2Fevil.example', false],
];

for (const [name, route, paid] of cases) {
  test(name + ': all buttons use only the permitted URL', () => {
    const result = render('https://hiroappworks.com' + route);
    for (const link of result.links) {
      assert.equal(link.url, paid ? campaign : result.normal);
      assert.equal(link.writes, 1);
      assert.equal(link.target, '_blank');
      assert.equal(link.rel, 'noopener noreferrer');
    }
    if (paid) assert.equal(new URL(result.links[0].url).searchParams.has('fbclid'), false);
    assert.equal(result.window.HIRO_APP_WORKS_CONFIG.apps.consignmentNote.appStoreUrl, result.normal);
  });
}

test('paid visit does not persist into normal navigation or reload', () => {
  const paid = render('https://hiroappworks.com/consignment-note/?src=instagram_jp_paid_202610');
  assert.equal(paid.links[0].url, campaign);
  for (let i = 0; i < 2; i++) {
    const normal = render('https://hiroappworks.com/consignment-note/', paid.window);
    assert.equal(normal.links[0].url, normal.normal);
  }
});
