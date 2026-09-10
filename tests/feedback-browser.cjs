// Optional local browser QA; uses an existing Playwright installation, no package changes.
// All non-loopback requests are intercepted, never forwarded to Google/Cloudflare.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const {ROOT, harness, event} = require('./feedback-harness.cjs');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ENDPOINT = 'https://script.google.com/macros/s/local_mock_only/exec';
const RESPONSE_ORIGIN = 'https://mock-script.googleusercontent.com';
const out = process.env.FEEDBACK_SCREENSHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-browser-'));
fs.mkdirSync(out, {recursive: true});

async function main() {
  const allowed = new Set(['/consignment-note/feedback/', '/en/consignment-note/feedback/',
    '/feedback-form.js', '/feedback-config.js', '/feedback-form.css', '/utility-pages.css',
    '/favicon.ico', '/assets/brand/hiro-app-works-mark.svg']);
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!allowed.has(pathname) || req.method !== 'GET') { res.writeHead(404); res.end(); return; }
    const file = path.join(ROOT, pathname.endsWith('/') ? pathname + 'index.html' : pathname);
    const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'};
    res.setHeader('Content-Type', (types[path.extname(file)] || 'application/octet-stream') + ';charset=utf-8');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  let checks = 0;
  try {
    browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHANNEL} : {})});
    for (const locale of ['ja', 'en']) {
      for (const viewport of [{width: 1280, height: 1000}, {width: 320, height: 740}]) {
        const context = await browser.newContext({viewport, serviceWorkers: 'block'});
        const h = harness(); const requests = []; const errors = []; const unexpected = [];
        let mode = 'success'; let delay = 0; let iframeResult; let replyReady; let releaseReply;
        await context.route('**/*', async route => {
          const url = route.request().url();
          if (url === origin + '/feedback-config.js') {
            const config = mode === 'preparing' ? {endpoint: '', sitekey: '', responseOrigin: ''} :
              // Mock-only origins. Both production GAS files are loaded, with the safety gate intact.
              {endpoint: ENDPOINT, sitekey: 'mock-sitekey',
                responseOrigin: mode.startsWith('iframe-') ? RESPONSE_ORIGIN : ''};
            return route.fulfill({contentType: 'text/javascript', body: 'window.HIRO_FEEDBACK_CONFIG=' + JSON.stringify(config)});
          }
          if (url.startsWith(origin + '/')) return route.continue();
          if (url.startsWith('https://challenges.cloudflare.com/turnstile/v0/api.js')) {
            return route.fulfill({contentType: 'text/javascript', body: `
              window.turnstile={
                render(el,options){window.mockSecurityOptions=options;el.textContent='Local mock security check';setTimeout(()=>options.callback('mock-token'),0);return 'mock-widget';},
                reset(){setTimeout(()=>window.mockSecurityOptions.callback('mock-token-retry'),0);},
                remove(){document.querySelector('#feedback-security').textContent='';}
              };`
            });
          }
          if (url === ENDPOINT) {
            const raw = route.request().postData();
            const isFrame = route.request().isNavigationRequest();
            const data = isFrame ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw);
            requests.push({id: data.requestId, message: data.message, frame: isFrame});
            if (delay) await new Promise(resolve => setTimeout(resolve, delay));
            if (mode === 'network') return route.abort('failed');
            if (isFrame) {
              // Emulate HtmlService's nested frame. Only test target origin is changed;
              // production GAS continues to require its configured HTTPS parent.
              iframeResult = h.context.doPost(event(new URLSearchParams({...data, transport: 'iframe'}).toString(), 'application/x-www-form-urlencoded')).text
                .replace('"https://hiroappworks.com"', JSON.stringify(origin));
              return route.fulfill({contentType: 'text/html', body: '<!doctype html><iframe src="' + RESPONSE_ORIGIN + '/reply"></iframe>'});
            }
            let result;
            if (mode === 'verification') result = {type: 'hiro-feedback-result', requestId: data.requestId, ok: false, code: 'verification_failed'};
            else if (mode === 'unknown') result = {type: 'hiro-feedback-result', requestId: data.requestId, ok: false, code: 'result_unknown'};
            else result = h.post({...data, transport: 'fetch'});
            if (mode === 'lost-fetch' || mode.startsWith('iframe-')) return route.abort('failed');
            return route.fulfill({contentType: 'application/json', headers: {'Access-Control-Allow-Origin': origin}, body: JSON.stringify(result)});
          }
          if (url === RESPONSE_ORIGIN + '/reply') {
            if (mode === 'iframe-forged') await new Promise(resolve => { releaseReply = resolve; replyReady(); });
            return route.fulfill({contentType: 'text/html', body: iframeResult});
          }
          unexpected.push(new URL(url).origin); return route.abort();
        });
        const page = await context.newPage();
        await page.addInitScript(() => {
          window.feedbackMockMessages = [];
          window.addEventListener('message', e => {
            if (e.data && e.data.type === 'hiro-feedback-result') window.feedbackMockMessages.push({
              expectedOrigin: e.origin === 'https://mock-script.googleusercontent.com',
              frameExists: Boolean(document.querySelector('iframe')),
              ok: e.data.ok === true
            });
          });
        });
        page.on('pageerror', error => errors.push(error.message));
        // Deliberately aborted transport scenarios can produce Chromium's network
        // console errors; report separately from script/runtime errors.
        const consoleErrors = [];
        page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        const url = origin + (locale === 'en' ? '/en' : '') + '/consignment-note/feedback/';
        const label = locale + '-' + viewport.width;
        const screenshot = name => page.screenshot({path: path.join(out, label + '-' + name + '.png'), fullPage: true});
        async function open(nextMode) {
          mode = nextMode; delay = 0; await page.goto(url);
          if (mode !== 'preparing') await page.waitForFunction(() => !document.querySelector('.feedback-send').disabled);
        }
        await open('preparing');
        assert.equal(await page.locator('.feedback-send').isDisabled(), true);
        assert.equal(await page.locator('textarea').count(), 1);
        assert.equal(await page.locator('input:not([type=hidden]),select').count(), 0);
        assert.equal(await page.locator('html').getAttribute('lang'), locale);
        assert.ok(await page.locator('h1').innerText());
        assert.ok(await page.locator('a[href="' + (locale === 'en' ? '/en' : '') + '/contact/"]').count());
        assert.ok(await page.locator('a[href="' + (locale === 'en' ? '/en' : '') + '/privacy/"]').count());
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await screenshot('preparing'); checks++;

        await open('success');
        await page.locator('#feedback-message').fill(' \n ');
        await page.locator('.feedback-send').click();
        assert.equal(await page.locator('#feedback-message').getAttribute('aria-invalid'), 'true');
        assert.equal(await page.locator('#feedback-message').evaluate(el => el === document.activeElement), true);
        assert.equal(requests.length, 0); checks++;
        const text = locale === 'ja' ? '一言\n読みやすく🙂' : 'A short comment\nMore clarity 🙂';
        await page.locator('#feedback-message').fill(text);
        delay = 600;
        await page.locator('.feedback-send').click();
        assert.equal(await page.locator('.feedback-send').isDisabled(), true);
        assert.equal(await page.locator('#feedback-message').getAttribute('readonly'), '');
        await page.locator('#feedback-form').evaluate(form => form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})));
        await screenshot('sending');
        await page.locator('#feedback-success').waitFor({state: 'visible'});
        assert.equal(h.state.saved.length, 1); assert.equal(h.state.emails.length, 1); assert.equal(requests.length, 1);
        assert.equal(await page.locator('#feedback-success').evaluate(el => el === document.activeElement), true);
        assert.equal(await page.locator('#feedback-message').inputValue(), '');
        await screenshot('success'); checks++;

        await open('verification');
        await page.locator('#feedback-message').fill(text);
        await page.locator('.feedback-send').click();
        await page.locator('#feedback-error').waitFor({state: 'visible'});
        assert.equal(await page.locator('#feedback-message').inputValue(), text);
        assert.equal(h.state.saved.length, 1);
        await screenshot('verification-error'); checks++;
        // Widget error and explicit restart, independent of server validation.
        await page.evaluate(() => window.mockSecurityOptions['error-callback']());
        assert.equal(await page.locator('.feedback-send').isDisabled(), true);
        await page.locator('#feedback-retry-security').click();
        await page.waitForFunction(() => !document.querySelector('.feedback-send').disabled); checks++;

        await open('network');
        await page.locator('#feedback-message').fill(text);
        await page.locator('.feedback-send').click();
        await page.locator('#feedback-error').waitFor({state: 'visible'});
        assert.equal(await page.locator('#feedback-message').inputValue(), text);
        const retryId = requests.at(-1).id;
        await screenshot('network-error');
        mode = 'success';
        await page.locator('.feedback-send').click();
        await page.locator('#feedback-success').waitFor({state: 'visible'});
        assert.equal(requests.at(-1).id, retryId); assert.equal(h.state.saved.length, 2); checks++;

        await open('lost-fetch');
        await page.locator('#feedback-message').fill('x');
        await page.locator('.feedback-send').click();
        await page.locator('#feedback-error').waitFor({state: 'visible'});
        assert.equal(await page.locator('#feedback-message').inputValue(), 'x');
        const lostId = requests.at(-1).id;
        assert.equal(h.state.saved.length, 3);
        mode = 'success';
        await page.locator('.feedback-send').click();
        await page.locator('#feedback-success').waitFor({state: 'visible'});
        assert.equal(requests.at(-1).frame, false); assert.equal(requests.at(-1).id, lostId);
        assert.equal(h.state.saved.length, 3); assert.equal(h.state.emails.length, 3); checks++;

        await open('unknown');
        await page.locator('#feedback-message').fill(text);
        await page.locator('.feedback-send').click();
        await page.locator('#feedback-error').waitFor({state: 'visible'});
        assert.equal(await page.locator('#feedback-message').inputValue(), text);
        assert.equal(await page.locator('.feedback-send').isDisabled(), true); checks++;

        await open('success');
        await page.locator('#feedback-message').focus();
        await page.keyboard.insertText('a');
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#feedback-form a').evaluate(el => el === document.activeElement), true);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#feedback-retry-security').evaluate(el => el === document.activeElement), true);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('.feedback-send').evaluate(el => el === document.activeElement), true);
        await page.keyboard.press('Enter');
        await page.locator('#feedback-success').waitFor({state: 'visible'});
        assert.equal(h.state.saved.at(-1), 'a'); checks++;

        await open('iframe-lost');
        const savedBefore = h.state.saved.length;
        await page.locator('#feedback-message').fill(text);
        await page.locator('.feedback-send').click();
        try { await page.locator('#feedback-success').waitFor({state: 'visible'}); }
        catch (error) {
          console.log('iframe diagnostic', {requestCount: requests.length, savedCount: h.state.saved.length,
            frames: requests.filter(r => r.frame).length,
            observations: await page.evaluate(() => window.feedbackMockMessages),
            errorVisible: await page.locator('#feedback-error').isVisible(), runtimeErrors: errors.length});
          throw error;
        }
        assert.equal(requests.at(-1).frame, true);
        assert.equal(requests.at(-2).frame, false);
        assert.equal(requests.at(-1).id, requests.at(-2).id);
        assert.equal(h.state.saved.length, savedBefore + 1);
        assert.equal(h.state.emails.length, savedBefore + 1);
        await screenshot('iframe-success'); checks++;

        await open('iframe-forged');
        const pendingReply = new Promise(resolve => { replyReady = resolve; });
        await page.locator('#feedback-message').fill(text);
        await page.locator('.feedback-send').click();
        await pendingReply;
        const id = requests.at(-1).id;
        await page.evaluate(({id, responseOrigin}) => {
          const frame = document.querySelector('iframe');
          const data = {type: 'hiro-feedback-result', requestId: id, ok: true, code: 'saved'};
          const good = {data, origin: responseOrigin, source: frame.contentWindow};
          for (const bad of [{...good, origin: 'https://wrong.example.test'}, {...good, source: window},
            {...good, data: {...data, requestId: 'wrong-id'}}, {...good, data: {...data, extra: 'unexpected'}}]) {
            window.dispatchEvent(new MessageEvent('message', bad));
          }
        }, {id, responseOrigin: RESPONSE_ORIGIN});
        assert.equal(await page.locator('#feedback-success').isVisible(), false);
        assert.equal(await page.locator('#feedback-message').inputValue(), text);
        assert.equal(await page.locator('.feedback-send').isDisabled(), true);
        releaseReply();
        await page.locator('#feedback-success').waitFor({state: 'visible'});
        assert.equal(h.state.saved.length, savedBefore + 2);
        assert.equal(h.state.emails.length, savedBefore + 2); checks++;
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
        const unexpectedConsole = consoleErrors.filter(line => !line.includes('net::ERR_FAILED'));
        assert.deepEqual(unexpectedConsole, []);
        console.log(label + ': 11 scenarios passed; runtime errors 0; unexpected external requests 0; expected aborted-request console entries ' + consoleErrors.length);
        await context.close();
      }
    }
    console.log('Browser scenarios passed: ' + checks + '; screenshots: ' + out);
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
