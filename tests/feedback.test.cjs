const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const {ROOT, GAS, SETUP, harness, input, event} = require('./feedback-harness.cjs');
const client = require('../feedback-form.js');

const diagOn = () => ({FEEDBACK_SITEVERIFY_DIAGNOSTICS_ENABLED: 'true',
  FEEDBACK_SITEVERIFY_DIAGNOSTICS_UNTIL: new Date(Date.now() + 1800000).toISOString()});
const diagnosticLogs = h => h.state.logs.filter(s => s.startsWith('{')).map(s => JSON.parse(s));
const diagnosticWrites = h => h.state.diagnosticWrites.map(s => JSON.parse(s));
test('fixed empty-request probe is time-limited, rejected, and has no service side effects', () => {
  for (const properties of [{}, {...diagOn(), FEEDBACK_SITEVERIFY_DIAGNOSTICS_ENABLED: 'false'},
    {...diagOn(), FEEDBACK_SITEVERIFY_DIAGNOSTICS_UNTIL: 'invalid'},
    {...diagOn(), FEEDBACK_SITEVERIFY_DIAGNOSTICS_UNTIL: '2020-01-01T00:00:00Z'}, diagOn()]) {
    const h = harness({properties});
    const result = JSON.parse(h.context.doPost({postData: {contents: '{}', type: 'text/plain', length: 2}}).text);
    assert.deepEqual(result, {type: 'hiro-feedback-result', requestId: '', ok: false, code: 'invalid_input'});
    const enabled = properties.FEEDBACK_SITEVERIFY_DIAGNOSTICS_ENABLED === 'true' &&
      Date.parse(properties.FEEDBACK_SITEVERIFY_DIAGNOSTICS_UNTIL) > Date.now();
    assert.deepEqual(h.state.logs, enabled ? ['feedback_diagnostic_probe_v1'] : []);
    assert.equal(h.state.verification, 0); assert.equal(h.state.opened.length, 0);
    assert.equal(h.state.saved.length, 0); assert.equal(h.state.emails.length, 0);
    assert.equal(h.state.created, 0); assert.equal(h.state.locks, 0);
  }
});
test('probe cannot log arbitrary client strings or accept different requests', () => {
  for (const e of [{postData: {contents: '{"probe":"synthetic-private"}', type: 'text/plain'}},
    {queryString: 'probe', postData: {contents: '{}', type: 'text/plain'}},
    {postData: {contents: '{}', type: 'application/x-www-form-urlencoded'}}]) {
    const h = harness({properties: diagOn()});
    assert.equal(JSON.parse(h.context.doPost(e).text).code, 'invalid_input');
    assert.deepEqual(h.state.logs, []); assert.equal(h.state.verification, 0);
  }
});
test('probe read, console, and helper failures leave rejection unchanged', () => {
  for (const option of ['diagReadThrows', 'diagConsoleThrows', 'helperThrows']) {
    const h = harness({properties: diagOn(), [option]: true});
    if (option === 'helperThrows') h.context.fbSiteverifyDiagnostic_ = () => { throw new Error('synthetic-private'); };
    assert.equal(JSON.parse(h.context.doPost({postData: {contents: '{}', type: 'application/json'}}).text).code, 'invalid_input');
    assert.deepEqual(h.state.logs, []); assert.equal(h.state.verification, 0);
    assert.equal(h.state.saved.length, 0); assert.equal(h.state.emails.length, 0);
  }
});
for (const [name, properties] of [
  ['absent', {}], ['false', {...diagOn(), FEEDBACK_SITEVERIFY_DIAGNOSTICS_ENABLED: 'false'}],
  ['boolean', {...diagOn(), FEEDBACK_SITEVERIFY_DIAGNOSTICS_ENABLED: true}],
  ['uppercase', {...diagOn(), FEEDBACK_SITEVERIFY_DIAGNOSTICS_ENABLED: 'TRUE'}],
  ['missing deadline', {FEEDBACK_SITEVERIFY_DIAGNOSTICS_ENABLED: 'true'}],
  ['expired', {...diagOn(), FEEDBACK_SITEVERIFY_DIAGNOSTICS_UNTIL: '2020-01-01T00:00:00Z'}],
  ['invalid', {...diagOn(), FEEDBACK_SITEVERIFY_DIAGNOSTICS_UNTIL: 'invalid'}],
  ['no timezone', {...diagOn(), FEEDBACK_SITEVERIFY_DIAGNOSTICS_UNTIL: '2099-01-01T00:00:00'}],
  ['invalid calendar', {...diagOn(), FEEDBACK_SITEVERIFY_DIAGNOSTICS_UNTIL: '2099-02-30T00:00:00Z'}]
]) test('diagnostics disabled: ' + name, () => {
  const h = harness({properties}); assert.equal(h.post(input()).ok, true);
  assert.deepEqual(diagnosticLogs(h), []); assert.deepEqual(diagnosticWrites(h), []);
  assert.equal(h.values.FEEDBACK_SITEVERIFY_DIAGNOSTIC_LAST, undefined);
  assert.equal(h.state.verification, 1);
});
const diagCases = [
  ['request_exception', {verifyThrows: true}, null, null, null, null, null],
  ['http_failure', {verifyStatus: 503}, 503, null, null, null, null],
  ['json_failure', {badVerifyJson: true}, 200, false, null, null, null],
  ['cloudflare_rejected', {verification: {success: false, 'error-codes': ['timeout-or-duplicate']}}, 200, true, false, null, null],
  ['action_mismatch', {verification: {success: true, action: 'synthetic-private-action', hostname: 'hiroappworks.com'}}, 200, true, true, false, null],
  ['hostname_mismatch', {verification: {success: true, action: 'feedback', hostname: 'synthetic-private-host'}}, 200, true, true, true, false],
  ['verified', {}, 200, true, true, true, true]
];
for (const [stage, options, status, jsonOk, success, action, hostname] of diagCases) {
  test('diagnostics stage and unchanged response: ' + stage, () => {
    const data = input(); const off = harness(options), on = harness({...options, properties: diagOn()});
    assert.deepEqual(on.post(data), off.post(data));
    const logs = diagnosticLogs(on); assert.equal(logs.length, 2);
    const writes = diagnosticWrites(on); assert.equal(writes.length, 2);
    assert.deepEqual(logs.map(x => x.stage), ['started', stage]);
    assert.deepEqual(writes.map(x => x.stage), ['started', stage]);
    assert.deepEqual(writes[0], {marker: 'feedback_siteverify_diag_v2', stage: 'started', httpStatus: null,
      success: null, errorCodes: [], unknownErrorCode: false, actionMatch: null, hostnameMatch: null,
      transport: 'fetch', at: writes[0].at});
    assert.match(writes[0].at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(writes[1].httpStatus, status); assert.equal(writes[1].success, success);
    assert.equal(writes[1].actionMatch, action); assert.equal(writes[1].hostnameMatch, hostname);
    assert.equal(writes[1].transport, 'fetch'); assert.match(writes[1].at, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(logs[0], {marker: 'feedback_siteverify_diag_v1', stage: 'started', transport: 'fetch',
      http_status: null, json_ok: null, success_strict: null, action_matches: null, hostname_matches: null,
      error_codes: [], unknown_error_code: false});
    assert.equal(logs[1].http_status, status); assert.equal(logs[1].json_ok, jsonOk);
    assert.equal(logs[1].success_strict, success); assert.equal(logs[1].action_matches, action);
    assert.equal(logs[1].hostname_matches, hostname);
    assert.equal(on.state.verification, 1); assert.equal(off.state.verification, 1);
    assert.deepEqual(on.state.saved, off.state.saved);
    // Separate VM realms have different Object prototypes; compare full mail contents.
    assert.deepEqual(JSON.parse(JSON.stringify(on.state.emails)), JSON.parse(JSON.stringify(off.state.emails)));
    if (stage !== 'verified') { assert.equal(on.state.saved.length, 0); assert.equal(on.state.emails.length, 0); }
    assert.equal(JSON.stringify({logs, writes}).includes('synthetic-private-'), false);
  });
}
test('diagnostics unknown codes and response metadata never leak', () => {
  const allowed = ['missing-input-secret', 'invalid-input-secret', 'missing-input-response',
    'invalid-input-response', 'bad-request', 'timeout-or-duplicate', 'internal-error'];
  const data = input({message: 'synthetic-private-body', turnstileToken: 'synthetic-private-token'});
  const h = harness({properties: diagOn(), verification: {success: false,
    'error-codes': [...allowed, 'synthetic-private-code', {detail: 'synthetic-private-object'}],
    secret: 'synthetic-private-secret', cdata: data.message, challenge_ts: 'synthetic-private-time',
    hostname: 'synthetic-private-host', action: 'synthetic-private-action', requestId: data.requestId}});
  h.post(data); const logs = diagnosticLogs(h); assert.deepEqual(logs[1].error_codes, allowed);
  const property = diagnosticWrites(h)[1]; assert.deepEqual(property.errorCodes, allowed);
  assert.equal(property.unknownErrorCode, true);
  assert.equal(logs[1].unknown_error_code, true);
  const serialized = JSON.stringify({logs, property});
  for (const value of ['synthetic-private', data.requestId, 'mock-only-secret', 'local_mock_form', 'operator@example.test']) {
    assert.equal(serialized.includes(value), false);
  }
  assert.deepEqual(Object.keys(logs[1]).sort(), ['marker', 'stage', 'transport', 'http_status', 'json_ok',
    'success_strict', 'action_matches', 'hostname_matches', 'error_codes', 'unknown_error_code'].sort());
  assert.deepEqual(Object.keys(property).sort(), ['marker', 'stage', 'httpStatus', 'success', 'errorCodes',
    'unknownErrorCode', 'actionMatch', 'hostnameMatch', 'transport', 'at'].sort());
});
test('diagnostic property write failure never changes public result or service order', () => {
  for (const outcome of [{}, {verifyThrows: true}, {verifyStatus: 503}, {badVerifyJson: true},
    {verification: {success: false, 'error-codes': ['bad-request']}}, {saveFails: true}, {mailFails: true}]) {
    const data = input();
    const failed = harness({...outcome, properties: diagOn(), diagWriteThrows: true});
    const baseline = harness(outcome);
    assert.deepEqual(failed.post(data), baseline.post(data));
    assert.equal(failed.state.verification, 1);
    assert.deepEqual(failed.state.saved, baseline.state.saved);
    assert.deepEqual(JSON.parse(JSON.stringify(failed.state.emails)), JSON.parse(JSON.stringify(baseline.state.emails)));
    assert.deepEqual(diagnosticWrites(failed), []);
  }
});
for (const option of ['diagReadThrows', 'diagConsoleThrows', 'helperThrows', 'formatThrows']) {
  test('diagnostic failure isolated: ' + option, () => {
    for (const outcome of [{}, {verifyThrows: true}, {saveFails: true}, {mailFails: true}]) {
      const data = input(); const h = harness({...outcome, properties: diagOn(), [option]: true});
      if (option === 'helperThrows') h.context.fbSiteverifyDiagnostic_ = () => { throw new Error('synthetic-private-helper'); };
      if (option === 'formatThrows') {
        const vm = require('node:vm');
        vm.runInContext("const nativeStringify = JSON.stringify; JSON.stringify = function (x) { if (x && x.marker === 'feedback_siteverify_diag_v1') throw new Error('synthetic-private-format'); return nativeStringify(x); };", h.context);
      }
      assert.deepEqual(h.post(data), harness(outcome).post(data));
      assert.equal(diagnosticLogs(h).length, 0); assert.equal(h.state.verification, 1);
    }
  });
}
test('diagnostics stop after expiry and explicit OFF without changing acceptance', () => {
  const h = harness({properties: diagOn()}); h.post(input()); assert.equal(diagnosticLogs(h).length, 2);
  h.values.FEEDBACK_SITEVERIFY_DIAGNOSTICS_UNTIL = '2020-01-01T00:00:00Z';
  assert.equal(h.post(input()).ok, true); assert.equal(diagnosticLogs(h).length, 2);
  Object.assign(h.values, diagOn()); h.values.FEEDBACK_SITEVERIFY_DIAGNOSTICS_ENABLED = 'false';
  assert.equal(h.post(input()).ok, true); assert.equal(diagnosticLogs(h).length, 2);
});
test('expiry between started and result suppresses later diagnostic log', () => {
  const h = harness({properties: diagOn()}); const fetch = h.context.UrlFetchApp.fetch;
  h.context.UrlFetchApp.fetch = (...args) => {
    h.values.FEEDBACK_SITEVERIFY_DIAGNOSTICS_UNTIL = '2020-01-01T00:00:00Z'; return fetch(...args);
  };
  assert.equal(h.post(input()).ok, true); assert.deepEqual(diagnosticLogs(h).map(x => x.stage), ['started']);
});
test('diagnostics accept explicit timezone offset', () => {
  const h = harness({properties: {...diagOn(), FEEDBACK_SITEVERIFY_DIAGNOSTICS_UNTIL: '2099-01-01T09:00:00+09:00'}});
  assert.equal(h.post(input()).ok, true); assert.equal(diagnosticLogs(h).length, 2);
});
test('diagnostic ON iframe and accepted retry preserve one save and one verification', async () => {
  const h = harness({properties: diagOn()}); const data = input({message: '合成\nQA🙂'});
  const result = await client.acknowledgedSend(data, async payload => {
    h.post(payload); throw new Error('mock lost response');
  }, async payload => h.iframe({...payload, message: payload.message.replace(/\n/g, '\r\n')}));
  assert.equal(result.ok, true); assert.equal(h.state.saved.length, 1); assert.equal(h.state.emails.length, 1);
  assert.equal(h.state.verification, 1); assert.equal(diagnosticLogs(h).length, 2);
  const iframe = harness({properties: diagOn()}); assert.equal(iframe.iframe(input()).ok, true);
  assert.deepEqual(diagnosticLogs(iframe).map(x => x.transport), ['iframe', 'iframe']);
  assert.deepEqual(diagnosticWrites(iframe).map(x => x.transport), ['iframe', 'iframe']);
});
test('Siteverify input remains secret/response only; diagnostic values cannot enable via client', () => {
  const h = harness({properties: diagOn()}); const fetch = h.context.UrlFetchApp.fetch;
  h.context.UrlFetchApp.fetch = (url, config) => {
    assert.deepEqual(Object.keys(config.payload).sort(), ['response', 'secret']); return fetch(url, config);
  };
  assert.equal(h.post(input()).ok, true);
  const invalid = harness(); assert.equal(invalid.post(input({FEEDBACK_SITEVERIFY_DIAGNOSTICS_ENABLED: 'true'})).code, 'invalid_input');
  assert.equal(invalid.state.verification, 0); assert.equal(diagnosticLogs(invalid).length, 0);
});

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
test('temporary production config is public-only; pages are noindex with one user field', () => {
  const vm = require('node:vm'); const context = {window: {}};
  const source = fs.readFileSync(path.join(ROOT, 'feedback-config.js'), 'utf8');
  vm.runInNewContext(source, context);
  const config = context.window.HIRO_FEEDBACK_CONFIG;
  assert.equal(config.endpoint, 'https://script.google.com/macros/s/AKfycbzmH5ClW89OEs3S1wFLLauDatNgWcTDyNw6D0kVeA6-cHg2d7QC_RlWRvxjFZG2i2XM/exec');
  assert.equal(config.sitekey, '0x4AAAAAAErfKafAFfGY0xlG');
  assert.equal(config.responseOrigin, 'https://n-66nehlqf7df57wdesgtz3dcitr5z3g4wpf34jhy-0lu-script.googleusercontent.com');
  assert.deepEqual(Object.keys(config).sort(), ['endpoint', 'sitekey', 'responseOrigin'].sort());
  assert.equal(/FEEDBACK_(?:TURNSTILE_SECRET|NOTIFICATION_EMAIL|FORM_ID|ITEM_ID)/.test(source), false);
  for (const file of ['consignment-note/feedback/index.html', 'en/consignment-note/feedback/index.html']) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.equal((html.match(/<textarea\b/g) || []).length, 1);
    assert.equal(/<input(?![^>]*type="hidden")/.test(html), false);
    assert.equal(/beacon|posthog|google-analytics|site-config\.js|contact-form\.js|language\.js/.test(html), false);
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
    assert.match(html, /feedback-testing/);
  }
});
