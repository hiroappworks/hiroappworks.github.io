// Public routing values only. Configure after a separate deployment/security review.
// Never put Form IDs, notification addresses, or Turnstile secrets here.
window.HIRO_FEEDBACK_CONFIG = Object.freeze({
  endpoint: 'https://script.google.com/macros/s/AKfycbzmH5ClW89OEs3S1wFLLauDatNgWcTDyNw6D0kVeA6-cHg2d7QC_RlWRvxjFZG2i2XM/exec',
  sitekey: '0x4AAAAAAErfKafAFfGY0xlG',
  // Exact HTTPS origin of the deployed HtmlService response (no wildcard).
  // Empty disables iframe fallback; verify Google's frame ancestry in Safari first.
  responseOrigin: 'https://n-66nehlqf7df57wdesgtz3dcitr5z3g4wpf34jhy-0lu-script.googleusercontent.com'
});
