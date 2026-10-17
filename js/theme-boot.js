// Runs in <head>, before the page draws, so a saved theme causes no flash.
// The choice stays in this browser. js/theme.js draws the control.
(function () {
  try {
    var choice = window.localStorage.getItem('rag-lab-theme');
    if (choice === 'light' || choice === 'dark') document.documentElement.setAttribute('data-theme', choice);
  } catch (error) { /* storage blocked: follow the setting of the computer */ }
}());
