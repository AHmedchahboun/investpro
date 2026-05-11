(function () {
  const EVENT_ATTRS = {
    click: 'onclick',
    change: 'onchange',
    input: 'oninput',
    keydown: 'onkeydown',
  };

  const DATA_PREFIX = 'data-csp-';

  function whenReady(fn) {
    if (document.body) {
      fn();
      return;
    }
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  function inlineHandlersAllowed() {
    const key = '__investpro_inline_event_test__';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px';
    btn.setAttribute('onclick', `window.${key}=1`);
    document.body.appendChild(btn);
    try {
      window[key] = 0;
      btn.click();
      return window[key] === 1;
    } finally {
      delete window[key];
      btn.remove();
    }
  }

  function dataAttr(attr) {
    return DATA_PREFIX + attr.slice(2);
  }

  function moveInlineHandlers(root) {
    if (!root?.querySelectorAll) return;
    Object.values(EVENT_ATTRS).forEach(attr => {
      const data = dataAttr(attr);
      root.querySelectorAll(`[${attr}]`).forEach(el => {
        if (!el.hasAttribute(data)) el.setAttribute(data, el.getAttribute(attr) || '');
        el.removeAttribute(attr);
      });
    });
  }

  function splitTopLevel(value, separator) {
    const out = [];
    let current = '';
    let quote = '';
    let depth = 0;

    for (let i = 0; i < value.length; i += 1) {
      const ch = value[i];
      const prev = value[i - 1];

      if (quote) {
        current += ch;
        if (ch === quote && prev !== '\\') quote = '';
        continue;
      }

      if (ch === '"' || ch === "'") {
        quote = ch;
        current += ch;
        continue;
      }

      if (ch === '(' || ch === '[' || ch === '{') depth += 1;
      if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);

      if (ch === separator && depth === 0) {
        if (current.trim()) out.push(current.trim());
        current = '';
        continue;
      }

      current += ch;
    }

    if (current.trim()) out.push(current.trim());
    return out;
  }

  function unquote(value) {
    const q = value[0];
    return value
      .slice(1, -1)
      .replace(new RegExp('\\\\' + q, 'g'), q)
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
  }

  function getByPath(path) {
    return path.split('.').reduce((obj, key) => (obj == null ? undefined : obj[key]), window);
  }

  function callWithPath(path, args) {
    const parts = path.split('.');
    const fnName = parts.pop();
    const ctx = parts.length ? getByPath(parts.join('.')) : window;
    const fn = ctx?.[fnName];
    if (typeof fn !== 'function') {
      console.warn('[CSP events] Missing handler:', path);
      return undefined;
    }
    return fn.apply(ctx, args);
  }

  function parseArg(raw, context) {
    const value = raw.trim();
    if (!value) return undefined;
    if ((value[0] === "'" && value[value.length - 1] === "'") ||
        (value[0] === '"' && value[value.length - 1] === '"')) {
      return unquote(value);
    }
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    if (value === 'event') return context.event;
    if (value === 'this') return context.element;
    if (value === 'this.value') return context.element?.value;

    const datasetMatch = value.match(/^this\.dataset\.([A-Za-z0-9_$-]+)$/);
    if (datasetMatch) return context.element?.dataset?.[datasetMatch[1]];

    const elementValueMatch = value.match(/^document\.getElementById\((['"])(.*?)\1\)\.value$/);
    if (elementValueMatch) return document.getElementById(elementValueMatch[2])?.value;

    const elementMatch = value.match(/^document\.getElementById\((['"])(.*?)\1\)$/);
    if (elementMatch) return document.getElementById(elementMatch[2]);

    return value;
  }

  function parseCall(statement) {
    const open = statement.indexOf('(');
    const close = statement.lastIndexOf(')');
    if (open < 1 || close < open) return null;

    const path = statement.slice(0, open).trim();
    if (!/^(window\.)?[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(path)) return null;

    const argsRaw = statement.slice(open + 1, close).trim();
    const args = argsRaw ? splitTopLevel(argsRaw, ',') : [];
    return { path: path.replace(/^window\./, ''), args };
  }

  function executeStatement(statement, context) {
    const s = statement.trim();
    if (!s) return undefined;
    if (s === 'return false') return false;
    if (s === 'event.stopPropagation()') {
      context.event.stopPropagation();
      return undefined;
    }
    if (s === 'event.preventDefault()') {
      context.event.preventDefault();
      return undefined;
    }

    const keyMatch = s.match(/^if\s*\(\s*event\.key\s*={2,3}\s*(['"])(.*?)\1\s*\)\s*(.+)$/);
    if (keyMatch) {
      if (context.event.key === keyMatch[2]) return executeStatement(keyMatch[3], context);
      return undefined;
    }

    const assignMatch = s.match(/^document\.getElementById\((['"])(.*?)\1\)\.(value|textContent|innerHTML)\s*=\s*(.+)$/);
    if (assignMatch) {
      const el = document.getElementById(assignMatch[2]);
      if (el) el[assignMatch[3]] = parseArg(assignMatch[4], context);
      return undefined;
    }

    const call = parseCall(s);
    if (call) {
      return callWithPath(call.path, call.args.map(arg => parseArg(arg, context)));
    }

    console.warn('[CSP events] Unsupported inline handler:', s);
    return undefined;
  }

  function runAction(action, event, element) {
    const context = { event, element };
    let result;
    splitTopLevel(action, ';').forEach(statement => {
      const value = executeStatement(statement, context);
      if (value === false) result = false;
    });
    return result;
  }

  function findActionElement(start, attr) {
    const data = dataAttr(attr);
    let el = start instanceof Element ? start : start?.parentElement;
    while (el && el !== document.documentElement) {
      if (el.hasAttribute(data) || el.hasAttribute(attr)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function installBridge() {
    Object.entries(EVENT_ATTRS).forEach(([type, attr]) => {
      document.addEventListener(type, event => {
        const el = findActionElement(event.target, attr);
        if (!el) return;
        const action = el.getAttribute(dataAttr(attr)) || el.getAttribute(attr);
        if (!action) return;
        const result = runAction(action, event, el);
        if (result === false) event.preventDefault();
      }, true);
    });

    moveInlineHandlers(document);
    new MutationObserver(records => {
      records.forEach(record => {
        record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            moveInlineHandlers(node);
            Object.values(EVENT_ATTRS).forEach(attr => {
              const data = dataAttr(attr);
              if (node.hasAttribute?.(attr) && !node.hasAttribute(data)) {
                node.setAttribute(data, node.getAttribute(attr) || '');
                node.removeAttribute(attr);
              }
            });
          }
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  whenReady(() => {
    if (inlineHandlersAllowed()) return;
    installBridge();
  });
})();
