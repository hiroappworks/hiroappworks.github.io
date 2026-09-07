/** Local implementation only. Add alongside Setup.gs after a separate deployment review. */
const FB_RECEIPT_PREFIX = 'FB_RECEIPT_';
const FB_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;
const FB_RECEIPT_LIMIT = 1000;
const FB_REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ok: false, code: 'method_not_allowed'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let input;
  let result;
  try {
    input = fbParseRequest_(e);
    // HtmlService exposes public top-level functions via google.script.run.
    // Never enable it while the unchanged owner-only Setup entry points coexist.
    // Keep a JSON-only failure, before any save; no HtmlService/RPC context created.
    if (input.transport === 'iframe' && !fbIframeSafe_()) {
      return ContentService.createTextOutput(JSON.stringify(fbResult_(input.requestId, false, 'unavailable')))
        .setMimeType(ContentService.MimeType.JSON);
    }
    result = fbReceive_(input);
  } catch (_) {
    result = fbResult_('', false, 'invalid_input');
  }
  if (input && input.transport === 'iframe') {
    // Only validated machine fields go into script, never the submitted text or a secret.
    const target = fbParentOrigin_();
    if (!target) result = fbResult_(input.requestId, false, 'unavailable');
    const safe = function (value) {
      return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, function (c) {
        return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
      });
    };
    return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><script>' +
      (target ? 'window.top.postMessage(' + safe(result) + ',' + safe(target) + ');' : '') +
      '</script>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function fbResult_(id, ok, code) {
  return {type: 'hiro-feedback-result', requestId: id, ok: ok, code: code};
}

function fbIframeSafe_() {
  return typeof setupFeedbackForm === 'undefined' && typeof verifyFeedbackForm === 'undefined' &&
    typeof saveQaResponsesOnce === 'undefined';
}

function fbParentOrigin_() {
  const value = PropertiesService.getScriptProperties().getProperty('FEEDBACK_PARENT_ORIGIN');
  return /^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/.test(value || '') ? value : null;
}

function fbParseRequest_(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string' || e.queryString) throw new Error('input');
  const raw = e.postData.contents;
  if (raw.length > 100000 || Number(e.postData.length) > 100000) throw new Error('size');
  const type = String(e.postData.type || '').split(';')[0].trim();
  let data;
  if (type === 'application/json' || type === 'text/plain') {
    // This protocol is a flat object of strings. Tokenize its exact grammar to reject
    // duplicate keys (including escaped spellings), nesting and non-string values.
    data = Object.create(null);
    let rest = raw.trim();
    if (!rest.startsWith('{') || !rest.endsWith('}')) throw new Error('json');
    rest = rest.slice(1, -1).trim();
    const pair = /^\s*("(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*")\s*:\s*("(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*")\s*/;
    while (rest) {
      const match = rest.match(pair);
      if (!match) throw new Error('json');
      const key = JSON.parse(match[1]);
      if (Object.prototype.hasOwnProperty.call(data, key)) throw new Error('duplicate');
      data[key] = JSON.parse(match[2]);
      rest = rest.slice(match[0].length);
      if (rest) {
        if (rest[0] !== ',' || !rest.slice(1).trim()) throw new Error('json');
        rest = rest.slice(1);
      }
    }
  } else if (type === 'application/x-www-form-urlencoded') {
    data = Object.create(null);
    raw.split('&').forEach(function (part) {
      const at = part.indexOf('=');
      if (at < 1) throw new Error('encoding');
      const decode = function (s) { return decodeURIComponent(s.replace(/\+/g, ' ')); };
      const key = decode(part.slice(0, at));
      if (Object.prototype.hasOwnProperty.call(data, key)) throw new Error('duplicate');
      data[key] = decode(part.slice(at + 1));
    });
    // Native HTML form POST normalizes field newlines to CRLF. Restore the
    // textarea's LF representation before validation/fingerprinting so the same
    // submission matches its JSON fetch attempt, including at the length limit.
    if (data.transport === 'iframe' && typeof data.message === 'string') {
      data.message = data.message.replace(/\r\n/g, '\n');
    }
  } else throw new Error('type');
  return fbValidate_(data);
}

function fbValidate_(data) {
  const required = ['message', 'locale', 'requestId', 'turnstileToken', 'honeypot'];
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).some(function (key) { return !required.concat(['transport']).includes(key) || typeof data[key] !== 'string'; }) ||
      required.some(function (key) { return !Object.prototype.hasOwnProperty.call(data, key) || typeof data[key] !== 'string'; })) throw new Error('input');
  const text = data.message.trim();
  if (!text || data.message.length > 5000 || !['ja', 'en'].includes(data.locale) ||
      !FB_REQUEST_ID.test(data.requestId) || data.honeypot !== '' ||
      !data.turnstileToken.trim() || data.turnstileToken.length > 2048 ||
      (data.transport !== undefined && !['fetch', 'iframe'].includes(data.transport))) throw new Error('input');
  return {message: text, locale: data.locale, requestId: data.requestId,
    turnstileToken: data.turnstileToken, honeypot: '', transport: data.transport || 'fetch'};
}

function fbSettings_(props) {
  const formId = props.getProperty('FEEDBACK_FORM_ID');
  const itemId = props.getProperty('FEEDBACK_ITEM_ID');
  const secret = props.getProperty('FEEDBACK_TURNSTILE_SECRET');
  const email = props.getProperty('FEEDBACK_NOTIFICATION_EMAIL');
  const hostnames = (props.getProperty('FEEDBACK_ALLOWED_HOSTNAMES') || '').split(',').map(function (s) { return s.trim(); });
  const parent = fbParentOrigin_();
  if (!/^[\w-]+$/.test(formId || '') || !/^\d+$/.test(itemId || '') ||
      !secret || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email || '') ||
      !parent || hostnames.some(function (s) { return !/^[a-z0-9.-]+$/.test(s); }) ||
      !hostnames.includes(parent.slice(8).split(':')[0])) throw new Error('settings');
  return {formId: formId, itemId: Number(itemId), secret: secret, email: email, hostnames: hostnames};
}

function fbPruneReceipts_(props, now) {
  let count = 0;
  const all = props.getProperties();
  Object.keys(all).filter(function (key) { return key.startsWith(FB_RECEIPT_PREFIX); }).forEach(function (key) {
    const record = JSON.parse(all[key]);
    // Corrupt records fail closed, not silently erased and resubmitted.
    if (!Number.isFinite(record.time) || !['pending', 'accepted'].includes(record.state) ||
        !/^[0-9a-f]{64}$/.test(record.fingerprint)) throw new Error('receipt');
    if (now - record.time > FB_RECEIPT_TTL_MS) props.deleteProperty(key);
    else count += 1;
  });
  return count;
}

function fbReceive_(input) {
  const result = function (ok, code) { return fbResult_(input.requestId, ok, code); };
  let lock;
  let locked = false;
  let saved = false;
  let saving = false;
  try {
    // Keep validation here too: callers cannot bypass the endpoint parser.
    input = fbValidate_(input);
    const props = PropertiesService.getScriptProperties();
    const config = fbSettings_(props);
    lock = LockService.getScriptLock();
    locked = lock.tryLock(1000);
    if (!locked) return result(false, 'busy');
    const count = fbPruneReceipts_(props, Date.now());
    const key = FB_RECEIPT_PREFIX + input.requestId;
    const fingerprint = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      JSON.stringify([input.locale, input.message]), Utilities.Charset.UTF_8)
      .map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
    const prior = props.getProperty(key);
    if (prior) {
      const record = JSON.parse(prior);
      if (record.fingerprint !== fingerprint) return result(false, 'conflict');
      // Redeeming an already-used token would break an acknowledged retry.
      return record.state === 'accepted' ? result(true, 'saved') : result(false, 'result_unknown');
    }
    if (count >= FB_RECEIPT_LIMIT) return result(false, 'busy');
    let verification;
    try {
      const response = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'post', payload: {secret: config.secret, response: input.turnstileToken}, muteHttpExceptions: true
      });
      if (response.getResponseCode() !== 200) return result(false, 'verification_failed');
      verification = JSON.parse(response.getContentText());
    } catch (_) { return result(false, 'verification_failed'); }
    if (!verification || verification.success !== true || verification.action !== 'feedback' ||
        !config.hostnames.includes(verification.hostname)) return result(false, 'verification_failed');

    const form = FormApp.openById(config.formId);
    const items = form.getItems();
    if (items.length !== 1 || items[0].getId() !== config.itemId ||
        items[0].getType() !== FormApp.ItemType.PARAGRAPH_TEXT ||
        !items[0].asParagraphTextItem().isRequired() || form.collectsEmail() ||
        !form.isAcceptingResponses()) return result(false, 'unavailable');
    const itemResponse = items[0].asParagraphTextItem().createResponse(input.message);
    const draft = form.createResponse().withItemResponse(itemResponse);
    // A pending receipt is durable before the non-transactional Forms write.
    // If submit throws, its remote outcome may be unknown: do not erase pending.
    const record = {fingerprint: fingerprint, time: Date.now(), state: 'pending'};
    props.setProperty(key, JSON.stringify(record));
    saving = true;
    draft.submit();
    saved = true;
    record.state = 'accepted';
    props.setProperty(key, JSON.stringify(record));
    try {
      MailApp.sendEmail({to: config.email, subject: '【委託販売ノート】新しいご意見・ご要望',
        body: '新しいご意見・ご要望が届きました。\nGoogleフォームの回答画面でご確認ください。\n' +
          'https://docs.google.com/forms/d/' + config.formId + '/edit#responses'});
    } catch (_) { console.warn('feedback_notification_failed'); }
    return result(true, 'saved');
  } catch (_) {
    // No submitted body, IDs, tokens, addresses, or raw exceptions in logs/results.
    if (saved) { console.warn('feedback_receipt_write_failed'); return result(true, 'saved'); }
    return result(false, saving ? 'result_unknown' : 'unavailable');
  } finally {
    if (locked) lock.releaseLock();
  }
}
