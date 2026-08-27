/**
 * Hiro App Works contact form endpoint.
 *
 * The public page sends internal IDs. This file is the only place that maps
 * those IDs to the exact labels used by the existing Google Form.
 * Do not put secrets in this file or in the static website repository.
 */

const APP_VALUES = Object.freeze({
  app_consignment_note: "委託販売ノート",
  app_other: "その他",
});

const INQUIRY_TYPE_VALUES = Object.freeze({
  usage: "操作方法",
  bug: "不具合",
  purchase_restore: "購入・復元",
  feature_request: "機能要望",
  other: "その他",
});

const FORM_FIELD_DEFINITIONS = Object.freeze({
  appId: Object.freeze({
    title: "対象アプリ",
    required: true,
    types: [FormApp.ItemType.LIST, FormApp.ItemType.MULTIPLE_CHOICE],
  }),
  inquiryTypeId: Object.freeze({
    title: "お問い合わせ種別",
    required: true,
    types: [FormApp.ItemType.LIST, FormApp.ItemType.MULTIPLE_CHOICE],
  }),
  message: Object.freeze({
    title: "お問い合わせ内容",
    required: true,
    types: [FormApp.ItemType.PARAGRAPH_TEXT],
  }),
  email: Object.freeze({
    title: "返信先メールアドレス",
    required: true,
    types: [FormApp.ItemType.TEXT],
  }),
  appVersion: Object.freeze({
    title: "アプリのバージョン",
    required: false,
    types: [FormApp.ItemType.TEXT],
  }),
  iosDevice: Object.freeze({
    title: "iOSバージョン／iPhone機種",
    required: false,
    types: [FormApp.ItemType.TEXT],
  }),
});

const ALLOWED_FIELDS = Object.freeze({
  appId: true,
  inquiryTypeId: true,
  message: true,
  email: true,
  appVersion: true,
  iosDevice: true,
  locale: true,
  requestId: true,
  turnstileToken: true,
  honeypot: true,
  transport: true,
});

const MAX_LENGTHS = Object.freeze({
  appId: 64,
  inquiryTypeId: 64,
  message: 5000,
  email: 254,
  appVersion: 120,
  iosDevice: 160,
  locale: 5,
  requestId: 80,
  turnstileToken: 2048,
  honeypot: 200,
  transport: 16,
});

function doGet() {
  return jsonResponse_({ok: true, service: "hiro-app-works-contact"});
}

function doPost(e) {
  var payload = {};
  var transport = "";
  var result;

  try {
    payload = parseRequest_(e);
    transport = typeof payload.transport === "string" ? payload.transport : "";
    validatePayload_(payload);

    var cache = CacheService.getScriptCache();
    var cacheKey = createCacheKey_(payload.requestId);
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      throw publicError_("service_unavailable");
    }

    try {
      if (cache.get(cacheKey)) {
        result = {ok: true};
      } else {
        validateTurnstile_(payload.turnstileToken);
        submitToGoogleForm_(payload);
        cache.put(cacheKey, "accepted", 600);
        result = {ok: true};
      }
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    result = {
      ok: false,
      code: error && error.isPublic ? error.code : "service_unavailable",
    };
  }

  if (transport === "iframe") {
    return iframeResponse_(result, payload.requestId || "");
  }
  return jsonResponse_(result);
}

function parseRequest_(e) {
  if (!e) {
    throw publicError_("invalid_request");
  }

  var body = e.postData && typeof e.postData.contents === "string"
    ? e.postData.contents.trim()
    : "";

  if (body && body.charAt(0) === "{") {
    try {
      var parsed = JSON.parse(body);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
      return parsed;
    } catch (error) {
      throw publicError_("invalid_request");
    }
  }

  var parameters = e.parameters || e.parameter || {};
  return parametersToObject_(parameters);
}

function parametersToObject_(parameters) {
  var payload = {};
  Object.keys(parameters).forEach(function (key) {
    var values = parameters[key];
    if (!Array.isArray(values)) {
      values = [values];
    }
    if (values.length !== 1) {
      throw publicError_("invalid_request");
    }
    payload[key] = String(values[0]);
  });
  return payload;
}

function validatePayload_(payload) {
  Object.keys(payload).forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_FIELDS, key)) {
      throw publicError_("invalid_request");
    }
    if (typeof payload[key] !== "string") {
      throw publicError_("invalid_request");
    }
    if (payload[key].length > MAX_LENGTHS[key]) {
      throw publicError_("invalid_request");
    }
  });

  var requiredFields = [
    "appId",
    "inquiryTypeId",
    "message",
    "email",
    "locale",
    "requestId",
    "turnstileToken",
    "honeypot",
  ];
  requiredFields.forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      throw publicError_("invalid_request");
    }
  });

  payload.appId = normalizedString_(payload.appId, "appId", true);
  payload.inquiryTypeId = normalizedString_(payload.inquiryTypeId, "inquiryTypeId", true);
  payload.message = normalizedString_(payload.message, "message", true);
  payload.email = normalizedString_(payload.email, "email", true);
  payload.appVersion = normalizedString_(payload.appVersion || "", "appVersion", false);
  payload.iosDevice = normalizedString_(payload.iosDevice || "", "iosDevice", false);
  payload.locale = normalizedString_(payload.locale, "locale", true);
  payload.requestId = normalizedString_(payload.requestId, "requestId", true);
  payload.turnstileToken = normalizedString_(payload.turnstileToken, "turnstileToken", true);
  payload.honeypot = normalizedString_(payload.honeypot, "honeypot", false);
  payload.transport = normalizedString_(payload.transport || "", "transport", false);

  if (!Object.prototype.hasOwnProperty.call(APP_VALUES, payload.appId)) {
    throw publicError_("invalid_request");
  }
  if (!Object.prototype.hasOwnProperty.call(INQUIRY_TYPE_VALUES, payload.inquiryTypeId)) {
    throw publicError_("invalid_request");
  }
  if (["ja", "en"].indexOf(payload.locale) === -1) {
    throw publicError_("invalid_request");
  }
  if (payload.transport && payload.transport !== "iframe") {
    throw publicError_("invalid_request");
  }
  if (payload.honeypot) {
    throw publicError_("invalid_request");
  }
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(payload.requestId)) {
    throw publicError_("invalid_request");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw publicError_("invalid_request");
  }
}

function normalizedString_(value, fieldName, required) {
  if (typeof value !== "string") {
    throw publicError_("invalid_request");
  }
  var normalized = value.trim();
  if (required && !normalized) {
    throw publicError_("invalid_request");
  }
  if (normalized.length > MAX_LENGTHS[fieldName]) {
    throw publicError_("invalid_request");
  }
  return normalized;
}

function validateTurnstile_(token) {
  var secret = PropertiesService.getScriptProperties().getProperty("TURNSTILE_SECRET");
  if (!secret) {
    throw publicError_("service_unavailable");
  }

  var response;
  try {
    response = UrlFetchApp.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "post",
      payload: {
        secret: secret,
        response: token,
      },
      muteHttpExceptions: true,
    });
  } catch (error) {
    throw publicError_("service_unavailable");
  }

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw publicError_("service_unavailable");
  }

  var verification;
  try {
    verification = JSON.parse(response.getContentText());
  } catch (error) {
    throw publicError_("service_unavailable");
  }

  if (!verification || verification.success !== true) {
    throw publicError_("verification_failed");
  }

  var allowedHostnames = PropertiesService.getScriptProperties().getProperty("ALLOWED_HOSTNAMES") || "";
  if (allowedHostnames.trim()) {
    var allowed = allowedHostnames.split(",").map(function (hostname) {
      return hostname.trim().toLowerCase();
    }).filter(Boolean);
    var verifiedHostname = String(verification.hostname || "").trim().toLowerCase();
    if (!verifiedHostname || allowed.indexOf(verifiedHostname) === -1) {
      throw publicError_("verification_failed");
    }
  }
}

function submitToGoogleForm_(payload) {
  var formId = PropertiesService.getScriptProperties().getProperty("GOOGLE_FORM_ID");
  if (!formId) {
    throw publicError_("service_unavailable");
  }

  var form;
  try {
    form = FormApp.openById(formId);
  } catch (error) {
    throw publicError_("service_unavailable");
  }

  var items = resolveFormItems_(form);
  var formResponse = form.createResponse();
  formResponse.withItemResponse(createItemResponse_(items.appId, APP_VALUES[payload.appId]));
  formResponse.withItemResponse(createItemResponse_(items.inquiryTypeId, INQUIRY_TYPE_VALUES[payload.inquiryTypeId]));
  formResponse.withItemResponse(createItemResponse_(items.message, payload.message));
  formResponse.withItemResponse(createItemResponse_(items.email, payload.email));
  if (payload.appVersion) {
    formResponse.withItemResponse(createItemResponse_(items.appVersion, payload.appVersion));
  }
  if (payload.iosDevice) {
    formResponse.withItemResponse(createItemResponse_(items.iosDevice, payload.iosDevice));
  }

  try {
    formResponse.submit();
  } catch (error) {
    throw publicError_("service_unavailable");
  }
}

function resolveFormItems_(form) {
  var resolved = {};
  Object.keys(FORM_FIELD_DEFINITIONS).forEach(function (key) {
    var definition = FORM_FIELD_DEFINITIONS[key];
    var matches = form.getItems().filter(function (item) {
      return item.getTitle() === definition.title;
    });
    if (matches.length !== 1) {
      throw publicError_("service_unavailable");
    }
    var item = matches[0];
    var type = item.getType();
    if (definition.types.indexOf(type) === -1) {
      throw publicError_("service_unavailable");
    }

    var isRequired;
    if (type === FormApp.ItemType.TEXT) {
      isRequired = item.asTextItem().isRequired();
    } else if (type === FormApp.ItemType.PARAGRAPH_TEXT) {
      isRequired = item.asParagraphTextItem().isRequired();
    } else if (type === FormApp.ItemType.LIST) {
      isRequired = item.asListItem().isRequired();
    } else if (type === FormApp.ItemType.MULTIPLE_CHOICE) {
      isRequired = item.asMultipleChoiceItem().isRequired();
    } else {
      throw publicError_("service_unavailable");
    }

    if (isRequired !== definition.required) {
      throw publicError_("service_unavailable");
    }
    resolved[key] = item;
  });
  return resolved;
}

function createItemResponse_(item, value) {
  var type = item.getType();
  if (type === FormApp.ItemType.TEXT) {
    return item.asTextItem().createResponse(value);
  }
  if (type === FormApp.ItemType.PARAGRAPH_TEXT) {
    return item.asParagraphTextItem().createResponse(value);
  }
  if (type === FormApp.ItemType.LIST) {
    ensureChoiceExists_(item.asListItem().getChoices(), value);
    return item.asListItem().createResponse(value);
  }
  if (type === FormApp.ItemType.MULTIPLE_CHOICE) {
    ensureChoiceExists_(item.asMultipleChoiceItem().getChoices(), value);
    return item.asMultipleChoiceItem().createResponse(value);
  }
  throw publicError_("service_unavailable");
}

function ensureChoiceExists_(choices, value) {
  var exists = choices.some(function (choice) {
    return choice.getValue() === value;
  });
  if (!exists) {
    throw publicError_("service_unavailable");
  }
}

function createCacheKey_(requestId) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    requestId,
    Utilities.Charset.UTF_8,
  );
  var hex = digest.map(function (byte) {
    var unsigned = byte < 0 ? byte + 256 : byte;
    return ("0" + unsigned.toString(16)).slice(-2);
  }).join("");
  return "hiro-contact:" + hex;
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function iframeResponse_(result, requestId) {
  var message = JSON.stringify({
    type: "hiro-app-works-contact",
    requestId: requestId,
    ok: result.ok === true,
  }).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  var html = "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>" +
    "<script>window.parent.postMessage(" + message + ", '*');</script></body></html>";
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function publicError_(code) {
  return {isPublic: true, code: code};
}
