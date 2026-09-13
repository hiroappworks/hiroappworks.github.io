// Local-only GAS mocks. No network, real forms, or real email.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const GAS = fs.readFileSync(path.join(ROOT, 'gas/feedback-form/Code.gs'), 'utf8');
const SETUP = fs.readFileSync(path.join(ROOT, 'gas/feedback-form/Setup.gs'), 'utf8');

function harness(options = {}) {
  const values = {
    FEEDBACK_FORM_ID: 'local_mock_form', FEEDBACK_ITEM_ID: '42',
    FEEDBACK_TURNSTILE_SECRET: 'mock-only-secret', FEEDBACK_NOTIFICATION_EMAIL: 'operator@example.test',
    FEEDBACK_ALLOWED_HOSTNAMES: 'hiroappworks.com', FEEDBACK_PARENT_ORIGIN: 'https://hiroappworks.com',
    ...options.properties
  };
  const state = {saved: [], emails: [], verification: 0, locks: 0, logs: [], diagnosticWrites: [], opened: [], held: false,
    created: 0, added: 0, titleWrites: 0};
  const item = {getId: () => options.wrongId ? 43 : 42, getType: () => options.wrongType ? 'TEXT' : 'PARAGRAPH_TEXT',
    asParagraphTextItem() { return this; }, isRequired: () => !options.optional,
    createResponse: message => ({message})};
  const props = {getProperty: key => {
    if (options.diagReadThrows && key.startsWith('FEEDBACK_SITEVERIFY_DIAGNOSTICS_')) throw new Error('synthetic-private-read');
    return values[key] ?? null;
  }, getProperties: () => ({...values}),
    setProperty(key, value) {
      if (options.diagWriteThrows && key === 'FEEDBACK_SITEVERIFY_DIAGNOSTIC_LAST') throw new Error('synthetic-private-write');
      if (options.receiptWriteFails && value.includes('accepted')) throw new Error('private failure');
      if (key === 'FEEDBACK_SITEVERIFY_DIAGNOSTIC_LAST') state.diagnosticWrites.push(value);
      values[key] = value;
    }, deleteProperty: key => { delete values[key]; }};
  const form = {getItems: () => options.twoItems ? [item, item] : [item], collectsEmail: () => Boolean(options.collectsEmail),
    isAcceptingResponses: () => !options.closed,
    createResponse: () => ({withItemResponse(response) { this.response = response; return this; }, submit() {
      if (options.saveFails) throw new Error('private submission error');
      state.saved.push(this.response.message);
      return {getId: () => 'mock-response'};
    }})};
  const output = text => ({text, setMimeType() { return this; }, setXFrameOptionsMode() { return this; }});
  const context = vm.createContext({console: {warn: code => state.logs.push(code), log: code => {
    if (typeof code === 'string' && (code === 'feedback_diagnostic_probe_v1' ||
        code.startsWith('{"marker":"feedback_siteverify_diag_v1"'))) {
      if (options.diagConsoleThrows) throw new Error('synthetic-private-console');
      state.logs.push(code); return;
    }
    if (!options.management) throw new Error('Unexpected setup log');
    // Suppress mock setup metadata, as well as all response content.
  }},
    PropertiesService: {getScriptProperties: () => props},
    LockService: {getScriptLock: () => ({waitLock() {
      if (state.held) throw new Error('Mock lock busy');
      state.held = true; state.locks++;
    }, tryLock() {
      if (options.lockBusy || state.held) return false;
      state.held = true; state.locks++; return true;
    }, releaseLock() { state.held = false; }})},
    Utilities: {getUuid: crypto.randomUUID, DigestAlgorithm: {SHA_256: 'sha256'}, Charset: {UTF_8: 'utf8'},
      computeDigest: (_, value) => Array.from(crypto.createHash('sha256').update(value).digest())},
    UrlFetchApp: {fetch(url, config) {
      if (url !== 'https://challenges.cloudflare.com/turnstile/v0/siteverify' || config.payload.secret !== 'mock-only-secret') throw new Error('Unexpected outbound target');
      state.verification++;
      if (options.verifyThrows) throw new Error('synthetic-private-exception');
      return {getResponseCode: () => options.verifyStatus || 200,
        getContentText: () => options.badVerifyJson ? 'invalid' : JSON.stringify(options.verification || {success: true, hostname: 'hiroappworks.com', action: 'feedback'})};
    }},
    FormApp: {ItemType: {PARAGRAPH_TEXT: 'PARAGRAPH_TEXT'}, openById(id) {
      state.opened.push(id); if (id !== 'local_mock_form') throw new Error('Wrong form'); return form;
    }},
    MailApp: {sendEmail(mail) { if (options.mailFails) throw new Error('private mail failure'); state.emails.push(mail); }},
    ContentService: {createTextOutput: output, MimeType: {JSON: 'application/json'}},
    HtmlService: {createHtmlOutput: output, XFrameOptionsMode: {ALLOWALL: 'ALLOWALL'}}
  });
  // Compile both files together: this fails if shared top-level names collide.
  vm.runInContext(SETUP + '\n' + GAS, context);
  if (options.publicManagement) context[options.publicManagement] = () => { throw new Error('Forbidden public management call'); };
  if (options.management) {
    const settings = {
      Title: vm.runInContext('FEEDBACK_TITLE', context), Description: vm.runInContext('FEEDBACK_DESCRIPTION', context),
      ConfirmationMessage: vm.runInContext('FEEDBACK_CONFIRMATION', context),
      CollectEmail: false, LimitOneResponsePerUser: false, AllowResponseEdits: false, PublishingSummary: false,
      IsQuiz: false, ShowLinkToRespondAgain: false, Published: true, ...options.formSettings
    };
    const question = {Title: 'ご意見・ご要望', HelpText: '一言でも構いません。', Required: true};
    for (const key of Object.keys(settings)) form['set' + key] = value => {
      settings[key] = value; if (key === 'Title') state.titleWrites++; return form;
    };
    for (const key of ['Title', 'Description', 'ConfirmationMessage']) form['get' + key] = () => settings[key];
    Object.assign(form, {
      getId: () => 'local_mock_form', getEditUrl: () => 'https://example.test/mock-management',
      getEditors: () => [{mockOwner: true}], isPublished: () => settings.Published,
      hasLimitOneResponsePerUser: () => settings.LimitOneResponsePerUser,
      canEditResponse: () => settings.AllowResponseEdits, isPublishingSummary: () => settings.PublishingSummary,
      isQuiz: () => settings.IsQuiz, collectsEmail: () => settings.CollectEmail,
      addParagraphTextItem() { state.added++; return item; },
      getItemById(id) { if (id !== 42) throw new Error('Wrong mock item'); return item; }
    });
    for (const key of Object.keys(question)) item['set' + key] = value => { question[key] = value; return item; };
    item.getTitle = () => question.Title; item.getHelpText = () => question.HelpText; item.isRequired = () => question.Required;
    function responseAt(index) {
      return {getId: () => 'mock-response-' + index, getRespondentEmail: () => '',
        getItemResponses: () => [{getItem: () => item, getResponse: () => state.saved[index]}]};
    }
    form.getResponses = () => state.saved.map((_, index) => responseAt(index));
    form.getResponse = id => {
      const index = Number(id.replace('mock-response-', ''));
      if (!Number.isInteger(index) || index < 0 || index >= state.saved.length) throw new Error('Wrong mock response');
      return responseAt(index);
    };
    form.createResponse = () => ({withItemResponse(response) { this.response = response; return this; }, submit() {
      state.saved.push(this.response.message); return responseAt(state.saved.length - 1);
    }});
    context.FormApp.create = () => { state.created++; return form; };
  }
  function iframe(data) {
    const html = context.doPost(event(new URLSearchParams({...data, transport: 'iframe'}).toString(), 'application/x-www-form-urlencoded')).text;
    let reply;
    vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1], {window: {top: {postMessage(value) { reply = JSON.parse(JSON.stringify(value)); }}}});
    return reply;
  }
  return {context, state, values, props, iframe, post(data) { return JSON.parse(context.doPost(event(data)).text); }};
}
function input(overrides = {}) {
  return {message: 'ローカルQA feedback', locale: 'ja', requestId: crypto.randomUUID(),
    turnstileToken: 'mock-token', honeypot: '', transport: 'fetch', ...overrides};
}
function event(data, type = 'text/plain') {
  const contents = typeof data === 'string' ? data : JSON.stringify(data);
  return {queryString: '', postData: {contents, type, length: Buffer.byteLength(contents)}};
}
module.exports = {ROOT, GAS, SETUP, harness, input, event};
