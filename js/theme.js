// The theme control in the header: System, Light, or Dark.
// System follows the setting of the computer (prefers-color-scheme in styles.css).
// The choice stays in this browser (localStorage) and never leaves it.
// js/theme-boot.js applies a saved choice before the page draws.

import { THEME } from './copy.js';
import { THEME_STORAGE_KEY } from './constants.js';
import { el } from './dom.js';

const CHOICES = ['system', 'light', 'dark'];

export function readTheme() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return CHOICES.includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === 'light' || choice === 'dark') root.setAttribute('data-theme', choice);
  else root.removeAttribute('data-theme');
  try {
    if (choice === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch { /* storage blocked: the choice lasts until the page closes */ }
}

/** Add the control to the header of the page. */
export function mountThemeControl(container = document.querySelector('.app-header__side')) {
  if (!container || document.getElementById('theme-select')) return;
  const select = el('select', { id: 'theme-select', class: 'theme-switch__select' },
    CHOICES.map((value) => el('option', { value, text: THEME[value], selected: value === readTheme() })));
  select.addEventListener('change', () => applyTheme(select.value));
  container.append(el('div', { class: 'theme-switch' }, [el('label', { for: 'theme-select', text: THEME.label }), select]));
}
