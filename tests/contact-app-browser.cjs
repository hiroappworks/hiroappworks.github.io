// Local-only contact URL/UI regression. Every external request is mocked or aborted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(__dirname, '..');
const ENDPOINT = 'https://contact-mock.invalid/submit';
const APP = 'app_consignment_note';
// Explicit suites: functionality is not evidence for keyboard operation.
const suite = process.env.CONTACT_TEST_SUITE || 'all';
assert.ok(['all', 'functionality', 'keyboard'].includes(suite));
const output = process.env.CONTACT_SCREENSHOTS || '/tmp/contact-app-browser';
const invalid = ['', '?appId=', '?appId=unknown', '?appId=app_other', '?appId=app_consignment_note&appId=app_consignment_note', '?appId=app_consignment_note&appId=', '?appId=%3Cscript%3E', '?appId=%20app_consignment_note', '?appId=%E0%A4%A'];
async function main() {
  fs.mkdirSync(output, {recursive: true});
  console.log('Suite: '+suite+'; '+(suite === 'functionality' ? 'known failing headless keyboard case NOT RUN; keyboard requirement remains unresolved' : 'keyboard assertions included'));
  const server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(ROOT, '.' + name + (name.endsWith('/') ? 'index.html' : ''));
    if (req.method !== 'GET' || !file.startsWith(ROOT + '/') || name.includes('/.') || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', ({'.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon'})[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  let browser, checks = 0, blockedAnalytics = 0;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})});
    for (const lang of ['ja','en']) for (const width of [320,1280]) {
      const ctx = await browser.newContext({viewport:{width,height:900},locale:'en-US',serviceWorkers:'block'});
      const posts = [], errors = [], unexpected = [], localFailures = [];
      let restored = false;
      await ctx.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin === origin) {
          if (url.pathname === '/site-config.js') return route.fulfill({contentType:'application/javascript',body:`window.HIRO_APP_WORKS_CONFIG={contact:{endpoint:${JSON.stringify(ENDPOINT)},turnstileSiteKey:'mock-only'}};`});
          if (url.pathname === '/contact-form.js' && restored) return route.fulfill({contentType:'application/javascript',body:`document.querySelector('#app-id').value='app_other';\n` + fs.readFileSync(path.join(ROOT,'contact-form.js'),'utf8')});
          return route.continue();
        }
        if (req.url() === ENDPOINT) {
          assert.equal(req.method(),'POST');
          posts.push(JSON.parse(req.postData()));
          return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin},body:'{"ok":true}'});
        }
        if (url.hostname === 'challenges.cloudflare.com' && url.pathname === '/turnstile/v0/api.js') return route.fulfill({contentType:'application/javascript',body:`window.turnstile={render(el,opts){el.textContent='Mock verification';setTimeout(()=>opts.callback('mock-only-token'),0);return 'mock';},reset(){}};`});
        if (url.hostname === 'static.cloudflareinsights.com' && url.pathname === '/beacon.min.js' && req.method() === 'GET' && req.resourceType() === 'script') blockedAnalytics++;
        else unexpected.push({host:url.hostname,type:req.resourceType(),method:req.method()});
        return route.abort();
      });
      const page = await ctx.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.url().startsWith(origin) && r.status()>=400)localFailures.push(r.status());});
      const base = (lang === 'en' ? '/en' : '') + '/contact/';
      const activeValue = () => page.locator('[name="appId"]').inputValue();
      const oneField = async () => assert.equal(await page.locator('[data-contact-form]').evaluate(f=>new FormData(f).getAll('appId').length),1);
      for (const query of invalid) {
        await page.goto(origin+base+query);
        assert.equal(await activeValue(),lang==='en'?'app_other':'');
        assert.equal(await page.locator('#app-id').isVisible(),lang==='ja');
        await oneField();
        assert.equal(await page.locator('[data-language-choice="en"]').getAttribute('href'),'/en/contact/');
        checks++;
      }
      // Valid initial hint; no query data is copied to either menu or language notice.
      await page.goto(origin+base+'?appId='+APP+'&email=private%40example.test&message=private');
      assert.equal(await activeValue(),APP); await oneField();
      assert.ok(await page.locator('#app-id').isVisible());
      for (const target of ['ja','en']) assert.equal(await page.locator('[data-language-choice="'+target+'"]').getAttribute('href'),(target==='en'?'/en':'')+'/contact/?appId='+APP);
      if (lang==='ja') assert.equal(await page.locator('.language-notice-link').getAttribute('href'),'/en/contact/?appId='+APP);
      if (suite !== 'functionality') {
      // macOS select: open the popup before moving/committing an option.
      // Starting focus is explicit; Shift+Tab then Tab verifies actual keyboard arrival.
      await page.locator('#app-id').focus();
      await page.keyboard.press('Shift+Tab');
      assert.notEqual(await page.evaluate(()=>document.activeElement.id),'app-id');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'app-id');
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      assert.equal(await activeValue(),'app_other');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'inquiry-type-id');
      } else {
        await page.locator('#app-id').selectOption('app_other');
        assert.equal(await activeValue(),'app_other');
      }
      assert.equal(await page.locator('[data-language-choice="ja"]').getAttribute('href'),'/contact/');
      await page.locator('#app-id').selectOption(APP);
      assert.equal(await page.locator('[data-language-choice="en"]').getAttribute('href'),'/en/contact/?appId='+APP);
      await page.screenshot({path:path.join(output,lang+'-'+width+'.png'),fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      checks++;
      // Actual language link navigation, then browser Back must preserve a manual selection.
      const other = lang==='ja'?'en':'ja';
      await page.locator('[data-language-toggle]').click();
      await page.locator('[data-language-choice="'+other+'"]').click();
      await page.waitForURL(origin+(other==='en'?'/en':'')+'/contact/?appId='+APP);
      assert.equal(await activeValue(),APP);
      await page.goBack(); await page.waitForURL(origin+base+'?appId='+APP+'&email=private%40example.test&message=private');
      assert.equal(await activeValue(),APP);
      checks++;
      // A restored value at initialization is retained; pageshow never reapplies the hint.
      restored = true;
      await page.goto(origin+base+'?appId='+APP);
      assert.equal(await activeValue(),'app_other');
      await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
      assert.equal(await activeValue(),'app_other');
      assert.equal(await page.locator('[data-language-choice="en"]').getAttribute('href'),'/en/contact/');
      restored = false; checks++;
      async function submit(query, selection, expected) {
        await page.goto(origin+base+query);
        if (selection) await page.locator('#app-id').selectOption(selection);
        await oneField();
        await page.locator('[name="inquiryTypeId"]').selectOption('usage');
        await page.locator('[name="message"]').fill('Local mock only');
        await page.locator('[name="email"]').fill('local@example.test');
        await page.locator('[data-submit-button]').click();
        await page.waitForURL(origin+(lang==='en'?'/en':'')+'/contact/thanks/');
        assert.equal(posts.at(-1).appId,expected);
        assert.equal(posts.at(-1).locale,lang);
        assert.equal(posts.at(-1).message,'Local mock only');
        checks++;
      }
      await submit('?appId='+APP,null,APP);
      await submit('?appId='+APP,'app_other','app_other');
      await submit('',lang==='ja'?'app_other':null,'app_other');
      assert.equal(posts.length,3);
      assert.deepEqual(errors,[]); assert.deepEqual(unexpected,[]); assert.deepEqual(localFailures,[]);
      console.log(lang+'-'+width+': normal/invalid, hint, '+(suite === 'functionality' ? 'selectOption/layout (not keyboard)' : 'keyboard/layout')+', language, restored state, 3 mock submissions passed; runtime/unexpected external/local failures 0');
      await ctx.close();
    }
    for(const file of ['consignment-note/feedback/index.html','en/consignment-note/feedback/index.html']) {
      const html=fs.readFileSync(path.join(ROOT,file),'utf8');
      const links=[...html.matchAll(/href="([^\"]*\/contact\/[^\"]*)"/g)].map(x=>x[1]);
      assert.equal(links.length,3);
      assert.ok(links.every(x=>x===(file.startsWith('en/')?'/en':'')+'/contact/?appId='+APP));checks++;
    }
    console.log('Selected suite '+suite+' checks passed: '+checks+'; mock submissions: 12; real submissions: 0; existing Analytics requests aborted: '+blockedAnalytics);
  } finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));console.log('browser and server closed'); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
