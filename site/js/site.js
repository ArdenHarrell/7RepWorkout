/* Shared page behavior: footer year, and pop-up dialogs. */
(function () {
  "use strict";

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Pop-ups: any button with data-open-dialog="<id>" opens that <dialog>.
  // They close with the X or "Got it" (data-close-dialog), the Esc key (built in), or a click outside.
  function openDialog(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  document.querySelectorAll("[data-open-dialog]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dialog = document.getElementById(btn.getAttribute("data-open-dialog"));
      if (dialog) openDialog(dialog);
    });
  });

  document.querySelectorAll("dialog").forEach(function (dialog) {
    dialog.querySelectorAll("[data-close-dialog]").forEach(function (btn) {
      btn.addEventListener("click", function () { closeDialog(dialog); });
    });
    // The dialog has no padding of its own, so a click on the dialog element itself is a click on the backdrop.
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeDialog(dialog);
    });
  });
})();
