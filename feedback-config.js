// Public routing values only. Configure after a separate deployment/security review.
// Never put Form IDs, notification addresses, or Turnstile secrets here.
window.HIRO_FEEDBACK_CONFIG = Object.freeze({
  endpoint: '',
  sitekey: '',
  // Exact HTTPS origin of the deployed HtmlService response (no wildcard).
  // Empty disables iframe fallback; verify Google's frame ancestry in Safari first.
  responseOrigin: ''
});
