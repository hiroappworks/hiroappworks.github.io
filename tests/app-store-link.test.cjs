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

// Read the actual English anchors, including their no-JS fallback and security attributes.
const englishHtml = fs.readFileSync(path.join(root, 'en/consignment-note/index.html'), 'utf8');
const enNormal = 'https://apps.apple.com/us/app/id6800209010';
const enCampaign = enNormal + '?pt=129293983&ct=ig_us_v115_p01&mt=8';
function renderEnglish(route, window = {}) {
  const anchors = [...englishHtml.matchAll(/<a\b[^>]*data-en-consignment-store-link[^>]*>/g)].map(([tag]) => {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,k,v]) => [k,v]));
    return { ...attributes };
  });
  assert.equal(anchors.length, 2);
  window.location = new URL('https://hiroappworks.com' + route);
  window.matchMedia = () => ({matches:true, addEventListener(){}});
  window.addEventListener = () => {};
  const document = {
    documentElement: {classList:{add(){}}}, querySelector: () => null,
    querySelectorAll: s => s === '[data-en-consignment-store-link]' ? anchors : [],
  };
  vm.runInNewContext(config + '\n' + script, {window, document, URLSearchParams});
  return {anchors, window};
}
const enCases = [
  ['normal', '/en/consignment-note/', false],
  ['paid', '/en/consignment-note/?src=ig_us_v115_p01', true],
  ['utm and fbclid', '/en/consignment-note/?utm_source=instagram&src=ig_us_v115_p01&fbclid=test', true],
  ['unknown', '/en/consignment-note/?src=organic', false],
  ['missing', '/en/consignment-note/?utm_source=instagram', false],
  ['empty', '/en/consignment-note/?src=', false],
  ['duplicate', '/en/consignment-note/?src=ig_us_v115_p01&src=ig_us_v115_p01', false],
  ['duplicate unknown', '/en/consignment-note/?src=ig_us_v115_p01&src=other', false],
  ['duplicate empty', '/en/consignment-note/?src=&src=ig_us_v115_p01', false],
  ['similar', '/en/consignment-note/?src=ig_us_v115_p01_extra', false],
  ['case', '/en/consignment-note/?src=IG_us_v115_p01', false],
  ['space', '/en/consignment-note/?src=%20ig_us_v115_p01', false],
  ['external', '/en/consignment-note/?src=https%3A%2F%2Fevil.example', false],
  ['JP source', '/en/consignment-note/?src=instagram_jp_paid_202610', false],
  ['untrusted tokens ignored', '/en/consignment-note/?src=ig_us_v115_p01&pt=evil&ct=evil&url=https://evil.example', true],
  ['tokens alone', '/en/consignment-note/?pt=129293983&ct=ig_us_v115_p01', false],
  ['top', '/?src=ig_us_v115_p01', false],
  ['English top', '/en/?src=ig_us_v115_p01', false],
  ['other app', '/en/playorder/?src=ig_us_v115_p01', false],
  ['subpage', '/en/consignment-note/feedback/?src=ig_us_v115_p01', false],
  ['no slash', '/en/consignment-note?src=ig_us_v115_p01', false],
  ['Japanese path', '/consignment-note/?src=ig_us_v115_p01', false],
];
for (const [name, route, paid] of enCases) {
  test('US ' + name, () => {
    const {anchors, window} = renderEnglish(route);
    assert.equal(window.location.href, 'https://hiroappworks.com' + route); // no redirect
    for (const a of anchors) {
      assert.equal(a.href, paid ? enCampaign : enNormal);
      assert.equal(a.target, '_blank');
      assert.equal(a.rel, 'noopener noreferrer');
      const u = new URL(a.href);
      assert.equal(u.origin, 'https://apps.apple.com');
      assert.deepEqual([...u.searchParams.keys()], paid ? ['pt', 'ct', 'mt'] : []);
    }
  });
}
test('US HTML keeps two normal no-JS links and isolates them from Japanese handler', () => {
  const tags = [...englishHtml.matchAll(/<a\b[^>]*data-en-consignment-store-link[^>]*>/g)];
  assert.equal(tags.length, 2);
  for (const [tag] of tags) {
    assert.ok(tag.includes('href="' + enNormal + '"'));
    assert.ok(!tag.includes('data-app-store-link'));
  }
});
test('US campaign does not survive normal navigation or persist in storage', () => {
  const window = {localStorage:{setItem(){assert.fail('storage write');}}, sessionStorage:{setItem(){assert.fail('storage write');}}};
  assert.equal(renderEnglish('/en/consignment-note/?src=ig_us_v115_p01', window).anchors[0].href, enCampaign);
  for (const route of ['/en/consignment-note/', '/en/support/', '/en/']) {
    assert.equal(renderEnglish(route, window).anchors[0].href, enNormal);
  }
});
test('Japanese page ignores US source', () => {
  const result = render('https://hiroappworks.com/consignment-note/?src=ig_us_v115_p01');
  assert.equal(result.links[0].url, result.normal);
});
