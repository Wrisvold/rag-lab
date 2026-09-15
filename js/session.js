// Keeps the document and dial settings alive across a page reload.
// Uses sessionStorage (cleared when the tab closes). Every call is wrapped in
// try/catch: private windows and locked-down browsers may refuse it, and the
// app must work without it.

export function loadSession(key) {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(key, value) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Nothing to do; the run simply will not survive a reload.
  }
}
