/* ==========================================================================
   7RepWorkout.com - assessment pop-up
   Every link marked data-assess opens a short quiz ("Is 7RepWorkout right for you?").
   The result screen has a "Get my workout" button that goes to generator.html.

   - Answers are saved in this browser (localStorage) when the quiz is finished.
   - signup.js sends them with the sign-up form, then removes them.
   - Visitors who already signed up skip the quiz and go straight to the generator.
   - No health questions are asked.
   ========================================================================== */
(function () {
  "use strict";

  var data = window.ASSESSMENT;
  var dialog = document.getElementById("assessment-dialog");
  var root = document.getElementById("assessment-root");
  if (!data || !dialog || !root) return;

  // Keep these two keys in step with signup.js and generator.js
  var ANSWERS_KEY = "7repworkout:assessment";
  var SIGNUP_KEY = "7repworkout:signedup";

  var questions = data.questions;
  var total = questions.length;
  var step = 0;      // 0..total-1 = a question, total = the result screen
  var answers = {};  // { q1: "gap", q5: ["startstop", "hurt"], ... }

  // ---------- storage (always in try/catch: it can be blocked or full) ----------
  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* the quiz still works this visit */ }
  }
  function removeKey(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
  function hasSignedUp() {
    try { return localStorage.getItem(SIGNUP_KEY) === "1"; } catch (e) { return false; }
  }

  // ---------- helpers ----------
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function selectedOptions(q) {
    var a = answers[q.id];
    var ids = Array.isArray(a) ? a : (a ? [a] : []);
    return q.options.filter(function (o) { return ids.indexOf(o.id) !== -1; });
  }

  function isAnswered(q) {
    return selectedOptions(q).length > 0;
  }

  // ---------- scoring ----------
  function evaluate() {
    var score = 0;
    var flagged = [];
    var notes = [];
    questions.forEach(function (q) {
      var chosen = selectedOptions(q);
      var qScore = chosen.reduce(function (n, o) { return n + (o.score || 0); }, 0);
      if (q.maxScore !== undefined) qScore = Math.min(qScore, q.maxScore);
      score += qScore;
      chosen.forEach(function (o) {
        if (o.flag) flagged.push(o);
        else if (o.note) notes.push(o.note);
      });
    });

    var tier;
    if (flagged.length) tier = "notfit";
    else if (score >= data.thresholds.great) tier = "great";
    else if (score >= data.thresholds.probable) tier = "probable";
    else tier = "notfit";

    return { tier: tier, score: score, flagged: flagged, notes: notes };
  }

  // ---------- views ----------
  function questionHTML() {
    var q = questions[step];
    var multi = q.type === "multi";
    var chosen = answers[q.id];
    var chosenIds = Array.isArray(chosen) ? chosen : (chosen ? [chosen] : []);

    var options = q.options.map(function (o, i) {
      var checked = chosenIds.indexOf(o.id) !== -1 ? " checked" : "";
      var id = "opt-" + q.id + "-" + i;
      return '<label class="option' + (multi ? " option-multi" : "") + '" for="' + id + '">' +
        '<input type="' + (multi ? "checkbox" : "radio") + '" name="' + q.id + '" id="' + id +
        '" value="' + esc(o.id) + '"' + checked + ">" +
        "<span>" + esc(o.text) + "</span></label>";
    }).join("");

    var last = step === total - 1;
    return '<div class="assess-head">' +
        '<span class="assess-count mono">Question ' + (step + 1) + " of " + total + "</span>" +
        '<progress max="' + total + '" value="' + (step + 1) + '" aria-label="Progress"></progress>' +
      "</div>" +
      '<fieldset class="assess-q"><legend>' + esc(q.text) + "</legend>" +
      (q.hint ? '<p class="assess-hint">' + esc(q.hint) + "</p>" : "") +
      options + "</fieldset>" +
      '<div class="assess-actions">' +
        (step > 0 ? '<button type="button" class="btn btn-ghost" data-assess-back>Back</button>' : "<span></span>") +
        '<button type="button" class="btn" data-assess-next' + (isAnswered(q) ? "" : " disabled") + ">" +
          (last ? "See my result" : "Next") + "</button>" +
      "</div>";
  }

  var RESULT_COPY = {
    great: {
      title: "This was built for you",
      text: "Your answers match who 7RepWorkout was made for: a steady plan that starts light, fits in under an hour, and adds progress every week."
    },
    probable: {
      title: "Probably a good fit",
      text: "Most of your answers match who 7RepWorkout was made for: a steady plan that starts light, fits in under an hour, and adds progress every week."
    },
    notfit: {
      title: "This may not be your best fit",
      text: "7RepWorkout is built for people who haven't worked out in a year or two, don't have hours to spare, and want steady progress without lifting to the max. That's okay, not every workout is for everyone."
    }
  };

  function resultHTML() {
    var r = evaluate();
    var copy = RESULT_COPY[r.tier];
    var items, heading, tail = "";

    if (r.tier === "notfit") {
      items = r.flagged.map(function (o) { return o.note; }).concat(r.notes);
      heading = "Why";
      tail = '<p class="result-kind">You\'re welcome to try it anyway. It only takes a minute to look.</p>';
    } else {
      items = r.notes;
      heading = "Good to know";
    }

    var list = items.length
      ? '<h4 class="result-sub">' + heading + "</h4><ul class=\"result-notes\">" +
        items.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>"
      : "";

    return '<p class="result-badge result-' + r.tier + '">Your result</p>' +
      '<h3 class="result-title" id="result-title" tabindex="-1">' + copy.title + "</h3>" +
      '<p class="result-text">' + copy.text + "</p>" + list + tail +
      '<div class="assess-actions result-actions">' +
        '<button type="button" class="link-btn" data-assess-retake>Retake the quiz</button>' +
        '<a class="btn" href="generator.html">Get my workout</a>' +
      "</div>";
  }

  function render() {
    root.innerHTML = step >= total ? resultHTML() : questionHTML();
    var focusTarget = step >= total
      ? root.querySelector("#result-title")
      : (root.querySelector("input:checked") || root.querySelector("input"));
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  // ---------- actions ----------
  function finish() {
    var r = evaluate();
    writeJSON(ANSWERS_KEY, {
      version: data.version,
      completedAt: new Date().toISOString(),
      result: r.tier,
      score: r.score,
      answers: answers
    });
    step = total;
    render();
  }

  function next() {
    if (!isAnswered(questions[step])) return;
    if (step === total - 1) finish();
    else { step += 1; render(); }
  }

  function back() {
    if (step > 0) { step -= 1; render(); }
  }

  function retake() {
    removeKey(ANSWERS_KEY);
    answers = {};
    step = 0;
    render();
  }

  // One listener for everything inside the pop-up (the content is re-rendered each step)
  root.addEventListener("click", function (e) {
    var t = e.target.closest("[data-assess-next],[data-assess-back],[data-assess-retake]");
    if (!t) return;
    if (t.hasAttribute("data-assess-next")) next();
    else if (t.hasAttribute("data-assess-back")) back();
    else retake();
  });

  root.addEventListener("change", function (e) {
    var input = e.target;
    if (!input || input.tagName !== "INPUT") return;
    var q = questions[step];
    if (!q || input.name !== q.id) return;

    if (q.type === "multi") {
      var option = q.options.filter(function (o) { return o.id === input.value; })[0];
      var current = Array.isArray(answers[q.id]) ? answers[q.id].slice() : [];
      if (input.checked) {
        // "None of these" clears the others, and any other choice clears "None of these"
        current = option && option.exclusive
          ? [input.value]
          : current.filter(function (id) {
              var o = q.options.filter(function (x) { return x.id === id; })[0];
              return !(o && o.exclusive);
            }).concat(input.value);
      } else {
        current = current.filter(function (id) { return id !== input.value; });
      }
      if (current.length) answers[q.id] = current; else delete answers[q.id];
      // Reflect the exclusive rule in the checkboxes without re-rendering
      root.querySelectorAll('input[name="' + q.id + '"]').forEach(function (el) {
        el.checked = current.indexOf(el.value) !== -1;
      });
    } else {
      answers[q.id] = input.value;
    }

    var nextBtn = root.querySelector("[data-assess-next]");
    if (nextBtn) nextBtn.disabled = !isAnswered(q);
  });

  // ---------- opening ----------
  function openDialog() {
    var saved = readJSON(ANSWERS_KEY);
    if (saved && saved.version === data.version && saved.answers && typeof saved.answers === "object") {
      // Finished before: show the result again (with a Retake link)
      answers = saved.answers;
      step = total;
    }
    render();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    render(); // re-focus now that the pop-up is visible
  }

  document.querySelectorAll("a[data-assess]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      // Let new-tab clicks and already-signed-up visitors go straight to the generator
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (hasSignedUp()) return;
      e.preventDefault();
      openDialog();
    });
  });
})();
