/* ==========================================================================
   7RepWorkout.com - workout generator
   Renders the 8-week plan from js/workout-data.js and lets visitors edit
   the exercise for each muscle.

   Workouts:
   - Built-in presets come from WORKOUT_PRESETS ("Dumbbells Only", "Dumbbells + Bar").
     They can be edited and reset, but not renamed or deleted.
   - "New" copies the current workout under a new name. Each custom workout
     remembers which preset it started from.
   - Everything is saved in this browser. Only the differences from the preset are stored.

   The plan opens once the visitor has signed up (see signup.js).
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var data = window.WORKOUT_DATA;
  var PRESETS = window.WORKOUT_PRESETS;
  var weeks = data.weeks;

  // ---------- Sign-up gate ----------
  var SIGNUP_KEY = "7repworkout:signedup";

  function hasSignedUp() {
    try { return localStorage.getItem(SIGNUP_KEY) === "1"; } catch (e) { return false; }
  }

  function unlock() {
    $("gate").hidden = true;
    $("generator-area").hidden = false;
    window.scrollTo(0, 0);
  }

  document.addEventListener("sevenrep:signup", function () {
    try { localStorage.setItem(SIGNUP_KEY, "1"); } catch (e) { /* private mode: unlocks for this visit only */ }
    unlock();
  });

  if (hasSignedUp()) unlock();

  $("print-btn").addEventListener("click", function () { window.print(); });

  // ---------- Cover ----------
  $("cover-title").textContent = data["workout-name"];
  $("purpose").textContent = data.purpose;
  $("cover-desc").textContent = data.description;

  var totalSessions = weeks.reduce(function (n, w) { return n + w.days.length; }, 0);
  $("cover-meta").innerHTML = [
    [weeks.length, "Weeks"],
    [totalSessions, "Total sessions"],
    [weeks[0]["sets/reps"] + " → " + weeks[weeks.length - 1]["sets/reps"], "Progression"]
  ].map(function (pair) {
    return '<span class="meta-chip"><b>' + pair[0] + "</b> " + pair[1] + "</span>";
  }).join("");

  // Week jump nav
  $("weeknav").innerHTML = weeks.map(function (w) {
    return '<a href="#week-' + w["week-no"] + '">' +
      '<span class="wk-num">' + w["week-no"] + "</span>" +
      '<span class="wk-scheme">' + w["sets/reps"] + "</span></a>";
  }).join("");

  // ---------- Workouts, saved in this browser ----------
  // state = {
  //   current: "Dumbbells Only",
  //   workouts: {
  //     "Dumbbells Only":  { base: "Dumbbells Only",  exercises: {} },
  //     "Dumbbells + Bar": { base: "Dumbbells + Bar", exercises: {} },
  //     "My Gym Days":     { base: "Dumbbells + Bar", exercises: { Chest: ["Bench press"] } }
  //   }
  // }
  // "exercises" holds only the muscles that differ from the workout's base preset.
  var PRESET_NAMES = PRESETS.map(function (p) { return p.name; });
  var DEFAULT_NAME = PRESET_NAMES[0];
  var STORAGE_KEY = "7repworkout:workouts:v2";
  var OLD_KEY = "7repworkout:workouts"; // format used before presets existed
  var MUSCLES = Array.from(new Set(weeks.flatMap(function (w) {
    return w.days.flatMap(function (d) { return d.muscles.map(function (m) { return m.muscle; }); });
  })));

  function presetExercises(name) {
    var preset = PRESETS.filter(function (p) { return p.name === name; })[0] || PRESETS[0];
    return preset.exercises;
  }

  function readStored(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function isObject(v) { return v && typeof v === "object" && !Array.isArray(v); }

  // Workouts saved before presets existed were all based on the original exercise list,
  // which is now the preset marked "original" in workout-data.js.
  function migrateOld() {
    var old = readStored(OLD_KEY);
    if (!isObject(old) || !isObject(old.workouts)) return null;
    var original = (PRESETS.filter(function (p) { return p.original; })[0] || PRESETS[0]).name;
    var workouts = {};
    Object.keys(old.workouts).forEach(function (name) {
      var target = name === "Simple Workout" ? original : name;
      workouts[target] = { base: original, exercises: old.workouts[name] };
    });
    return { current: old.current === "Simple Workout" ? original : old.current, workouts: workouts };
  }

  function loadState() {
    var s = readStored(STORAGE_KEY);
    if (!isObject(s) || !isObject(s.workouts)) s = migrateOld() || { current: DEFAULT_NAME, workouts: {} };

    // Presets always exist and are listed first; anything else follows in its saved order.
    var workouts = {};
    PRESETS.forEach(function (p) {
      var saved = s.workouts[p.name];
      workouts[p.name] = { base: p.name, exercises: isObject(saved) && isObject(saved.exercises) ? saved.exercises : {} };
    });
    Object.keys(s.workouts).forEach(function (name) {
      var w = s.workouts[name];
      if (name in workouts || !isObject(w)) return;
      workouts[name] = {
        base: PRESET_NAMES.indexOf(w.base) !== -1 ? w.base : DEFAULT_NAME,
        exercises: isObject(w.exercises) ? w.exercises : {}
      };
    });

    return { current: s.current in workouts ? s.current : DEFAULT_NAME, workouts: workouts };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.removeItem(OLD_KEY);
    } catch (e) { /* storage unavailable: changes last until reload */ }
  }

  var state = loadState();

  function current() { return state.workouts[state.current]; }
  function overrides() { return current().exercises; }
  function baseExercises() { return presetExercises(current().base); }
  function exercisesFor(m) {
    var o = overrides()[m.muscle];
    return o !== undefined ? o : (baseExercises()[m.muscle] || m.exercises);
  }

  // Exercise names come from the form, so escape them before they go into HTML
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // One day's table: a numbered row per exercise
  function dayHTML(day, title) {
    // One numbered group per muscle: the # and Muscle cells span all of its exercise rows
    var rows = day.muscles.map(function (m, i) {
      var list = exercisesFor(m);
      return list.map(function (exercise, j) {
        return "<tr" + (j === 0 ? ' class="group-start"' : "") + ">" +
          (j === 0
            ? '<td class="col-num mono" rowspan="' + list.length + '">' + (i + 1) + "</td>" +
              '<td class="muscle-name" rowspan="' + list.length + '">' + m.muscle + "</td>"
            : "") +
          '<td class="exercise-name">' + esc(exercise) + "</td>" +
          '<td class="col-fill"><span class="fill-line"></span></td></tr>';
      }).join("");
    }).join("");

    return '<div class="day-card">' +
      '<div class="day-title">' + title + "</div>" +
      '<div class="table-scroll"><table class="exercise-table">' +
      '<thead><tr><th class="col-num">#</th><th>Muscle</th><th>Exercise</th><th class="col-fill">Weight</th></tr></thead>' +
      "<tbody>" + rows + "</tbody></table></div></div>";
  }

  function weekHTML(week) {
    var days = week.days.map(function (d) {
      return dayHTML(d, week.days.length > 1 ? "Day " + d["day-no"] : "Session");
    }).join("");

    return '<section class="week" id="week-' + week["week-no"] + '">' +
      '<div class="week-head">' +
      '<div><span class="week-tag">Week</span><span class="week-num">' + week["week-no"] + "</span></div>" +
      '<div><span class="week-label">Target Sets &times; Reps</span><span class="scheme-badge mono">' + week["sets/reps"] + "</span></div>" +
      "</div>" +
      '<div class="days">' + days + "</div></section>";
  }

  // Weeks 1-4 and 5-8 go in separate sheets so print can break the page between them
  function renderWeeks() {
    $("sheet1").innerHTML = weeks.filter(function (w) { return w["week-no"] <= 4; }).map(weekHTML).join("");
    $("sheet2").innerHTML = weeks.filter(function (w) { return w["week-no"] > 4; }).map(weekHTML).join("");
  }

  // ---------- Editor form ----------
  var form = $("editor-form");

  $("editor-grid").innerHTML = MUSCLES.map(function (m) {
    return "<label>" + m + '<input type="text" name="' + m + '" autocomplete="off"></label>';
  }).join("");

  var select = $("workout-select");
  var nameInput = $("workout-name-input");
  function isPreset() { return PRESET_NAMES.indexOf(state.current) !== -1; }
  function sameLists(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  // ---------- Top row: name or dropdown, and only the buttons that apply ----------
  function renderPicker() {
    var names = Object.keys(state.workouts);
    var several = names.length > 1;
    $("workout-title").hidden = several;
    $("workout-title").textContent = state.current;
    select.hidden = !several;
    select.replaceChildren.apply(select, names.map(function (n) { return new Option(n, n, false, n === state.current); }));
    $("workout-rename").hidden = $("workout-delete").hidden = isPreset(); // presets can't be renamed or deleted
    $("workout-subtitle").textContent = state.current;
  }

  // ---------- Exercise fields ----------
  function fillFields() {
    MUSCLES.forEach(function (m) {
      form.elements[m].value = exercisesFor({ muscle: m, exercises: [] }).join(", ");
    });
    refreshFields();
  }

  // The form's exercises, keeping only muscles that differ from this workout's base preset
  function readExercises() {
    var base = baseExercises();
    var result = {};
    MUSCLES.forEach(function (m) {
      var list = form.elements[m].value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      if (list.join("|") !== (base[m] || []).join("|")) result[m] = list;
    });
    return result;
  }

  function isDirty() { return !sameLists(readExercises(), overrides()); }

  // Outline fields that differ from the preset, and show Update / Reset only when they'd do something
  function refreshFields() {
    var edited = readExercises();
    MUSCLES.forEach(function (m) { form.elements[m].classList.toggle("custom", m in edited); });
    $("editor-update").hidden = !isDirty();
    $("editor-reset").hidden = Object.keys(edited).length === 0;
    var n = Object.keys(overrides()).length;
    $("editor-count").textContent = "· " + state.current + (n ? " · " + n + " customized" : "");
  }

  function render() {
    renderPicker();
    renderWeeks();
    fillFields();
  }

  var statusTimer;
  function showStatus(text, isError) {
    var el = $("editor-status");
    el.textContent = text;
    el.classList.toggle("error", !!isError);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { el.textContent = ""; }, isError ? 5000 : 3000);
  }

  function commit(message) {
    saveState();
    render();
    showStatus(message);
  }

  $("editor-grid").addEventListener("input", refreshFields);

  // Update: save the exercises
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    current().exercises = readExercises();
    commit("Workout saved.");
  });

  $("editor-reset").addEventListener("click", function () {
    current().exercises = {};
    commit("Exercises reset to the " + current().base + " preset.");
  });

  // ---------- Naming step (New and Rename) ----------
  var namingMode = null; // "new" | "rename" | null

  function startNaming(mode) {
    namingMode = mode;
    $("picker-view").hidden = true;
    $("picker-naming").hidden = false;
    nameInput.value = mode === "rename" ? state.current : "";
    nameInput.placeholder = mode === "new" ? "Name your new workout" : "";
    nameInput.focus();
    nameInput.select();
  }

  function stopNaming() {
    namingMode = null;
    $("picker-view").hidden = false;
    $("picker-naming").hidden = true;
  }

  function saveName() {
    var name = nameInput.value.trim();
    if (namingMode === "rename" && name === state.current) return stopNaming();
    if (!name) return showStatus("Give the workout a name.", true);
    if (name in state.workouts) return showStatus("A workout named “" + name + "” already exists.", true);

    if (namingMode === "new") {
      // The new workout starts as a copy of what's in the form, including unsaved edits
      state.workouts[name] = { base: current().base, exercises: readExercises() };
      state.current = name;
      stopNaming();
      commit("Created “" + name + "”.");
    } else {
      // Rename in place so it keeps its position in the list
      var renamed = {};
      Object.keys(state.workouts).forEach(function (k) {
        renamed[k === state.current ? name : k] = state.workouts[k];
      });
      state.workouts = renamed;
      state.current = name;
      stopNaming();
      saveState();
      renderPicker();
      refreshFields();
      showStatus("Renamed.");
    }
  }

  $("workout-new").addEventListener("click", function () { startNaming("new"); });
  $("workout-rename").addEventListener("click", function () { startNaming("rename"); });
  $("name-save").addEventListener("click", saveName);
  $("name-cancel").addEventListener("click", function () { stopNaming(); showStatus(""); });

  // In the name box, Enter saves the name (instead of submitting the exercises) and Escape cancels
  nameInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); saveName(); }
    if (e.key === "Escape") { e.preventDefault(); stopNaming(); }
  });

  // ---------- Delete and switch ----------
  $("workout-delete").addEventListener("click", function () {
    if (isPreset() || !confirm("Delete “" + state.current + "”?")) return;
    delete state.workouts[state.current];
    state.current = DEFAULT_NAME;
    commit("Workout deleted.");
  });

  select.addEventListener("change", function () {
    if (isDirty() && !confirm("You have unsaved changes. Discard them?")) {
      select.value = state.current;
      return;
    }
    state.current = select.value;
    saveState();
    render();
    showStatus("");
  });

  // Warn before leaving the page with unsaved edits
  window.addEventListener("beforeunload", function (e) { if (isDirty()) e.preventDefault(); });

  render();
})();
