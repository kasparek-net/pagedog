// Inline picker injected into the /api/preview iframe.
// Kept as a string constant so any page CSP that blocks external scripts cannot stop it.
// IMPORTANT: must avoid backticks and ${} inside (String.raw is used to preserve regex backslashes).

export const PICKER_JS = String.raw`(function () {
  "use strict";
  if (window.__wd_loaded__) return;
  window.__wd_loaded__ = true;

  var HOVER = "__wd_hover__";
  var PICKED = "__wd_picked__";
  var paused = false;
  var hovered = null;
  var picked = null;
  var lastChild = null;
  var bannersHidden = true;

  var css = [
    "." + HOVER + "{outline:2px solid #ef4444!important;outline-offset:1px;cursor:crosshair!important;background:rgba(239,68,68,0.06)!important}",
    "." + PICKED + "{outline:3px solid #eabf43!important;outline-offset:2px}",
    "html:not(.__wd_paused__),html:not(.__wd_paused__) body{cursor:crosshair!important}",
    "html:not(.__wd_paused__) a,html:not(.__wd_paused__) button{pointer-events:none!important}",
    "html.__wd_banhide__ [class*='cookie' i],html.__wd_banhide__ [class*='consent' i],html.__wd_banhide__ [class*='gdpr' i],html.__wd_banhide__ [class*='banner' i],html.__wd_banhide__ [class*='backdrop' i],html.__wd_banhide__ [id*='cookie' i],html.__wd_banhide__ [id*='consent' i],html.__wd_banhide__ [id*='banner' i]{display:none!important}",
    // A consent modal usually locks scrolling; hiding it has to give that back.
    "html.__wd_banhide__,html.__wd_banhide__ body{overflow:auto!important}",
    "#__wd_top__,#__wd_bar__{position:fixed;left:50%;transform:translateX(-50%);z-index:2147483647;color:#fff;cursor:default!important;font-family:-apple-system,system-ui,sans-serif!important;box-sizing:border-box}",
    "#__wd_top__ *,#__wd_bar__ *{cursor:default!important;pointer-events:auto!important;box-sizing:border-box;color:inherit;font-family:inherit}",
    "#__wd_top__{top:12px;background:rgba(10,10,10,0.92);padding:6px 14px;border-radius:999px;font-size:12px;display:flex;gap:6px;align-items:center;max-width:calc(100vw - 24px);flex-wrap:wrap;justify-content:center}",
    "#__wd_top__ kbd{background:rgba(255,255,255,0.18);border-radius:4px;padding:1px 6px;font-size:11px;font-family:ui-monospace,monospace}",
    "#__wd_bar__{bottom:16px;background:#0a0a0a;padding:10px 12px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.45);display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 24px);font-size:13px}",
    "#__wd_bar__ .__wd_text{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.9;font-family:ui-monospace,monospace;font-size:12px}",
    "#__wd_bar__ .__wd_count{font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.15)}",
    "#__wd_bar__ .__wd_count.warn{background:rgba(234,191,67,0.3);color:#eabf43}",
    "#__wd_bar__ button{background:rgba(255,255,255,0.1);border:0;border-radius:6px;padding:6px 10px;font-size:12px;font-weight:500;cursor:pointer!important;color:#fff}",
    "#__wd_bar__ button:hover:not(:disabled){background:rgba(255,255,255,0.2)}",
    "#__wd_bar__ button:disabled{opacity:0.35;cursor:not-allowed!important}",
    "#__wd_bar__ .__wd_use{background:#eabf43;color:#0a0a0a}",
    "#__wd_bar__ .__wd_use:hover:not(:disabled){background:#d4a92e}"
  ].join("");
  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.documentElement.appendChild(styleEl);
  // Consent overlays cover the page the moment it loads, so start with them
  // hidden; the Banners button brings them back.
  document.documentElement.classList.add("__wd_banhide__");

  function el(tag, props, children) {
    var n = document.createElement(tag);
    if (props) {
      for (var k in props) {
        if (k === "className") n.className = props[k];
        else if (k === "title") n.title = props[k];
        else if (k === "type") n.type = props[k];
        else if (k === "disabled") n.disabled = !!props[k];
        else if (k === "text") n.textContent = props[k];
        else n.setAttribute(k, props[k]);
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        n.appendChild(children[i]);
      }
    }
    return n;
  }

  function makeBtn(cls, label, title, disabled) {
    var b = el("button", { type: "button", className: cls, text: label, title: title || "" });
    if (disabled !== false) b.disabled = true;
    return b;
  }

  function makeTopHint() {
    function k(label) { return el("kbd", { text: label }); }
    function s(t) { return el("span", { text: t }); }
    return el("div", { id: "__wd_top__" }, [
      s("Click an element."), k("ESC"), s("clear"), k("\u2191\u2193"), s("parent/child"), k("B"), s("banners"), k("P"), s("pause"), k("\u23CE"), s("use")
    ]);
  }

  var labelEl = el("span", { className: "__wd_label", text: "Click an element \u2193" });
  var textEl = el("span", { className: "__wd_text" });
  var countEl = el("span", { className: "__wd_count" });
  countEl.style.display = "none";
  var upBtn = makeBtn("__wd_up", "\u2191 Parent", "Select the parent element ([)");
  var downBtn = makeBtn("__wd_down", "\u2193 Child", "Select the child element (])");
  var banBtn = makeBtn("__wd_ban", "Show banners", "Show cookie/banner overlays again (B)", false);
  var pauseBtn = makeBtn("__wd_pause", "Pause", "Pause picker so you can scroll/click (P)", false);
  var useBtn = makeBtn("__wd_use", "✓ Use", "Confirm selection (Enter)");
  var bar = el("div", { id: "__wd_bar__" }, [labelEl, textEl, countEl, upBtn, downBtn, banBtn, pauseBtn, useBtn]);

  function attach() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", attach);
      return;
    }
    document.body.appendChild(makeTopHint());
    document.body.appendChild(bar);
  }
  attach();

  function isOurs(node) {
    if (!node) return false;
    if (node.id === "__wd_bar__" || node.id === "__wd_top__") return true;
    return !!(node.closest && (node.closest("#__wd_bar__") || node.closest("#__wd_top__")));
  }

  function setHover(node, on) {
    if (!node || !node.classList) return;
    if (on) node.classList.add(HOVER);
    else node.classList.remove(HOVER);
  }

  function setPicked(node) {
    if (picked) picked.classList.remove(PICKED);
    picked = node;
    if (node) {
      node.classList.add(PICKED);
      node.classList.remove(HOVER);
      try {
        var rect = node.getBoundingClientRect();
        if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
          node.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      } catch (e) {}
    }
    updateBar();
  }

  function clearPicked() {
    if (picked) picked.classList.remove(PICKED);
    picked = null;
    lastChild = null;
    updateBar();
  }

  function updateBar() {
    if (!picked) {
      labelEl.textContent = paused ? "⏸ Paused" : "Click an element \u2193";
      textEl.textContent = "";
      countEl.style.display = "none";
      upBtn.disabled = true;
      downBtn.disabled = true;
      useBtn.disabled = true;
      return;
    }
    var sel = uniqueSelector(picked);
    var text = (picked.textContent || "").replace(/\s+/g, " ").trim();
    labelEl.textContent = "✓";
    textEl.textContent = text.slice(0, 80) + (text.length > 80 ? "…" : "");
    textEl.title = sel + "\n\n" + text.slice(0, 300);
    var n = 0;
    try { n = document.querySelectorAll(sel).length; } catch (e) {}
    countEl.textContent = n + (n === 1 ? " match" : " matches");
    countEl.className = "__wd_count" + (n > 1 ? " warn" : "");
    countEl.style.display = "inline-block";
    upBtn.disabled = !canGoUp(picked);
    downBtn.disabled = !lastChild || !picked.contains(lastChild) || picked === lastChild;
    useBtn.disabled = false;
  }

  function canGoUp(node) {
    var p = node.parentElement;
    return !!(p && p !== document.documentElement && p !== document.body);
  }

  function goUp() {
    if (picked && canGoUp(picked)) {
      lastChild = picked;
      setPicked(picked.parentElement);
    }
  }

  function goDown() {
    if (picked && lastChild && picked.contains(lastChild) && picked !== lastChild) {
      var cur = lastChild;
      while (cur.parentElement && cur.parentElement !== picked) cur = cur.parentElement;
      setPicked(cur);
    }
  }

  function toggleBanners() {
    bannersHidden = !bannersHidden;
    document.documentElement.classList.toggle("__wd_banhide__", bannersHidden);
    banBtn.textContent = bannersHidden ? "Show banners" : "Hide banners";
  }

  function togglePause() {
    paused = !paused;
    document.documentElement.classList.toggle("__wd_paused__", paused);
    pauseBtn.textContent = paused ? "▶ Resume" : "Pause";
    if (paused && hovered) setHover(hovered, false);
    updateBar();
  }

  function commit() {
    if (!picked) return;
    var sel = uniqueSelector(picked);
    var text = (picked.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200);
    try {
      window.parent.postMessage({ type: "wd:pick", selector: sel, text: text }, "*");
    } catch (e) {}
  }

  document.addEventListener("mouseover", function (e) {
    if (paused) return;
    var t = e.target;
    if (!(t instanceof Element) || isOurs(t)) return;
    if (t === picked) return;
    if (hovered && hovered !== t) setHover(hovered, false);
    setHover(t, true);
    hovered = t;
  }, true);

  document.addEventListener("mouseout", function (e) {
    if (paused) return;
    var t = e.target;
    if (t instanceof Element && t !== picked && !isOurs(t)) setHover(t, false);
  }, true);

  document.addEventListener("click", function (e) {
    if (paused) return;
    var t = e.target;
    if (!(t instanceof Element) || isOurs(t)) return;
    e.preventDefault();
    e.stopPropagation();
    setPicked(t);
    lastChild = t;
  }, true);

  document.addEventListener("dblclick", function (e) {
    if (paused) return;
    if (e.target instanceof Element && !isOurs(e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.addEventListener("keydown", function (e) {
    if (e.target instanceof Element && e.target.matches && e.target.matches("input,textarea,select,[contenteditable]")) return;
    var k = e.key;
    if (k === "Escape") { e.preventDefault(); clearPicked(); }
    else if (k === "ArrowUp" || k === "[") { e.preventDefault(); goUp(); }
    else if (k === "ArrowDown" || k === "]") { e.preventDefault(); goDown(); }
    else if (k === "b" || k === "B") { e.preventDefault(); toggleBanners(); }
    else if (k === "p" || k === "P") { e.preventDefault(); togglePause(); }
    else if (k === "Enter" && picked) { e.preventDefault(); commit(); }
  }, true);

  upBtn.addEventListener("click", function (e) { e.stopPropagation(); goUp(); });
  downBtn.addEventListener("click", function (e) { e.stopPropagation(); goDown(); });
  banBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleBanners(); });
  pauseBtn.addEventListener("click", function (e) { e.stopPropagation(); togglePause(); });
  useBtn.addEventListener("click", function (e) { e.stopPropagation(); commit(); });

  function safeAttrValue(v) {
    return typeof v === "string" && v.length > 0 && v.length < 80 && /^[A-Za-z0-9_][\w \-:.\/]*$/.test(v);
  }

  function attrSelector(node, attr) {
    var v = node.getAttribute(attr);
    if (!safeAttrValue(v)) return null;
    var s = node.tagName.toLowerCase() + "[" + attr + '="' + v.replace(/"/g, '\\"') + '"]';
    try {
      if (document.querySelectorAll(s).length === 1) return s;
    } catch (e) {}
    return null;
  }

  function uniqueSelector(node) {
    if (!(node instanceof Element)) return "";
    if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) {
      var s = "#" + node.id;
      try { if (document.querySelectorAll(s).length === 1) return s; } catch (e) {}
    }
    var prefAttrs = ["data-testid", "data-test", "data-cy", "data-qa", "name", "aria-label"];
    for (var i = 0; i < prefAttrs.length; i++) {
      var a = attrSelector(node, prefAttrs[i]);
      if (a) return a;
    }
    var parts = [];
    var cur = node;
    var depth = 0;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement && depth < 8) {
      var part = cur.tagName.toLowerCase();
      if (cur.id && /^[A-Za-z][\w-]*$/.test(cur.id)) {
        parts.unshift(part + "#" + cur.id);
        var s2 = parts.join(" > ");
        try { if (document.querySelectorAll(s2).length === 1) return s2; } catch (e) {}
        cur = cur.parentElement; depth++; continue;
      }
      var classes = (cur.className && typeof cur.className === "string")
        ? cur.className.trim().split(/\s+/).filter(function (c) {
            return c && c !== HOVER && c !== PICKED && /^[A-Za-z_][\w-]*$/.test(c) && c.length < 30;
          })
        : [];
      if (classes.length) part += "." + classes.slice(0, 2).join(".");
      var parent = cur.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (c) {
          return c.tagName === cur.tagName;
        });
        if (same.length > 1) {
          var idx = same.indexOf(cur) + 1;
          part += ":nth-of-type(" + idx + ")";
        }
      }
      parts.unshift(part);
      var s3 = parts.join(" > ");
      try { if (document.querySelectorAll(s3).length === 1) return s3; } catch (e) {}
      cur = cur.parentElement;
      depth++;
    }
    return parts.join(" > ");
  }

  try { window.parent.postMessage({ type: "wd:ready" }, "*"); } catch (e) {}
})();`;
