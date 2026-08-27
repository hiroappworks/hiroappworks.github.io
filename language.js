(function () {
  "use strict";

  var LANGUAGE_STORAGE_KEY = "hiroAppWorksLanguage";
  var NOTICE_STORAGE_KEY = "hiroAppWorksEnglishNoticeDismissed";
  var routes = {
    "/": {ja: "/", en: "/en/"},
    "/privacy": {ja: "/privacy/", en: "/en/privacy/"},
    "/contact": {ja: "/contact/", en: "/en/contact/"},
    "/contact/thanks": {ja: "/contact/thanks/", en: "/en/contact/thanks/"},
    "/en": {ja: "/", en: "/en/"},
    "/en/privacy": {ja: "/privacy/", en: "/en/privacy/"},
    "/en/contact": {ja: "/contact/", en: "/en/contact/"},
    "/en/contact/thanks": {ja: "/contact/thanks/", en: "/en/contact/thanks/"}
  };

  function normalizePath(pathname) {
    var path = pathname || "/";
    path = path.replace(/\/index\.html$/i, "/");
    if (path.length > 1) {
      path = path.replace(/\/+$/, "");
    }
    return path || "/";
  }

  function getRouteTargets(pathname) {
    var path = normalizePath(pathname);
    if (routes[path]) {
      return routes[path];
    }
    if (path.indexOf("/en") === 0) {
      return {ja: "/", en: path + "/"};
    }
    return {ja: path + "/", en: "/en/"};
  }

  function readStorage(storageName, key) {
    try {
      return window[storageName] ? window[storageName].getItem(key) || "" : "";
    } catch (error) {
      return "";
    }
  }

  function writeStorage(storageName, key, value) {
    try {
      if (window[storageName]) {
        window[storageName].setItem(key, value);
      }
    } catch (error) {
      // Storage may be unavailable in private or restricted browsing contexts.
    }
  }

  function isEnglishPath(pathname) {
    var path = normalizePath(pathname);
    return path === "/en" || path.indexOf("/en/") === 0;
  }

  function isJapaneseBrowser() {
    var preferred = "";
    if (navigator.languages && navigator.languages.length) {
      preferred = navigator.languages[0];
    } else {
      preferred = navigator.language || "";
    }
    return /^ja(?:-|$)/i.test(preferred);
  }

  function setupLanguageMenu(targets, currentLanguage) {
    var menu = document.querySelector("[data-language-menu]");
    if (!menu) {
      return;
    }

    var toggle = menu.querySelector("[data-language-toggle]");
    var panel = menu.querySelector("[data-language-options]");
    var links = Array.prototype.slice.call(menu.querySelectorAll("[data-language-choice]"));
    if (!toggle || !panel || links.length === 0) {
      return;
    }

    var setOpen = function (isOpen, returnFocus) {
      menu.classList.toggle("is-open", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      panel.hidden = !isOpen;
      if (!isOpen && returnFocus) {
        toggle.focus();
      }
    };

    links.forEach(function (link) {
      var language = link.getAttribute("data-language-choice");
      var href = language === "en" ? targets.en : targets.ja;
      link.setAttribute("href", href);
      if (language === currentLanguage) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
      link.addEventListener("click", function () {
        writeStorage("localStorage", LANGUAGE_STORAGE_KEY, language);
      });
    });

    setOpen(false, false);
    toggle.addEventListener("click", function () {
      setOpen(panel.hidden, false);
    });

    document.addEventListener("click", function (event) {
      if (!menu.contains(event.target)) {
        setOpen(false, false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) {
        event.preventDefault();
        setOpen(false, true);
        return;
      }

      if (panel.hidden || ["ArrowDown", "ArrowUp", "Home", "End"].indexOf(event.key) === -1) {
        return;
      }

      var currentIndex = links.indexOf(document.activeElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        links[(currentIndex + 1 + links.length) % links.length].focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        links[(currentIndex - 1 + links.length) % links.length].focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        links[0].focus();
      } else if (event.key === "End") {
        event.preventDefault();
        links[links.length - 1].focus();
      }
    });
  }

  function showEnglishNotice(targets) {
    if (isJapaneseBrowser() || readStorage("localStorage", LANGUAGE_STORAGE_KEY) || readStorage("sessionStorage", NOTICE_STORAGE_KEY)) {
      return;
    }

    var header = document.querySelector(".site-header");
    if (!header || !header.parentNode) {
      return;
    }

    var notice = document.createElement("aside");
    notice.className = "language-notice";
    notice.setAttribute("data-language-notice", "true");
    notice.setAttribute("role", "region");
    notice.setAttribute("aria-label", "English version");

    var copy = document.createElement("p");
    copy.className = "language-notice-copy";
    var copyStrong = document.createElement("strong");
    copyStrong.textContent = "English version available.";
    copy.appendChild(copyStrong);

    var actions = document.createElement("div");
    actions.className = "language-notice-actions";

    var link = document.createElement("a");
    link.className = "language-notice-link";
    link.href = targets.en;
    link.textContent = "View English site";
    link.addEventListener("click", function () {
      writeStorage("localStorage", LANGUAGE_STORAGE_KEY, "en");
    });

    var dismiss = document.createElement("button");
    dismiss.className = "language-notice-dismiss";
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "Close English version notice");
    dismiss.textContent = "×";
    dismiss.addEventListener("click", function () {
      writeStorage("sessionStorage", NOTICE_STORAGE_KEY, "1");
      notice.remove();
    });

    actions.appendChild(link);
    actions.appendChild(dismiss);
    notice.appendChild(copy);
    notice.appendChild(actions);

    if (window.getComputedStyle(header).position === "fixed") {
      notice.classList.add("language-notice-fixed-header");
    }
    header.parentNode.insertBefore(notice, header.nextSibling);
  }

  function initialize() {
    var currentPath = normalizePath(window.location.pathname);
    var storedLanguage = readStorage("localStorage", LANGUAGE_STORAGE_KEY);
    if (currentPath === "/" && storedLanguage === "en") {
      window.location.replace("/en/");
      return;
    }

    var targets = getRouteTargets(currentPath);
    var currentLanguage = isEnglishPath(currentPath) ? "en" : "ja";
    setupLanguageMenu(targets, currentLanguage);
    if (currentLanguage === "ja") {
      showEnglishNotice(targets);
    }
  }

  initialize();
})();
