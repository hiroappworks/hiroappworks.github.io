(function () {
  "use strict";

  var form = document.querySelector("[data-contact-form]");
  if (!form) {
    return;
  }

  var config = window.HIRO_APP_WORKS_CONFIG || {};
  var contactConfig = config.contact || {};
  var endpoint = typeof contactConfig.endpoint === "string" ? contactConfig.endpoint.trim() : "";
  var turnstileSiteKey = typeof contactConfig.turnstileSiteKey === "string" ? contactConfig.turnstileSiteKey.trim() : "";
  var isConfigured = Boolean(endpoint && turnstileSiteKey);

  var controls = {
    appId: form.elements.namedItem("appId"),
    inquiryTypeId: form.elements.namedItem("inquiryTypeId"),
    message: form.elements.namedItem("message"),
    email: form.elements.namedItem("email"),
    appVersion: form.elements.namedItem("appVersion"),
    iosDevice: form.elements.namedItem("iosDevice")
  };
  var localeInput = form.elements.namedItem("locale");
  var requestIdInput = form.elements.namedItem("requestId");
  var turnstileTokenInput = form.elements.namedItem("turnstileToken");
  var transportInput = form.elements.namedItem("transport");
  var submitButton = form.querySelector("[data-submit-button]");
  var status = form.parentElement.querySelector("[data-form-status]");
  var setupNote = form.querySelector("[data-setup-note]");
  var turnstileWidget = form.querySelector("[data-turnstile-widget]");
  var turnstileStatus = form.querySelector("[data-turnstile-status]");
  var locale = localeInput && localeInput.value.trim() === "en" ? "en" : "ja";
  var messages = locale === "en" ? {
    submitting: "Sending…",
    submitted: "Sent",
    setupPending: "Preparing submission",
    needsVerification: "Complete verification to send",
    submit: "Send",
    appRequired: "Please select an app.",
    inquiryRequired: "Please select an inquiry type.",
    messageRequired: "Please enter your message.",
    messageMax: "Message must be 5,000 characters or fewer.",
    emailRequired: "Please enter your reply email address.",
    emailInvalid: "Please check the email address format.",
    appVersionMax: "App version must be 120 characters or fewer.",
    iosDeviceMax: "iOS version / iPhone model must be 160 characters or fewer.",
    configError: "Submission settings are currently being prepared. If your matter is urgent, please contact us by email.",
    verificationRequired: "Please complete the verification before sending.",
    verificationLoadError: "We couldn't load the verification. Please reload and try again later.",
    verificationComplete: "Verification complete. You can send your message.",
    verificationFailed: "Verification could not be completed. Please try again.",
    verificationLoading: "Loading verification before sending.",
    fallbackFrameTitle: "Submission result",
    submitError: "We couldn't send your message. Please try again later. Your message has been kept."
  } : {
    submitting: "送信中…",
    submitted: "送信済み",
    setupPending: "送信設定を準備中",
    needsVerification: "認証後に送信",
    submit: "送信する",
    appRequired: "対象アプリを選択してください。",
    inquiryRequired: "お問い合わせ種別を選択してください。",
    messageRequired: "お問い合わせ内容を入力してください。",
    messageMax: "お問い合わせ内容は5,000文字以内で入力してください。",
    emailRequired: "返信先メールアドレスを入力してください。",
    emailInvalid: "メールアドレスの形式を確認してください。",
    appVersionMax: "アプリのバージョンは120文字以内で入力してください。",
    iosDeviceMax: "iOSバージョン／iPhone機種は160文字以内で入力してください。",
    configError: "現在、送信設定を準備中です。お急ぎの場合はメールでご連絡ください。",
    verificationRequired: "送信前に確認を完了してください。",
    verificationLoadError: "認証を読み込めませんでした。時間をおいて再読み込みしてください。",
    verificationComplete: "確認が完了しました。送信できます。",
    verificationFailed: "認証を完了できませんでした。もう一度お試しください。",
    verificationLoading: "送信前の認証を読み込んでいます。",
    fallbackFrameTitle: "送信結果",
    submitError: "送信できませんでした。時間をおいてもう一度お試しください。送信内容は保持されています。"
  };
  var successUrl = form.getAttribute("data-success-url") || "/contact/thanks/";
  var errorElements = {};
  var isSubmitting = false;
  var submissionComplete = false;
  var turnstileState = {
    widgetId: null,
    ready: false,
    token: ""
  };
  var fallbackFrame = null;
  var fallbackWaiter = null;

  Array.prototype.forEach.call(form.querySelectorAll("[data-error-for]"), function (element) {
    errorElements[element.getAttribute("data-error-for")] = element;
  });

  function setStatus(message, type) {
    if (!status) {
      return;
    }
    status.textContent = message || "";
    status.hidden = !message;
    status.className = "form-status" + (type ? " is-" + type : "");
  }

  function setTurnstileStatus(message) {
    if (turnstileStatus) {
      turnstileStatus.textContent = message;
    }
  }

  function setFieldError(name, message) {
    var control = controls[name];
    var error = errorElements[name];
    if (control) {
      control.setAttribute("aria-invalid", message ? "true" : "false");
    }
    if (error) {
      error.textContent = message || "";
      error.hidden = !message;
    }
  }

  function clearFieldErrors() {
    Object.keys(controls).forEach(function (name) {
      setFieldError(name, "");
    });
  }

  function trimmedValue(control) {
    return control && typeof control.value === "string" ? control.value.trim() : "";
  }

  function createRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function updateSubmitButton() {
    if (!submitButton) {
      return;
    }
    if (isSubmitting) {
      submitButton.disabled = true;
      submitButton.textContent = messages.submitting;
      return;
    }
    if (submissionComplete) {
      submitButton.disabled = true;
      submitButton.textContent = messages.submitted;
      return;
    }
    if (!isConfigured) {
      submitButton.disabled = true;
      submitButton.textContent = messages.setupPending;
      return;
    }
    if (!turnstileState.token) {
      submitButton.disabled = true;
      submitButton.textContent = messages.needsVerification;
      return;
    }
    submitButton.disabled = false;
    submitButton.textContent = messages.submit;
  }

  function validateForm() {
    var firstInvalid = null;
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    clearFieldErrors();

    if (!trimmedValue(controls.appId)) {
      setFieldError("appId", messages.appRequired);
      firstInvalid = firstInvalid || controls.appId;
    }

    if (!trimmedValue(controls.inquiryTypeId)) {
      setFieldError("inquiryTypeId", messages.inquiryRequired);
      firstInvalid = firstInvalid || controls.inquiryTypeId;
    }

    if (!trimmedValue(controls.message)) {
      setFieldError("message", messages.messageRequired);
      firstInvalid = firstInvalid || controls.message;
    } else if (controls.message.value.length > controls.message.maxLength) {
      setFieldError("message", messages.messageMax);
      firstInvalid = firstInvalid || controls.message;
    }

    var email = trimmedValue(controls.email);
    if (!email) {
      setFieldError("email", messages.emailRequired);
      firstInvalid = firstInvalid || controls.email;
    } else if (!emailPattern.test(email) || !controls.email.checkValidity()) {
      setFieldError("email", messages.emailInvalid);
      firstInvalid = firstInvalid || controls.email;
    }

    if (controls.appVersion.value.length > controls.appVersion.maxLength) {
      setFieldError("appVersion", messages.appVersionMax);
      firstInvalid = firstInvalid || controls.appVersion;
    }

    if (controls.iosDevice.value.length > controls.iosDevice.maxLength) {
      setFieldError("iosDevice", messages.iosDeviceMax);
      firstInvalid = firstInvalid || controls.iosDevice;
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return null;
    }

    if (!isConfigured) {
      setStatus(messages.configError, "error");
      return null;
    }

    if (!turnstileState.token) {
      setTurnstileStatus(messages.verificationRequired);
      return null;
    }

    return {
      appId: trimmedValue(controls.appId),
      inquiryTypeId: trimmedValue(controls.inquiryTypeId),
      message: controls.message.value.trim(),
      email: email,
      appVersion: controls.appVersion.value.trim(),
      iosDevice: controls.iosDevice.value.trim(),
      locale: locale,
      requestId: createRequestId(),
      turnstileToken: turnstileState.token,
      honeypot: ""
    };
  }

  function resetTurnstile() {
    turnstileState.token = "";
    turnstileTokenInput.value = "";
    if (window.turnstile && turnstileState.widgetId !== null && typeof window.turnstile.reset === "function") {
      try {
        window.turnstile.reset(turnstileState.widgetId);
      } catch (error) {
        // The widget can be unavailable after a network interruption.
      }
    }
    setTurnstileStatus(isConfigured ? messages.verificationRequired : messages.setupPending);
    updateSubmitButton();
  }

  function renderTurnstile() {
    if (!window.turnstile || typeof window.turnstile.render !== "function") {
      setTurnstileStatus(messages.verificationLoadError);
      return;
    }

    try {
      var turnstileOptions = {
        sitekey: turnstileSiteKey,
        action: "contact",
        responseField: false,
        callback: function (token) {
          turnstileState.token = token;
          turnstileTokenInput.value = token;
          setTurnstileStatus(messages.verificationComplete);
          updateSubmitButton();
        },
        "expired-callback": function () {
          resetTurnstile();
        },
        "error-callback": function () {
          resetTurnstile();
          setTurnstileStatus(messages.verificationFailed);
        }
      };
      if (locale === "en") {
        turnstileOptions.language = "en";
      }
      if (document.documentElement.clientWidth <= 340) {
        turnstileOptions.size = "compact";
      }
      turnstileState.widgetId = window.turnstile.render(turnstileWidget, turnstileOptions);
      turnstileState.ready = true;
      setTurnstileStatus(messages.verificationRequired);
      updateSubmitButton();
    } catch (error) {
      setTurnstileStatus(messages.verificationLoadError);
    }
  }

  function loadTurnstile() {
    if (!isConfigured) {
      if (setupNote) {
        setupNote.hidden = false;
      }
      setTurnstileStatus(messages.setupPending);
      updateSubmitButton();
      return;
    }

    if (setupNote) {
      setupNote.hidden = true;
    }
    setTurnstileStatus(messages.verificationLoading);

    var onScriptReady = function () {
      renderTurnstile();
    };
    var existingScript = document.querySelector("script[data-turnstile-api]");

    if (existingScript) {
      if (window.turnstile) {
        onScriptReady();
      } else {
        existingScript.addEventListener("load", onScriptReady, { once: true });
      }
      return;
    }

    var script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.turnstileApi = "true";
    script.addEventListener("load", onScriptReady, { once: true });
    script.addEventListener("error", function () {
      setTurnstileStatus(messages.verificationLoadError);
    }, { once: true });
    document.head.appendChild(script);
  }

  function createFallbackFrame() {
    if (fallbackFrame) {
      return fallbackFrame;
    }
    fallbackFrame = document.createElement("iframe");
    fallbackFrame.name = "hiro-app-works-contact-response";
    fallbackFrame.title = messages.fallbackFrameTitle;
    fallbackFrame.tabIndex = -1;
    fallbackFrame.hidden = true;
    fallbackFrame.setAttribute("aria-hidden", "true");
    document.body.appendChild(fallbackFrame);

    window.addEventListener("message", function (event) {
      var data = event.data;
      if (!fallbackWaiter || event.source !== fallbackFrame.contentWindow || !data || data.type !== "hiro-app-works-contact") {
        return;
      }
      if (data.requestId !== fallbackWaiter.requestId) {
        return;
      }
      var waiter = fallbackWaiter;
      fallbackWaiter = null;
      waiter.resolve({ ok: data.ok === true });
    });

    return fallbackFrame;
  }

  function submitWithFetch(payload) {
    return window.fetch(endpoint, {
      method: "POST",
      mode: "cors",
      redirect: "follow",
      credentials: "omit",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8"
      },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("server");
      }
      return response.json().catch(function () {
        throw new Error("transport");
      });
    }).catch(function (error) {
      if (error && error.message === "server") {
        throw error;
      }
      var transportError = new Error("transport");
      transportError.isTransportError = true;
      throw transportError;
    });
  }

  function submitWithIframe(payload) {
    var frame = createFallbackFrame();
    return new Promise(function (resolve, reject) {
      var originalAction = form.getAttribute("action");
      var originalTarget = form.getAttribute("target");
      var timeoutId = window.setTimeout(function () {
        fallbackWaiter = null;
        reject(new Error("transport"));
      }, 25000);

      fallbackWaiter = {
        requestId: payload.requestId,
        resolve: function (result) {
          window.clearTimeout(timeoutId);
          resolve(result);
        }
      };

      requestIdInput.value = payload.requestId;
      turnstileTokenInput.value = payload.turnstileToken;
      transportInput.value = "iframe";
      Array.prototype.forEach.call(form.querySelectorAll('input[name="cf-turnstile-response"]'), function (element) {
        element.remove();
      });
      form.setAttribute("action", endpoint);
      form.setAttribute("target", frame.name);
      form.setAttribute("method", "post");

      try {
        HTMLFormElement.prototype.submit.call(form);
      } catch (error) {
        window.clearTimeout(timeoutId);
        fallbackWaiter = null;
        reject(error);
      } finally {
        if (originalAction === null) {
          form.removeAttribute("action");
        } else {
          form.setAttribute("action", originalAction);
        }
        if (originalTarget === null) {
          form.removeAttribute("target");
        } else {
          form.setAttribute("target", originalTarget);
        }
        transportInput.value = "";
      }
    });
  }

  form.addEventListener("input", function (event) {
    var name = event.target && event.target.name;
    if (name && errorElements[name]) {
      setFieldError(name, "");
    }
  });

  form.addEventListener("change", function (event) {
    var name = event.target && event.target.name;
    if (name && errorElements[name]) {
      setFieldError(name, "");
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (isSubmitting || submissionComplete) {
      return;
    }

    var payload = validateForm();
    if (!payload) {
      updateSubmitButton();
      return;
    }

    isSubmitting = true;
    setStatus("", "");
    requestIdInput.value = payload.requestId;
    updateSubmitButton();

    submitWithFetch(payload).then(function (result) {
      if (!result || result.ok !== true) {
        throw new Error("server");
      }
      return result;
    }).catch(function (error) {
      if (!error || error.isTransportError !== true) {
        throw error;
      }
      return submitWithIframe(payload).then(function (fallbackResult) {
        if (!fallbackResult || fallbackResult.ok !== true) {
          throw new Error("server");
        }
        return fallbackResult;
      });
    }).then(function () {
      submissionComplete = true;
      window.location.assign(successUrl);
    }).catch(function () {
      setStatus(messages.submitError, "error");
      resetTurnstile();
    }).finally(function () {
      isSubmitting = false;
      updateSubmitButton();
    });
  });

  updateSubmitButton();
  loadTurnstile();
})();
