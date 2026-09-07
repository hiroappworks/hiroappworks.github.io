const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const {ROOT, GAS, SETUP, harness, input, event} = require('./feedback-harness.cjs');
const client = require('../feedback-form.js');

for (const [name, text, locale] of [
  ['Japanese', '便利です', 'ja'], ['English', 'Please simplify this', 'en'], ['one character', 'あ', 'ja'],
  ['newlines and emoji', '一行目\n二行目🙂！', 'ja'], ['boundary 5000', 'a'.repeat(5000), 'en'],
  ['outer whitespace only removed', ' \n 本文\n原文 🙂 \n', 'ja']
]) test('save: ' + name, () => {
  const h = harness(); const data = input({message: text, locale});
  const result = h.post(data);
  assert.equal(result.ok, true); assert.equal(h.state.saved[0], text.trim());
  assert.equal(h.state.emails.length, 1); assert.deepEqual(h.state.opened, ['local_mock_form']);
  assert.equal(h.state.emails[0].to, 'operator@example.test');
  assert.equal(h.state.emails[0].body.includes(text.trim()), false);
  assert.deepEqual(Object.keys(result).sort(), ['code', 'ok', 'requestId', 'type']);
});

for (const [name, overrides] of [
  ['empty', {message: ''}], ['whitespace', {message: ' \n\t'}], ['over limit', {message: 'a'.repeat(5001)}],
  ['padded over limit', {message: ' '.repeat(5000) + 'x'}], ['number', {message: 1}], ['null', {message: null}],
  ['array', {message: []}], ['unknown', {email: 'fake@example.test'}], ['locale', {locale: 'fr'}],
  ['token missing', {turnstileToken: undefined}], ['blank token', {turnstileToken: ' '}],
  ['long token', {turnstileToken: 'a'.repeat(2049)}], ['honeypot', {honeypot: 'bot'}],
  ['bad id', {requestId: 'not-an-id'}], ['overlong id', {requestId: 'x'.repeat(100)}],
  ['bad transport', {transport: 'jsonp'}], ['client form id', {formId: 'other'}],
  ['notification target', {to: 'another@example.test'}], ['missing locale', {locale: undefined}]
]) test('reject: ' + name, () => {
  const h = harness(); assert.equal(h.post(input(overrides)).ok, false);
  assert.equal(h.state.saved.length, 0); assert.equal(h.state.verification, 0); assert.equal(h.state.emails.length, 0);
});

for (const raw of ['[]', 'null', '{', '{"message":"x",}', '{"message":"x","message":"y"}',
  '{"message":"x","messa\\u0067e":"y"}', '{"message":{}}', '{"message":true}', '{"__proto__":"x"}',
  '{"message":"unescaped\nnewline"}']) test('reject malformed JSON ' + raw.slice(0, 36), () => {
  const h = harness(); assert.equal(JSON.parse(h.context.doPost(event(raw)).text).ok, false);
  assert.equal(h.state.saved.length, 0);
});
test('escaped JSON and form-urlencoded preserve original text', () => {
  const data = input({message: '<script>"\\/\n🙂\t</script>'});
  for (const kind of ['text/plain', 'application/json', 'application/x-www-form-urlencoded']) {
    const h = harness(); const raw = kind.includes('urlencoded') ? new URLSearchParams(data).toString() : JSON.stringify(data);
    assert.equal(JSON.parse(h.context.doPost(event(raw, kind)).text).ok, true);
    assert.equal(h.state.saved[0], data.message);
  }
});
test('duplicate/invalid encoded parameters and query reject', () => {
  for (const raw of ['message=x&message=y', 'message=%FF', 'message=x&', 'message']) {
    assert.equal(JSON.parse(harness().context.doPost(event(raw, 'application/x-www-form-urlencoded')).text).ok, false);
  }
  const e = event(input()); e.queryString = 'message=private';
  assert.equal(JSON.parse(harness().context.doPost(e).text).ok, false);
});
test('oversized whole request and unsupported MIME reject', () => {
  const h = harness(); const e = event(input()); e.postData.length = 100001;
  assert.equal(JSON.parse(h.context.doPost(e).text).ok, false);
  assert.equal(JSON.parse(h.context.doPost(event(' '.repeat(100001))).text).ok, false);
  assert.equal(JSON.parse(h.context.doPost(event(input(), 'text/html')).text).ok, false);
});
for (const key of ['FEEDBACK_FORM_ID', 'FEEDBACK_ITEM_ID', 'FEEDBACK_TURNSTILE_SECRET',
  'FEEDBACK_NOTIFICATION_EMAIL', 'FEEDBACK_ALLOWED_HOSTNAMES', 'FEEDBACK_PARENT_ORIGIN']) {
  test('fail closed missing ' + key, () => {
    const h = harness({properties: {[key]: ''}}); assert.equal(h.post(input()).ok, false);
    assert.equal(h.state.verification, 0); assert.equal(h.state.saved.length, 0);
  });
}
for (const [name, options] of [
  ['expired token', {verification: {success: false, 'error-codes': ['timeout-or-duplicate']}}],
  ['false', {verification: {success: false}}], ['string success', {verification: {success: 'true', hostname: 'hiroappworks.com', action: 'feedback'}}],
  ['hostname', {verification: {success: true, hostname: 'evil.example', action: 'feedback'}}],
  ['suffix hostname', {verification: {success: true, hostname: 'hiroappworks.com.evil.test', action: 'feedback'}}],
  ['action', {verification: {success: true, hostname: 'hiroappworks.com', action: 'contact'}}],
  ['fetch throws', {verifyThrows: true}], ['HTTP failure', {verifyStatus: 500}], ['bad JSON', {badVerifyJson: true}]
]) test('Turnstile ' + name, () => {
  const h = harness(options); assert.equal(h.post(input()).code, 'verification_failed');
  assert.equal(h.state.saved.length, 0); assert.equal(h.state.emails.length, 0);
});
for (const option of ['wrongId', 'wrongType', 'optional', 'twoItems', 'collectsEmail', 'closed']) {
  test('form structure fails safely: ' + option, () => {
    const h = harness({[option]: true}); assert.equal(h.post(input()).code, 'unavailable');
    assert.equal(h.state.saved.length, 0); assert.equal(h.state.emails.length, 0);
  });
}
test('submit failure is ambiguous, never success or notification; retry never adds', () => {
  const h = harness({saveFails: true}); const data = input();
  assert.equal(h.post(data).code, 'result_unknown'); assert.equal(h.post(data).code, 'result_unknown');
  assert.equal(h.state.saved.length, 0); assert.equal(h.state.emails.length, 0); assert.equal(h.state.verification, 1);
});
test('notification failure leaves accepted success; retry does not notify', () => {
  const h = harness({mailFails: true}); const data = input();
  assert.equal(h.post(data).ok, true); assert.equal(h.post(data).ok, true);
  assert.equal(h.state.saved.length, 1); assert.deepEqual(h.state.logs, ['feedback_notification_failed']);
});
test('accepted record write failure after save returns success, pending retry stops', () => {
  const h = harness({receiptWriteFails: true}); const data = input();
  assert.equal(h.post(data).ok, true); assert.equal(h.post(data).code, 'result_unknown');
  assert.equal(h.state.saved.length, 1); assert.equal(h.state.emails.length, 0);
});
test('accepted retry never redeems spent token or duplicates notification', () => {
  const h = harness(); const data = input();
  for (let i = 0; i < 5; i++) assert.equal(h.post(data).ok, true);
  assert.equal(h.state.saved.length, 1); assert.equal(h.state.emails.length, 1); assert.equal(h.state.verification, 1);
  const receipt = JSON.parse(h.values['FB_RECEIPT_' + data.requestId]);
  assert.deepEqual(Object.keys(receipt).sort(), ['fingerprint', 'state', 'time']);
  assert.equal(JSON.stringify(receipt).includes(data.message), false);
});
test('same id with changed text or locale conflicts', () => {
  const h = harness(); const data = input(); h.post(data);
  assert.equal(h.post({...data, message: 'different'}).code, 'conflict');
  assert.equal(h.post({...data, locale: 'en'}).code, 'conflict'); assert.equal(h.state.saved.length, 1);
});
test('lock contention performs no side effects and can retry', () => {
  const h = harness(); const data = input(); h.state.held = true;
  assert.equal(h.post(data).code, 'busy'); assert.equal(h.state.verification, 0);
  h.state.held = false; assert.equal(h.post(data).ok, true); assert.equal(h.state.held, false);
});
test('retention removes only expired receipts, never setup keys', () => {
  const h = harness(); const data = input(); h.post(data);
  const key = 'FB_RECEIPT_' + data.requestId;
  const value = JSON.parse(h.values[key]); value.time = Date.now() - 86400001;
  h.values[key] = JSON.stringify(value);
  h.context.fbPruneReceipts_(h.props, Date.now());
  assert.equal(h.values[key], undefined); assert.equal(h.values.FEEDBACK_FORM_ID, 'local_mock_form');
});
test('capacity and corrupt receipts fail closed without erasing them', () => {
  const h = harness();
  for (let i = 0; i < 1000; i++) h.values['FB_RECEIPT_' + i] = JSON.stringify({time: Date.now(), state: 'accepted', fingerprint: '0'.repeat(64)});
  assert.equal(h.post(input()).code, 'busy'); assert.equal(h.state.verification, 0);
  h.values.FB_RECEIPT_bad = 'corrupt';
  assert.equal(h.post(input()).code, 'unavailable'); assert.equal(h.values.FB_RECEIPT_bad, 'corrupt');
});
test('GET and results do not expose settings, responses, body or management link', () => {
  const h = harness(); assert.deepEqual(JSON.parse(h.context.doGet().text), {ok: false, code: 'method_not_allowed'});
  const data = input({message: '</script><script>alert(1)</script>', transport: 'iframe'});
  const html = h.context.doPost(event(new URLSearchParams(data).toString(), 'application/x-www-form-urlencoded')).text;
  for (const sensitive of [data.message, 'mock-only-secret', 'local_mock_form', 'operator@example.test', 'edit#responses']) assert.equal(html.includes(sensitive), false);
  assert.match(html, /window.top.postMessage/); assert.match(html, /https:\/\/hiroappworks.com/);
});
test('missing parent origin cannot broadcast results to wildcard', () => {
  const h = harness({properties: {FEEDBACK_PARENT_ORIGIN: ''}});
  const html = h.context.doPost(event(input({transport: 'iframe'}))).text;
  assert.equal(html.includes('postMessage'), false); assert.equal(h.state.saved.length, 0);
});
test('public management fixture blocks HtmlService before iframe save', () => {
  const h = harness({publicManagement: 'setupFeedbackForm'});
  const reply = h.context.doPost(event(input({transport: 'iframe'}))).text;
  assert.equal(JSON.parse(reply).code, 'unavailable');
  assert.equal(reply.includes('<script>'), false);
  assert.equal(h.state.saved.length, 0); assert.equal(h.state.verification, 0);
  assert.equal(h.context.fbIframeSafe_(), false);
});
test('new GAS helper entry points are private to google.script.run', () => {
  const names = [...GAS.matchAll(/^function\s+(\w+)\(/gm)].map(m => m[1]);
  assert.deepEqual(names.filter(name => !name.endsWith('_')).sort(), ['doGet', 'doPost']);
});
test('immutable input and frontend request id lifecycle', () => {
  const h = harness(); const data = input(); const before = JSON.stringify(data);
  h.context.fbReceive_(data); assert.equal(JSON.stringify(data), before);
  const get = client.newSubmission(crypto.randomUUID); const first = get('本文', 'ja');
  assert.equal(get('本文', 'ja').requestId, first.requestId);
  assert.notEqual(get('別の本文', 'ja').requestId, first.requestId);
});
test('lost fetch response -> iframe fallback reuses request, one save and notification', async () => {
  const h = harness(); const data = input(); const ids = [];
  const result = await client.acknowledgedSend(data, async payload => {
    ids.push(payload.requestId); h.post(payload); throw new Error('CORS response lost');
  }, async payload => { ids.push(payload.requestId); return h.iframe(payload); });
  assert.equal(result.ok, true); assert.deepEqual(ids, [data.requestId, data.requestId]);
  assert.equal(h.state.saved.length, 1); assert.equal(h.state.emails.length, 1);
});
test('explicit failure is not retried using a different transport', async () => {
  let fallback = 0; const data = input();
  const result = await client.acknowledgedSend(data, async () => ({type: 'hiro-feedback-result', requestId: data.requestId, ok: false, code: 'verification_failed'}), async () => fallback++);
  assert.equal(result.ok, false); assert.equal(fallback, 0);
});
test('unconfirmed responses never succeed', async () => {
  const data = input();
  await assert.rejects(client.acknowledgedSend(data, async () => ({ok: true}), null));
  await assert.rejects(client.acknowledgedSend(data, async () => { throw 0; }, async () => ({ok: true})));
});
test('postMessage requires exact origin, target frame ancestry, request id and schema', () => {
  const frame = {}; frame.parent = frame;
  const child = {parent: frame}; const stranger = {}; stranger.parent = stranger;
  const id = crypto.randomUUID(); const origin = 'https://mock-script.googleusercontent.com';
  const data = {type: 'hiro-feedback-result', requestId: id, ok: true, code: 'saved'};
  const good = {source: child, origin, data};
  assert.equal(client.trustedMessage(good, frame, origin, id), true);
  for (const bad of [{...good, origin: 'https://evil.test'}, {...good, source: stranger}, {...good, source: null},
    {...good, data: {...data, requestId: crypto.randomUUID()}}, {...good, data: {...data, body: 'leak'}},
    {...good, data: {...data, ok: 'true'}}, {...good, data: {...data, code: 'unavailable'}}]) {
    assert.equal(client.trustedMessage(bad, frame, origin, id), false);
  }
});
test('setup and receiver globals coexist, receiver has no setup/create/delete/trigger API', () => {
  const h = harness(); assert.equal(typeof h.context.setupFeedbackForm_, 'function');
  for (const forbidden of ['FormApp.create(', 'addParagraphTextItem(', 'deleteResponse(', 'setupFeedbackForm(', 'saveQaResponsesOnce(',
    'setupFeedbackForm_(', 'verifyFeedbackForm_(', 'saveQaResponsesOnce_(', 'newTrigger(', 'eval(', 'new Function(']) assert.equal(GAS.includes(forbidden), false);
  // Prove that management logic is byte-for-byte the baseline after reversing ONLY the approved renames.
  const normalized = SETUP.replace(/\b(setupFeedbackForm|verifyFeedbackForm|saveQaResponsesOnce)_\b/g, '$1');
  assert.equal(crypto.createHash('sha256').update(normalized).digest('hex'), 'c3c6bf649e2174678554afe79c353172fa714b955df02cd9a8e458c8e6ea3078');
});

function publicFunctions(context) {
  return Object.keys(context).filter(name => typeof context[name] === 'function' && !name.endsWith('_')).sort();
}
test('all deployment gs files share one global; only doGet/doPost are public, no aliases', () => {
  assert.deepEqual(fs.readdirSync(path.join(ROOT, 'gas/feedback-form')).filter(name => name.endsWith('.gs')).sort(), ['Code.gs', 'Setup.gs']);
  const h = harness(); assert.deepEqual(publicFunctions(h.context), ['doGet', 'doPost']);
  for (const name of ['setupFeedbackForm', 'verifyFeedbackForm', 'saveQaResponsesOnce']) {
    assert.equal(typeof h.context[name], 'undefined'); assert.equal(typeof h.context[name + '_'], 'function');
  }
  assert.equal(h.context.fbIframeSafe_(), true);
});
for (const name of ['verifyFeedbackForm', 'saveQaResponsesOnce']) test('restored public name gate: ' + name, () => {
  const h = harness({publicManagement: name});
  assert.equal(JSON.parse(h.context.doPost(event(input({transport: 'iframe'}))).text).code, 'unavailable');
  assert.equal(h.state.saved.length, 0); assert.equal(h.state.verification, 0);
});
test('public alias or wrapper under another name fails deployment public-surface audit', () => {
  const h = harness();
  h.context.publicRun = h.context.setupFeedbackForm_;
  assert.notDeepEqual(publicFunctions(h.context), ['doGet', 'doPost']);
  h.context.publicRun = () => h.context.saveQaResponsesOnce_();
  assert.notDeepEqual(publicFunctions(h.context), ['doGet', 'doPost']);
  assert.equal(h.state.saved.length, 0);
});
for (const name of ['setupFeedbackForm_', 'verifyFeedbackForm_', 'saveQaResponsesOnce_']) test('POST cannot dispatch management: ' + name, () => {
  const h = harness();
  for (const key of ['action', 'function', 'method']) assert.equal(h.post(input({[key]: name})).code, 'invalid_input');
  assert.equal(h.state.opened.length, 0); assert.equal(h.state.verification, 0); assert.equal(h.state.saved.length, 0);
});
test('private setup reuses completed form/item and preserves reported owner/editor settings', () => {
  const h = harness({management: true, properties: {FEEDBACK_SETUP_COMPLETE: 'true'}});
  for (let i = 0; i < 2; i++) {
    const result = h.context.setupFeedbackForm_();
    assert.equal(result.formId, 'local_mock_form'); assert.equal(result.itemId, 42);
    assert.equal(result.questions, 1); assert.equal(result.editorsReported, 1); assert.equal(result.published, true);
  }
  assert.equal(h.state.created, 0); assert.equal(h.state.added, 0); assert.equal(h.state.titleWrites, 0);
  assert.equal(h.values.FEEDBACK_FORM_ID, 'local_mock_form'); assert.equal(h.values.FEEDBACK_ITEM_ID, '42');
});
test('private setup only repairs empty title, does not overwrite an unexpected title', () => {
  const empty = harness({management: true, formSettings: {Title: ''}});
  empty.context.setupFeedbackForm_(); empty.context.setupFeedbackForm_();
  assert.equal(empty.state.titleWrites, 1); assert.equal(empty.state.created, 0); assert.equal(empty.state.added, 0);
  const wrong = harness({management: true, formSettings: {Title: 'Unrelated mock form'}});
  assert.throws(() => wrong.context.setupFeedbackForm_(), /Unexpected form title/);
  assert.equal(wrong.state.titleWrites, 0);
});
test('private QA rerun and partially lost response receipt reuse same two mock answers', () => {
  const h = harness({management: true, properties: {FEEDBACK_SETUP_COMPLETE: 'true'}});
  h.context.saveQaResponsesOnce_(); h.context.saveQaResponsesOnce_();
  assert.equal(h.state.saved.length, 2);
  const marker = h.values.FEEDBACK_QA_MARKER;
  delete h.values.FEEDBACK_QA_RESPONSE_JA;
  h.context.saveQaResponsesOnce_();
  assert.equal(h.state.saved.length, 2); assert.equal(h.values.FEEDBACK_QA_MARKER, marker);
  assert.equal(h.state.created, 0); assert.equal(h.state.added, 0); assert.equal(h.state.emails.length, 0);
});
test('private setup interrupted creation marker still prevents another form', () => {
  const h = harness({management: true, properties: {FEEDBACK_FORM_ID: '', FEEDBACK_CREATION_STARTED: 'mock-start'}});
  assert.throws(() => h.context.setupFeedbackForm_(), /Creation interrupted/); assert.equal(h.state.created, 0);
});
test('private Setup coexists with successful iframe save and safe response', () => {
  const h = harness(); const data = input(); const result = h.iframe(data);
  assert.equal(result.ok, true); assert.equal(client.validResult(result, data.requestId), true);
  assert.equal(h.state.saved.length, 1); assert.equal(h.state.emails.length, 1);
});
test('native iframe CRLF matches original fetch LF at 5000 code units without duplicate save', () => {
  const h = harness(); const message = 'a\n'.repeat(2499) + '🙂';
  assert.equal(message.length, 5000);
  const data = input({message}); assert.equal(h.post(data).ok, true);
  assert.equal(h.iframe({...data, message: message.replace(/\n/g, '\r\n')}).ok, true);
  assert.equal(h.state.saved.length, 1); assert.equal(h.state.saved[0], message);
  assert.equal(h.state.emails.length, 1); assert.equal(h.state.verification, 1);
});
test('first native iframe save restores textarea LF, keeps emoji, rejects actual over-limit text', () => {
  const h = harness(); const data = input({message: '一行目\r\n二行目🙂'});
  assert.equal(h.iframe(data).ok, true); assert.equal(h.state.saved[0], '一行目\n二行目🙂');
  const over = input({message: 'a\r\n'.repeat(2500) + 'x', transport: 'iframe'});
  const raw = event(new URLSearchParams(over).toString(), 'application/x-www-form-urlencoded');
  assert.equal(JSON.parse(h.context.doPost(raw).text).code, 'invalid_input');
  assert.equal(h.state.saved.length, 1);
});
for (const verification of [{success: false}, {success: true, hostname: 'wrong.test', action: 'feedback'},
  {success: true, hostname: 'hiroappworks.com', action: 'contact'}]) test('iframe fails closed on Siteverify mismatch ' + JSON.stringify(verification), () => {
  const h = harness({verification}); assert.equal(h.iframe(input()).code, 'verification_failed');
  assert.equal(h.state.saved.length, 0); assert.equal(h.state.emails.length, 0);
});
test('iframe save uncertainty and notification failure retain existing semantics', () => {
  const failed = harness({saveFails: true}); const data = input();
  assert.equal(failed.iframe(data).code, 'result_unknown'); assert.equal(failed.iframe(data).ok, false);
  assert.equal(failed.state.emails.length, 0);
  const mail = harness({mailFails: true});
  assert.equal(mail.iframe(data).ok, true); assert.equal(mail.iframe(data).ok, true);
  assert.equal(mail.state.saved.length, 1); assert.deepEqual(mail.state.logs, ['feedback_notification_failed']);
});
test('existing contact sources/settings unchanged', () => {
  const baseline = {
    'contact-form.js': '007eeb0175c376ab1c7255991b5f65989b7657f370a4e3d7f18286764e884af5',
    'site-config.js': '36380dd05bf11be016c2f169c48dd4887df1994caf5bd962aa3d63a53f0e4cc8',
    'gas/contact-form/Code.gs': '0a6c0f83889462b0763995128d764121b59ce5a68957a77b3ad55494f911ed57'
  };
  for (const [file, hash] of Object.entries(baseline)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex'), hash);
});
test('production config empty; pages have only one user field and no analytics scripts', () => {
  const vm = require('node:vm'); const context = {window: {}};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'feedback-config.js'), 'utf8'), context);
  assert.equal(context.window.HIRO_FEEDBACK_CONFIG.endpoint, ''); assert.equal(context.window.HIRO_FEEDBACK_CONFIG.sitekey, '');
  for (const file of ['consignment-note/feedback/index.html', 'en/consignment-note/feedback/index.html']) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.equal((html.match(/<textarea\b/g) || []).length, 1);
    assert.equal(/<input(?![^>]*type="hidden")/.test(html), false);
    assert.equal(/beacon|posthog|google-analytics|site-config\.js|contact-form\.js|language\.js/.test(html), false);
  }
});
