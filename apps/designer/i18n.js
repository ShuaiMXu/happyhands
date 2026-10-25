import { messages } from './messages.js';

export const LANGUAGE_KEY = 'creative-os-language';
export function resolveLanguage(requested, saved) {
  return [requested, saved].find(value => value === 'zh' || value === 'en') || 'zh';
}
let language = 'zh';
export function getLanguage() { return language; }
export function setLanguage(value) {
  language = resolveLanguage(value);
  try { globalThis.localStorage?.setItem(LANGUAGE_KEY, language); } catch { /* Session-only when storage is unavailable. */ }
}
export function translate(key, values = [], locale = language) {
  const template = messages[key]?.[locale === 'en' ? 1 : 0] ?? key;
  return template.replace(/\{(\d+)\}/g, (match, index) => index < values.length ? String(values[index]) : match);
}
// Tagged templates translate only the authored UI segments, never interpolated evidence.
export function t(source, ...values) {
  if (typeof source === 'string') return translate(source);
  const key = source.reduce((result, part, index) => result + (index ? `{${index - 1}}` : '') + part, '');
  return translate(key, values);
}

// Capture only text present in the HTML shell, before evidence is rendered.
// Keep the original nodes (including labels with nested controls) intact.
export function localizeShell(root = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const entries = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest('script, style, [data-language-option]')) continue;
    const key = node.textContent.trim();
    if (messages[key]) entries.push(() => { node.textContent = node.textContent.replace(node.textContent.trim(), t(key)); });
  }
  for (const element of root.querySelectorAll('[title], [aria-label], [placeholder]')) {
    for (const name of ['title', 'aria-label', 'placeholder']) {
      const key = element.getAttribute(name);
      if (messages[key]) entries.push(() => element.setAttribute(name, t(key)));
    }
  }
  return () => {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    entries.forEach(update => update());
    root.querySelectorAll('[data-language-toggle]').forEach(button => {
      const label = language === 'zh' ? 'English' : '中文';
      button.querySelector('[data-language-option]').textContent = label;
      button.setAttribute('aria-label', label);
      button.title = language === 'zh' ? 'Switch to English' : '切换到中文';
    });
  };
}
