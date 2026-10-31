// Bridge existing native form models into the site's shadcn/Radix composition.
// Target previews and third-party documents are outside this document scope.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../packages/ui/select.jsx';
const h = React.createElement;
const EMPTY = '__hh_empty__';
export function installSelectControls(root = document) {
  const doc = root.ownerDocument || root,
    win = doc.defaultView,
    widgets = new Map();
  function Control({ widget: w }) {
    const s = w.select;
    return h(
      Select,
      {
        value: String(s.selectedIndex < 0 ? EMPTY : s.selectedIndex),
        disabled: s.disabled,
        onValueChange: (value) => {
          if (value === EMPTY) return;
          s.selectedIndex = Number(value);
          s.dispatchEvent(new win.Event('input', { bubbles: true }));
          s.dispatchEvent(new win.Event('change', { bubbles: true }));
        },
      },
      h(
        SelectTrigger,
        {
          'aria-label': s.getAttribute('aria-label') || w.label,
          'aria-required': s.required,
          'aria-invalid': w.invalid || undefined,
          'aria-describedby': s.getAttribute('aria-describedby') || undefined,
          ref: (button) => {
            w.button = button;
            if (button && w.focusOnMount) {
              w.focusOnMount = false;
              queueMicrotask(
                () =>
                  button.isConnected && button.focus({ preventScroll: true }),
              );
            }
          },
        },
        h(SelectValue, null),
      ),
      h(
        SelectContent,
        { container: s.closest('[data-ui-dialog][open],dialog[open]') || doc.body },
        [...s.options].map(
          (option, index) =>
            !option.hidden &&
            h(
              SelectItem,
              {
                key: index,
                value: String(index),
                disabled: option.disabled || option.parentElement?.disabled,
              },
              option.label,
            ),
        ),
      ),
    );
  }
  function sync(w) {
    if (w.select.validity.valid) w.invalid = false;
    w.react.render(h(Control, { widget: w }));
  }
  function enhance(s) {
    if (
      widgets.has(s) ||
      s.multiple ||
      s.size > 1 ||
      s.closest('[data-native-select],.hh-select-widget,.hh-select-menu,.tl-container,.tldraw,[data-ui-external]')
    )
      return;
    const label = s.labels?.[0]?.cloneNode(true);
    label?.querySelectorAll('select,button').forEach((node) => node.remove());
    const host = doc.createElement('span');
    host.className = 'hh-select-widget';
    const w = {
      select: s,
      host,
      react: createRoot(host),
      label: label?.textContent?.trim() || s.name || s.id || 'Select',
      focusOnMount: doc.activeElement === s,
      abort: new win.AbortController(),
      hidden: s.hidden,
      tab: s.getAttribute('tabindex'),
      aria: s.getAttribute('aria-hidden'),
    };
    widgets.set(s, w);
    s.hidden = true;
    s.dataset.hhModel = 'select';
    s.setAttribute('aria-hidden', 'true');
    s.tabIndex = -1;
    s.after(host);
    s.addEventListener('change', () => sync(w), { signal: w.abort.signal });
    s.addEventListener(
      'invalid',
      (e) => {
        e.preventDefault();
        w.invalid = true;
        sync(w);
        w.button?.focus();
      },
      { signal: w.abort.signal },
    );
    for (const name of ['value', 'selectedIndex']) {
      const property = Object.getOwnPropertyDescriptor(
        win.HTMLSelectElement.prototype,
        name,
      );
      Object.defineProperty(s, name, {
        configurable: true,
        get() {
          return property.get.call(this);
        },
        set(value) {
          property.set.call(this, value);
          sync(w);
        },
      });
    }
    s.focus = (options) => w.button?.focus(options);
    sync(w);
  }
  const scan = () => {
    for (const [s, w] of widgets)
      if (!s.isConnected) {
        w.abort.abort();
        w.react.unmount();
        w.host.remove();
        for (const property of ['value', 'selectedIndex', 'focus'])
          delete s[property];
        s.hidden = w.hidden;
        delete s.dataset.hhModel;
        for (const [key, value] of [
          ['tabindex', w.tab],
          ['aria-hidden', w.aria],
        ])
          if (value === null) s.removeAttribute(key);
          else s.setAttribute(key, value);
        widgets.delete(s);
      }
    for (const s of root.querySelectorAll('select')) enhance(s);
    for (const w of widgets.values()) sync(w);
  };
  const observer = new win.MutationObserver((records) => {
    if (
      records.every((record) =>
        record.target.closest?.(
          '.hh-select-widget,.hh-select-menu,[data-radix-popper-content-wrapper]',
        ),
      )
    )
      return;
    scan();
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      'disabled',
      'label',
      'selected',
      'required',
      'aria-label',
    ],
  });
  doc.addEventListener('reset', () => win.setTimeout(scan, 0));
  scan();
}
