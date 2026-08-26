(function () {
  "use strict";

  var root = document.documentElement;
  var header = document.querySelector("[data-site-header]");
  var hero = document.querySelector("[data-hero-scene]");
  var heroCopy = document.querySelector("[data-hero-copy]");
  var heroRoute = document.querySelector("[data-hero-route]");
  var story = document.querySelector("[data-product-story]");
  var phoneStage = document.querySelector("[data-phone-stage]");
  var productLabel = document.querySelector("[data-product-label]");
  var progressBar = document.querySelector("[data-story-progress-bar]");
  var steps = Array.prototype.slice.call(document.querySelectorAll("[data-story-step]"));
  var screens = Array.prototype.slice.call(document.querySelectorAll("[data-screen]"));
  var homeHero = document.querySelector("[data-home-hero]");
  var homeHeroCopy = document.querySelector("[data-home-hero-copy]");
  var homeHeroRoute = document.querySelector("[data-home-hero-route]");
  var homeApps = document.querySelector("[data-home-apps]");
  var homeAppIcon = document.querySelector("[data-home-app-icon]");
  var homeRevealTargets = Array.prototype.slice.call(document.querySelectorAll("[data-home-reveal]"));
  var reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var ticking = false;
  var activeStep = 0;
  var homeRevealObserver = null;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function mix(from, to, progress) {
    return from + (to - from) * progress;
  }

  function setAppStoreLink() {
    var links = Array.prototype.slice.call(document.querySelectorAll("[data-app-store-link]"));
    var config = window.HIRO_APP_WORKS_CONFIG;
    var value = config && config.apps && config.apps.consignmentNote
      ? config.apps.consignmentNote.appStoreUrl
      : "";
    var url = typeof value === "string" ? value.trim() : "";

    if (links.length === 0 || !/^https:\/\/apps\.apple\.com\//i.test(url)) {
      return;
    }

    links.forEach(function (link) {
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.classList.remove("is-disabled");
      link.removeAttribute("aria-disabled");
    });
  }

  function activateStep(index) {
    var nextIndex = clamp(index, 0, steps.length - 1);

    if (nextIndex === activeStep && story && story.dataset.activeStep === String(nextIndex)) {
      return;
    }

    activeStep = nextIndex;

    if (story) {
      story.dataset.activeStep = String(nextIndex);
    }

    steps.forEach(function (step, stepIndex) {
      step.classList.toggle("is-active", stepIndex === nextIndex);
    });

    screens.forEach(function (screen, screenIndex) {
      var isActive = screenIndex === nextIndex;
      screen.classList.toggle("is-active", isActive);
      screen.setAttribute("aria-hidden", isActive ? "false" : "true");
    });
  }

  function updateHeader() {
    if (header) {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    }
  }

  function updateHomeHero(viewportHeight) {
    if (!homeHero || !homeHeroCopy || !homeHeroRoute) {
      return;
    }

    var rect = homeHero.getBoundingClientRect();
    var progress = clamp(-rect.top / Math.max(viewportHeight, 1), 0, 1);
    var eased = 1 - Math.pow(1 - progress, 3);

    homeHeroCopy.style.setProperty("--hero-y", mix(0, -34, eased).toFixed(2) + "px");
    homeHeroCopy.style.setProperty("--hero-scale", mix(1, 0.96, eased).toFixed(4));
    homeHeroCopy.style.setProperty("--home-hero-opacity", mix(1, 0.54, progress).toFixed(3));
    homeHeroCopy.style.setProperty("--hero-description-opacity", mix(1, 0.18, progress).toFixed(3));
    homeHeroCopy.style.setProperty("--hero-description-y", mix(0, -12, progress).toFixed(2) + "px");
    homeHeroRoute.style.setProperty("--hero-route-x", mix(0, -24, eased).toFixed(2) + "px");
    homeHeroRoute.style.setProperty("--hero-route-opacity", mix(0.75, 0.24, progress).toFixed(3));
    homeHero.style.setProperty("--scroll-cue-opacity", mix(1, 0, clamp(progress * 2.2, 0, 1)).toFixed(3));
  }

  function updateHomeAppParallax() {
    if (!homeApps || !homeAppIcon) {
      return;
    }

    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    var rect = homeApps.getBoundingClientRect();
    var range = Math.max(viewportHeight + rect.height, 1);
    var progress = clamp((viewportHeight - rect.top) / range, 0, 1);
    var iconY = mix(18, -12, progress);

    homeAppIcon.style.setProperty("--home-app-icon-y", iconY.toFixed(2) + "px");
  }

  function updateHero(viewportHeight) {
    if (!hero || !heroCopy || !heroRoute) {
      return;
    }

    var rect = hero.getBoundingClientRect();
    var range = Math.max(rect.height - viewportHeight, 1);
    var progress = clamp(-rect.top / range, 0, 1);
    var eased = 1 - Math.pow(1 - progress, 3);

    heroCopy.style.setProperty("--hero-y", mix(0, -58, eased).toFixed(2) + "px");
    heroCopy.style.setProperty("--hero-scale", mix(1, 0.91, eased).toFixed(4));
    heroCopy.style.setProperty("--hero-description-opacity", mix(1, 0.16, progress).toFixed(3));
    heroCopy.style.setProperty("--hero-description-y", mix(0, -20, progress).toFixed(2) + "px");
    heroRoute.style.setProperty("--hero-route-x", mix(0, -46, eased).toFixed(2) + "px");
    heroRoute.style.setProperty("--hero-route-opacity", mix(0.75, 0.22, progress).toFixed(3));
    hero.style.setProperty("--scroll-cue-opacity", mix(1, 0, clamp(progress * 2.7, 0, 1)).toFixed(3));
  }

  function findNearestStep(viewportHeight) {
    var target = viewportHeight * 0.5;
    var nearestIndex = activeStep;
    var nearestDistance = Infinity;

    steps.forEach(function (step, index) {
      var rect = step.getBoundingClientRect();
      var center = rect.top + rect.height * 0.5;
      var distance = Math.abs(center - target);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  }

  function updateStory(viewportHeight) {
    if (!story || !phoneStage || steps.length === 0) {
      return;
    }

    var rect = story.getBoundingClientRect();
    var range = Math.max(rect.height - viewportHeight, 1);
    var progress = clamp(-rect.top / range, 0, 1);
    var point = progress * (steps.length - 1);
    var startIndex = Math.min(Math.floor(point), steps.length - 1);
    var endIndex = Math.min(startIndex + 1, steps.length - 1);
    var localProgress = point - startIndex;
    var maxShift = Math.min(window.innerWidth * 0.035, 42);
    var xPositions = [maxShift * 0.35, -maxShift, maxShift * 0.7, -maxShift * 0.4];
    var yPositions = [18, 3, 10, 20];
    var scales = [0.92, 1.02, 0.98, 0.94];
    var rotations = [0, -0.45, 0.7, 0];
    var currentIndex = findNearestStep(viewportHeight);

    phoneStage.style.setProperty("--phone-x", mix(xPositions[startIndex], xPositions[endIndex], localProgress).toFixed(2) + "px");
    phoneStage.style.setProperty("--phone-y", mix(yPositions[startIndex], yPositions[endIndex], localProgress).toFixed(2) + "px");
    phoneStage.style.setProperty("--phone-scale", mix(scales[startIndex], scales[endIndex], localProgress).toFixed(4));
    phoneStage.style.setProperty("--phone-rotate", mix(rotations[startIndex], rotations[endIndex], localProgress).toFixed(3) + "deg");
    story.style.setProperty("--story-progress", progress.toFixed(4));

    if (progressBar) {
      progressBar.style.setProperty("--story-progress", progress.toFixed(4));
    }

    if (productLabel) {
      productLabel.style.setProperty("--product-label-opacity", mix(1, 0.26, clamp(progress * 1.9, 0, 1)).toFixed(3));
      productLabel.style.setProperty("--product-label-y", mix(0, -8, clamp(progress * 1.9, 0, 1)).toFixed(2) + "px");
    }

    activateStep(currentIndex);
  }

  function update() {
    ticking = false;
    updateHeader();

    if (reduceMotionQuery.matches) {
      return;
    }

    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    updateHomeHero(viewportHeight);
    updateHomeAppParallax();
    updateHero(viewportHeight);
    updateStory(viewportHeight);
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  function observeSteps() {
    if (!("IntersectionObserver" in window)) {
      steps.forEach(function (step) {
        step.classList.add("has-entered");
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("has-entered");
        }
      });
    }, {
      rootMargin: "18% 0px 18% 0px",
      threshold: 0.05,
    });

    steps.forEach(function (step) {
      observer.observe(step);
    });
  }

  function setHomeRevealsVisible(isVisible) {
    homeRevealTargets.forEach(function (target) {
      target.classList.toggle("is-visible", isVisible);
    });
  }

  function observeHomeReveals() {
    if (homeRevealObserver) {
      homeRevealObserver.disconnect();
      homeRevealObserver = null;
    }

    if (homeRevealTargets.length === 0) {
      return;
    }

    if (reduceMotionQuery.matches || !("IntersectionObserver" in window)) {
      setHomeRevealsVisible(true);
      return;
    }

    setHomeRevealsVisible(false);
    homeRevealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.1,
    });

    homeRevealTargets.forEach(function (target) {
      homeRevealObserver.observe(target);
    });
  }

  function resetMotionStyles() {
    [heroCopy, heroRoute, phoneStage, productLabel, story, progressBar, homeHero, homeHeroCopy, homeHeroRoute, homeAppIcon].forEach(function (element) {
      if (element) {
        element.removeAttribute("style");
      }
    });
    observeHomeReveals();
    activateStep(0);
    requestUpdate();
  }

  root.classList.add("has-js");
  setAppStoreLink();
  observeSteps();
  observeHomeReveals();
  activateStep(0);
  update();

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });

  if (typeof reduceMotionQuery.addEventListener === "function") {
    reduceMotionQuery.addEventListener("change", resetMotionStyles);
  } else if (typeof reduceMotionQuery.addListener === "function") {
    reduceMotionQuery.addListener(resetMotionStyles);
  }
})();
