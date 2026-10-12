/* ==========================================================================
   7RepWorkout.com - sign-up form
   Two modes, switched by the link under the form title:
     Sign up    - name, phone, email, consent  -> POST /api/subscribe
     Returning  - email only                   -> POST /api/lookup
   An email that is already signed up is let straight in (no second record).
   Success is announced with a "sevenrep:signup" event on document.
   ========================================================================== */
(function () {
  "use strict";

  var form = document.getElementById("signup-form");
  if (!form) return;

  var config = window.SEVENREP_CONFIG || {};
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var statusEl = form.querySelector(".form-status");
  var submitBtn = form.querySelector('button[type="submit"]');
  var titleEl = form.querySelector("[data-form-title]");
  var switchLead = form.querySelector("[data-form-switch-lead]");
  var switchBtn = form.querySelector("[data-form-switch]");

  var COPY = {
    signup:    { title: "Get started",  submit: "Unlock my workout", lead: "Already signed up?", link: "Enter your email only" },
    returning: { title: "Welcome back", submit: "Open my workout",   lead: "New here?",          link: "Sign up" }
  };
  var returning = false;

  // ---------- the visitor's finished assessment (saved by assessment.js) ----------
  // Keep this key in step with assessment.js. No health data.
  var ANSWERS_KEY = "7repworkout:assessment";

  function readAssessment() {
    try {
      var saved = JSON.parse(localStorage.getItem(ANSWERS_KEY));
      if (saved && typeof saved === "object" && saved.answers && typeof saved.answers === "object") {
        return {
          answers: saved.answers,
          result: saved.result,
          score: saved.score,
          completedAt: saved.completedAt
        };
      }
    } catch (e) { /* none saved, or storage blocked */ }
    return null;
  }

  function clearAssessment() {
    try { localStorage.removeItem(ANSWERS_KEY); } catch (e) { /* ignore */ }
  }

  // ---------- small helpers ----------
  function apiBase() {
    return String(config.API_BASE_URL || "/api").replace(/\/+$/, "");
  }

  function setStatus(state, message) {
    statusEl.dataset.state = state || "";
    statusEl.textContent = message || "";
  }

  function setFieldError(name, message) {
    var input = form.elements[name];
    var slot = form.querySelector('[data-error-for="' + name + '"]');
    if (slot) slot.textContent = message || "";
    if (input && input.setAttribute) {
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  function clearErrors() {
    ["name", "phone", "email", "consent", "captcha"].forEach(function (n) { setFieldError(n, ""); });
  }

  function digitsOnly(value) {
    return String(value).replace(/\D/g, "");
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? "Sending..." : COPY[returning ? "returning" : "signup"].submit;
    form.setAttribute("aria-busy", busy ? "true" : "false");
  }

  // ---------- sign-up / returning mode ----------
  function setMode(isReturning) {
    returning = isReturning;
    var copy = COPY[returning ? "returning" : "signup"];
    form.querySelectorAll("[data-signup-only]").forEach(function (el) { el.hidden = returning; });
    titleEl.textContent = copy.title;
    submitBtn.textContent = copy.submit;
    switchLead.textContent = copy.lead;
    switchBtn.textContent = copy.link;
    clearErrors();
    setStatus("", "");
  }

  switchBtn.addEventListener("click", function () {
    setMode(!returning);
    (returning ? form.elements.email : form.elements.name).focus();
  });

  // ---------- CAPTCHA (Cloudflare Turnstile) ----------
  // Shown only when a site key is set in config.js. The token it produces is checked by the backend.
  var siteKey = config.TURNSTILE_SITE_KEY || "";
  var captchaBox = document.getElementById("captcha");
  var captchaToken = "";
  var widgetId = null;

  function loadCaptcha() {
    if (!siteKey || !captchaBox) return;
    captchaBox.hidden = false;
    var script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = function () {
      if (!window.turnstile) return;
      widgetId = window.turnstile.render(captchaBox, {
        sitekey: siteKey,
        theme: "light",
        callback: function (token) { captchaToken = token; setFieldError("captcha", ""); },
        "expired-callback": function () { captchaToken = ""; },
        "error-callback": function () { captchaToken = ""; }
      });
    };
    script.onerror = function () {
      setFieldError("captcha", "The verification check couldn't load. Turn off any ad blocker and reload the page.");
    };
    document.head.appendChild(script);
  }

  // A token works once, so get a fresh one after every attempt that didn't succeed.
  function resetCaptcha() {
    captchaToken = "";
    if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
  }

  // ---------- validation ----------
  // Returns true when every visible field is valid; shows an error under each bad one.
  function validate() {
    var ok = true;

    if (!returning) {
      var name = form.elements.name.value.trim();
      setFieldError("name", name ? "" : "Please enter your name.");
      if (!name) ok = false;

      var phoneDigits = digitsOnly(form.elements.phone.value);
      var phoneOk = phoneDigits.length >= 10 && phoneDigits.length <= 15;
      setFieldError("phone", phoneOk ? "" : "Please enter a valid phone number (at least 10 digits).");
      if (!phoneOk) ok = false;
    }

    var emailOk = EMAIL_RE.test(form.elements.email.value.trim());
    setFieldError("email", emailOk ? "" : "Please enter a valid email address.");
    if (!emailOk) ok = false;

    if (!returning) {
      var consentOk = form.elements.consent.checked;
      setFieldError("consent", consentOk ? "" : "Please check the box to continue.");
      if (!consentOk) ok = false;
    }

    var captchaOk = !siteKey || Boolean(captchaToken);
    setFieldError("captcha", captchaOk ? "" : "Please complete the verification check.");
    if (!captchaOk) ok = false;

    if (!ok) {
      var firstBad = form.querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
    }
    return ok;
  }

  function succeed(message) {
    setStatus("ok", message);
    document.dispatchEvent(new CustomEvent("sevenrep:signup"));
  }

  function postJSON(path, payload) {
    return fetch(apiBase() + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(body.message || "Something went wrong (" + res.status + "). Please try again.");
        return body;
      });
    });
  }

  // ---------- submit ----------
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    setStatus("", "");
    if (!validate()) return;

    // Honeypot: bots fill it in. Pretend it worked, send nothing.
    if (form.elements.website.value) return succeed("You're in! Opening your workout...");

    var email = form.elements.email.value.trim();
    var wasReturning = returning;
    var payload;

    if (wasReturning) {
      payload = { email: email, captchaToken: captchaToken };
    } else {
      payload = {
        name: form.elements.name.value.trim(),
        phone: form.elements.phone.value.trim(),
        email: email,
        consent: true,
        source: form.dataset.source || "website",
        captchaToken: captchaToken
      };
      var assessment = readAssessment();
      if (assessment) payload.assessment = assessment;
    }

    setBusy(true);
    setStatus("busy", "Sending...");

    postJSON(wasReturning ? "/lookup" : "/subscribe", payload)
      .then(function (body) {
        setBusy(false);

        if (wasReturning && body.found !== true) {
          // Not in the database: switch to the full form, keeping the email they typed.
          resetCaptcha();
          setMode(false);
          setStatus("error", "We couldn't find that email. Please sign up below.");
          form.elements.name.focus();
          return;
        }

        if (!wasReturning) clearAssessment(); // sent with the sign-up, so it no longer needs to be kept here
        var back = wasReturning || body.status === "existing";
        succeed(back ? "Welcome back! Opening your workout..." : "You're in! Opening your workout...");
      })
      .catch(function (err) {
        setBusy(false);
        resetCaptcha();
        var offline = err instanceof TypeError;
        setStatus("error", offline ? "Couldn't reach the server. Check your connection and try again." : err.message);
      });
  });

  // Clear a field's error as soon as the visitor edits it.
  form.addEventListener("input", function (event) {
    var name = event.target && event.target.name;
    if (name) setFieldError(name, "");
  });

  loadCaptcha();
})();
