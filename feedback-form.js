(function (root) {
  'use strict';
  const TYPE = 'hiro-feedback-result';
  const CODES = ['saved', 'invalid_input', 'verification_failed', 'busy', 'conflict', 'result_unknown', 'unavailable'];
  const messages = {
    ja: {
      ready: '入力後、セキュリティ確認を完了して送信してください。',
      preparing: 'ただいま準備中です。この画面からはまだ送信できません。',
      sending: '送信結果を確認しています…', send: '送信する',
      invalid_input: '本文を1〜5,000文字で入力してください。空白だけでは送信できません。',
      verification_failed: 'セキュリティ確認に失敗しました。本文は残っています。確認をやり直して再試行してください。',
      busy: '受付が混み合っています。本文は残っています。少し待って再試行してください。',
      unavailable: '現在受け付けできません。本文は残っています。時間をおいて再試行してください。',
      network: '送信結果を確認できませんでした。本文は残っています。再試行は同じ送信として確認します。',
      conflict: '送信内容の確認が必要です。自動で再投稿せず、お問い合わせフォームをご利用ください。',
      result_unknown: '保存結果の確認が必要です。重複を避けるため、この内容の再投稿は控えてください。必要な場合はお問い合わせフォームをご利用ください。'
    },
    en: {
      ready: 'Complete the security check before sending your feedback.',
      preparing: 'This form is being prepared. Sending is not available yet.',
      sending: 'Confirming your submission…', send: 'Send feedback',
      invalid_input: 'Enter 1–5,000 characters. Feedback cannot contain only whitespace.',
      verification_failed: 'The security check failed. Your text is still here. Complete the check again and retry.',
      busy: 'The service is busy. Your text is still here. Wait a moment and retry.',
      unavailable: 'Feedback is currently unavailable. Your text is still here. Please retry later.',
      network: 'We could not confirm the result. Your text is still here. Retrying will check the same submission.',
      conflict: 'This submission needs review. Do not submit it again automatically. Please use the contact form.',
      result_unknown: 'The saved result needs review. To avoid duplicates, please do not repost this feedback. Use the contact form if needed.'
    }
  };

  function validResult(value, id) {
    return Boolean(value && !Array.isArray(value) && typeof value === 'object' &&
      Object.keys(value).sort().join(',') === 'code,ok,requestId,type' &&
      value.type === TYPE && value.requestId === id && typeof value.ok === 'boolean' &&
      CODES.includes(value.code) && value.ok === (value.code === 'saved'));
  }

  function trustedMessage(event, frameWindow, origin, id) {
    if (!origin || event.origin !== origin || !validResult(event.data, id) || !event.source) return false;
    // HtmlService may have a sandbox frame inside the named target iframe.
    // Require that the actual sender belongs to this specific target, never merely
    // that it has a Google origin. Cross-origin Window.parent is a permitted read.
    let source = event.source;
    try {
      for (let depth = 0; depth < 5; depth += 1) {
        if (source === frameWindow) return true;
        if (source.parent === source) return false;
        source = source.parent;
      }
    } catch (_) { return false; }
    return false;
  }

  function newSubmission(uuid) {
    let previous = null;
    return function (message, locale) {
      if (!previous || previous.message !== message || previous.locale !== locale) {
        previous = {message: message, locale: locale, requestId: uuid()};
      }
      return Object.assign({}, previous);
    };
  }

  async function acknowledgedSend(payload, fetchSend, iframeSend) {
    try {
      const result = await fetchSend(payload);
      if (!validResult(result, payload.requestId)) throw new Error('response');
      return result;
    } catch (_) {
      if (!iframeSend) throw new Error('network');
      const result = await iframeSend(payload);
      if (!validResult(result, payload.requestId)) throw new Error('network');
      return result;
    }
  }

  function start(doc, config) {
    const form = doc.querySelector('#feedback-form');
    if (!form) return;
    const locale = doc.documentElement.lang === 'en' ? 'en' : 'ja';
    const copy = messages[locale];
    const text = doc.querySelector('#feedback-message');
    const status = doc.querySelector('#feedback-status');
    const error = doc.querySelector('#feedback-error');
    const button = form.querySelector('button[type=submit]');
    const success = doc.querySelector('#feedback-success');
    const widget = doc.querySelector('#feedback-security');
    let token = '';
    let widgetId;
    let busy = false;
    let done = false;
    let blocked = false;
    let widgetFailed = false;
    const submission = newSubmission(function () { return root.crypto.randomUUID(); });
    function configuredUrl(value, endpoint) {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash &&
          (endpoint ? /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(value) : url.origin === value);
      } catch (_) { return false; }
    }
    const enabled = config && configuredUrl(config.endpoint, true) && typeof config.sitekey === 'string' &&
      config.sitekey.length > 0 && root.crypto && typeof root.crypto.randomUUID === 'function';
    const fallbackEnabled = enabled && configuredUrl(config.responseOrigin, false);
    function update() {
      button.disabled = !enabled || busy || done || blocked || !token;
      button.textContent = busy ? copy.sending : copy.send;
      form.setAttribute('aria-busy', String(busy));
      text.readOnly = busy || done || blocked;
    }
    function showError(code) {
      error.textContent = copy[code] || copy.unavailable;
      error.hidden = false;
      text.setAttribute('aria-invalid', String(code === 'invalid_input'));
    }
    function resetToken() {
      token = '';
      if (root.turnstile && widgetId !== undefined) {
        if (widgetFailed) {
          root.turnstile.remove(widgetId);
          widgetId = undefined;
          renderWidget();
        } else root.turnstile.reset(widgetId);
      }
      update();
    }
    function renderWidget() {
      widgetFailed = false;
      widgetId = root.turnstile.render(widget, {
        sitekey: config.sitekey, action: 'feedback', language: locale, size: 'compact',
        'response-field': false,
        callback: function (value) { token = value; update(); },
        'expired-callback': function () { token = ''; showError('verification_failed'); update(); },
        'timeout-callback': function () { token = ''; showError('verification_failed'); update(); },
        'error-callback': function () { token = ''; widgetFailed = true; showError('verification_failed'); update(); }
      });
    }
    const retrySecurity = doc.querySelector('#feedback-retry-security');
    retrySecurity.addEventListener('click', function () {
      if (!enabled || busy || done || blocked) return;
      if (root.turnstile) resetToken();
      else { securityScript.remove(); loadSecurity(); }
    });
    let securityScript;
    function loadSecurity() {
      securityScript = doc.createElement('script');
      securityScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      securityScript.async = true;
      securityScript.onload = function () { if (root.turnstile) renderWidget(); else showError('verification_failed'); };
      securityScript.onerror = function () { showError('verification_failed'); };
      doc.head.appendChild(securityScript);
    }
    status.textContent = enabled ? copy.ready : copy.preparing;
    retrySecurity.hidden = !enabled;
    update();
    if (enabled) loadSecurity();

    async function fetchSend(payload) {
      const controller = new AbortController();
      const timer = root.setTimeout(function () { controller.abort(); }, 12000);
      try {
        const response = await root.fetch(config.endpoint, {method: 'POST', mode: 'cors', credentials: 'omit',
          redirect: 'follow', referrerPolicy: 'no-referrer', signal: controller.signal,
          headers: {'Content-Type': 'text/plain;charset=UTF-8'},
          body: JSON.stringify(Object.assign({}, payload, {transport: 'fetch'}))});
        if (!response.ok || response.type === 'opaque') throw new Error('network');
        return await response.json();
      } finally { root.clearTimeout(timer); }
    }
    function iframeSend(payload) {
      return new Promise(function (resolve, reject) {
        const frame = doc.createElement('iframe');
        frame.name = 'feedback-' + payload.requestId;
        frame.hidden = true;
        frame.title = 'Feedback submission result';
        const transport = doc.createElement('form');
        transport.hidden = true;
        transport.method = 'POST'; transport.action = config.endpoint; transport.target = frame.name;
        Object.entries(Object.assign({}, payload, {transport: 'iframe'})).forEach(function (entry) {
          const field = doc.createElement('input');
          field.type = 'hidden'; field.name = entry[0]; field.value = entry[1]; transport.appendChild(field);
        });
        function clean() { root.clearTimeout(timer); root.removeEventListener('message', receive); frame.remove(); transport.remove(); }
        function receive(event) {
          if (!trustedMessage(event, frame.contentWindow, config.responseOrigin, payload.requestId)) return;
          clean(); resolve(event.data);
        }
        const timer = root.setTimeout(function () { clean(); reject(new Error('network')); }, 25000);
        root.addEventListener('message', receive);
        doc.body.append(frame, transport);
        transport.submit();
      });
    }
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!enabled || busy || done || blocked) return;
      const message = text.value.trim();
      error.hidden = true;
      text.setAttribute('aria-invalid', 'false');
      if (!message || text.value.length > 5000) { showError('invalid_input'); text.focus(); return; }
      if (!token) { showError('verification_failed'); return; }
      const payload = Object.assign(submission(message, locale), {
        turnstileToken: token, honeypot: form.querySelector('[name=honeypot]').value
      });
      busy = true; update(); status.textContent = copy.sending;
      try {
        const result = await acknowledgedSend(payload, fetchSend, fallbackEnabled ? iframeSend : null);
        if (result.ok) {
          done = true;
          text.value = '';
          form.hidden = true;
          success.hidden = false;
          status.textContent = '';
          success.focus();
        } else {
          blocked = ['conflict', 'result_unknown'].includes(result.code);
          showError(result.code);
        }
      } catch (_) { showError('network'); }
      finally {
        busy = false;
        if (!done) { status.textContent = ''; resetToken(); }
        else update();
      }
    });
  }

  if (typeof module === 'object' && module.exports) module.exports = {validResult, trustedMessage, newSubmission, acknowledgedSend};
  else start(root.document, root.HIRO_FEEDBACK_CONFIG);
})(typeof window === 'undefined' ? globalThis : window);
