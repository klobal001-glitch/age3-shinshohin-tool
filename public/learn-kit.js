/*
 * 学習キット（learn-kit.js）
 *
 * 使う人の声（よかった／こまった）と、操作の様子（開いた画面・押したボタン・
 * エラー・遅さ）を受け取り、まとめて保管場所へ送る小さな部品。
 * 新しい更新があると「お知らせ」に印を付けて知らせる。
 *
 * 読み込みは各アプリの共通レイアウトに1行だけ:
 *   script タグ（async・src="/learn-kit.js"・data-endpoint・data-key・data-app）を1つ置く
 *
 * 決めごと
 * - 入力欄の中身は読まない。数字とメールは送る前に伏せ字にする（夜の集計でももう一度伏せる）
 * - 1件ずつは送らない。まとめて送り、送りすぎは端末ごとに止める
 * - 置いたページの見た目に影響しないよう、専用のタグ名と Shadow DOM の中に置く
 * - 止め方: ページ単位 … <html data-learn-kit-off> が付いているあいだ（画面側で付け外しする）
 *           端末単位   … ?learnkit=off を付けて開く（?learnkit=on で元に戻す）
 * - このファイルには、スクリプトの閉じタグにあたる文字列を書かないこと
 *   （ページに埋め込んで検査するとき、そこで途中で切れるため）
 */
(function () {
  "use strict";
  if (typeof window === "undefined" || window.__age3LearnKit) return;
  window.__age3LearnKit = { version: 1 };

  /* ---------------- 設定 ---------------- */
  var tag = document.currentScript || document.querySelector('script[src*="learn-kit.js"]');
  var ds = (tag && tag.dataset) || {};
  var CFG = {
    endpoint: (ds.endpoint || "").replace(/\/+$/, ""),
    key: ds.key || "",
    bucket: ds.bucket || "genba-photos",
    prefix: "learn/raw",
    app: ds.app || location.hostname,
    updates: ds.updates || "/updates.json",
  };
  var LS = {
    device: "age3LearnKit.device",
    off: "age3LearnKit.off",
    queue: "age3LearnKit.queue",
    seen: "age3LearnKit.seenUpdate",
    sent: "age3LearnKit.sent",
  };
  var LIMIT = {
    queue: 300, // 端末にためておく最大件数
    batchGapMs: 30000, // まとめて送る間隔の下限
    flushEveryMs: 60000,
    perDay: 80, // 1日に送る回数の上限（端末ごと）
    text: 120,
    comment: 200,
  };

  /* ---------------- 小さな道具 ---------------- */
  function lsGet(k) {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      if (v === null) window.localStorage.removeItem(k);
      else window.localStorage.setItem(k, v);
    } catch {
      /* 保存できない端末でも動かす */
    }
  }
  /** 個人情報になりうるものを伏せる。数字は全部「#」、メールは「[メール]」 */
  function redact(s, max) {
    s = String(s == null ? "" : s);
    s = s.replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, "[メール]");
    s = s.replace(/[0-9０-９]+/g, "#");
    s = s.replace(/\s+/g, " ").trim();
    return s.slice(0, max || LIMIT.text);
  }
  function jstDate(d) {
    var t = new Date((d || new Date()).getTime() + 9 * 3600 * 1000);
    return t.toISOString().slice(0, 10);
  }
  function rand() {
    return Math.random().toString(36).slice(2, 8);
  }
  function deviceId() {
    var id = lsGet(LS.device);
    if (!id) {
      id = "d" + Date.now().toString(36) + rand();
      lsSet(LS.device, id);
    }
    return id;
  }
  function pagePath() {
    return redact(location.pathname + (location.hash || ""), 80);
  }

  /* ---------------- 止める仕組み ---------------- */
  (function readSwitch() {
    var m = /[?&]learnkit=(on|off)\b/.exec(location.search);
    if (m) lsSet(LS.off, m[1] === "off" ? "1" : null);
  })();
  function deviceOff() {
    return lsGet(LS.off) === "1";
  }
  function pageOff() {
    return document.documentElement.hasAttribute("data-learn-kit-off");
  }
  function off() {
    return deviceOff() || pageOff();
  }
  if (deviceOff()) return;

  /* ---------------- 記録をためる ---------------- */
  var queue = [];
  try {
    queue = JSON.parse(lsGet(LS.queue) || "[]") || [];
  } catch {
    queue = [];
  }
  function save() {
    lsSet(LS.queue, JSON.stringify(queue.slice(-LIMIT.queue)));
  }
  /** 同じ中身の記録は1件にまとめて数だけ増やす（送る量を減らす） */
  function record(ev) {
    if (off()) return;
    ev.p = ev.p || pagePath();
    var key = JSON.stringify([ev.t, ev.p, ev.n || "", ev.m || "", ev.u || "", ev.s || 0, ev.k || ""]);
    for (var i = queue.length - 1; i >= 0 && i >= queue.length - 50; i--) {
      if (queue[i]._k === key && ev.t !== "fb") {
        queue[i].c = (queue[i].c || 1) + 1;
        save();
        return;
      }
    }
    ev._k = key;
    ev.ts = Date.now();
    queue.push(ev);
    if (queue.length > LIMIT.queue) queue = queue.slice(-LIMIT.queue);
    save();
  }

  /* ---------------- 送る ---------------- */
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  var lastSent = 0;
  var sending = false;

  function sentToday() {
    var v = (lsGet(LS.sent) || "").split(":");
    return v[0] === jstDate() ? Number(v[1] || 0) : 0;
  }
  function bumpSent() {
    lsSet(LS.sent, jstDate() + ":" + (sentToday() + 1));
  }

  /** ためた記録をまとめて1回で送る。urgent はご意見を送るとき（間隔の下限を無視） */
  function flush(urgent, keepalive) {
    if (!nativeFetch || !CFG.endpoint || !CFG.key || sending || queue.length === 0) {
      return Promise.resolve(queue.length === 0);
    }
    var now = Date.now();
    if (!urgent && now - lastSent < LIMIT.batchGapMs) return Promise.resolve(false);
    if (sentToday() >= LIMIT.perDay) return Promise.resolve(false);

    var batch = queue.slice(0, 200);
    var body = {
      v: 1,
      app: CFG.app,
      device: deviceId(),
      form: window.matchMedia && window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
      width: window.innerWidth,
      sentAt: new Date().toISOString(),
      events: batch.map(function (e) {
        var o = {};
        for (var k in e) if (k !== "_k") o[k] = e[k];
        return o;
      }),
    };
    var path =
      CFG.prefix + "/" + jstDate() + "/" + body.device + "-" + now.toString(36) + "-" + rand() + ".json";
    sending = true;
    lastSent = now;
    return nativeFetch(CFG.endpoint + "/storage/v1/object/" + CFG.bucket + "/" + path, {
      method: "POST",
      keepalive: !!keepalive,
      headers: {
        apikey: CFG.key,
        Authorization: "Bearer " + CFG.key,
        "Content-Type": "application/json",
        "x-upsert": "false",
      },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        sending = false;
        if (!res.ok) return false;
        bumpSent();
        queue = queue.slice(batch.length);
        save();
        return true;
      })
      .catch(function () {
        sending = false;
        return false;
      });
  }

  /* ---------------- 自動で記録するもの ---------------- */
  // 開いた画面（URLの # が変わったときも数える）
  var lastView = "";
  function view() {
    var p = pagePath();
    if (p === lastView) return;
    lastView = p;
    record({ t: "view", p: p });
  }
  view();
  window.addEventListener("hashchange", view);
  window.addEventListener("popstate", view);

  // 押したボタンの名前（入力欄は対象外。中身は読まない）
  document.addEventListener(
    "click",
    function (e) {
      var el = e.target && e.target.closest
        ? e.target.closest('button,a,[role="button"],[role="tab"],summary')
        : null;
      if (!el || el.closest("age3-learn-kit")) return;
      var name =
        el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || el.textContent || "";
      name = redact(name, 40);
      if (!name) return;
      record({ t: "click", n: name });
    },
    true
  );

  // JavaScript のエラー
  window.addEventListener("error", function (e) {
    if (!e || !e.message) return;
    var src = e.filename ? redact(String(e.filename).split("?")[0].split("/").pop(), 60) : "";
    record({ t: "error", m: redact(e.message), s: src });
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    var msg = r && r.message ? r.message : String(r);
    record({ t: "error", m: redact("処理されなかった失敗: " + msg) });
  });

  // 通信の失敗と遅さ（キット自身の送信は数えない）
  if (nativeFetch) {
    window.fetch = function (input, init) {
      var url = "";
      try {
        url = typeof input === "string" ? input : (input && input.url) || "";
      } catch {
        url = "";
      }
      var mine = url.indexOf("/storage/v1/object/" + CFG.bucket + "/" + CFG.prefix) >= 0;
      var started = Date.now();
      var where = "";
      try {
        var u = new URL(url, location.href);
        where = redact(u.host + u.pathname, 100);
      } catch {
        where = "";
      }
      var p = nativeFetch(input, init);
      if (mine) return p;
      return p.then(
        function (res) {
          var ms = Date.now() - started;
          if (res.status >= 400) record({ t: "net", u: where, s: res.status });
          else if (ms > 5000) record({ t: "slow", k: "通信", u: where, ms: ms });
          return res;
        },
        function (err) {
          if (!(err && err.name === "AbortError")) record({ t: "net", u: where, s: 0 });
          throw err;
        }
      );
    };
  }

  // 表示の遅さ（ページを開いてから使えるようになるまで）
  window.addEventListener("load", function () {
    setTimeout(function () {
      try {
        var nav = performance.getEntriesByType("navigation")[0];
        var ms = nav ? Math.round(nav.loadEventEnd || nav.duration) : 0;
        if (ms > 4000) record({ t: "slow", k: "表示", ms: ms });
      } catch {
        /* 測れない端末は数えない */
      }
    }, 0);
  });

  setInterval(function () {
    flush(false);
  }, LIMIT.flushEveryMs);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush(true, true);
  });

  /* ---------------- 画面（ご意見・お知らせ） ---------------- */
  var CSS =
    ":host{all:initial;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif;color:#292524}" +
    "*{box-sizing:border-box}" +
    "@media print{:host{display:none!important}}" +
    ".tab{position:fixed;right:0;bottom:calc(112px + env(safe-area-inset-bottom,0px));z-index:30;width:44px;min-height:76px;padding:10px 0;border:1px solid #d6d3d1;border-right:0;border-radius:12px 0 0 12px;background:#fff;color:#44403c;font-size:13px;font-weight:600;line-height:1.25;white-space:pre-line;text-align:center;cursor:pointer;box-shadow:0 2px 8px rgba(28,25,23,.08)}" +
    "@media (min-width:768px){.tab{bottom:24px}}" +
    ".tab:focus-visible,button:focus-visible,textarea:focus-visible{outline:2px solid #b84208;outline-offset:2px}" +
    ".dot{position:absolute;top:-4px;left:-4px;width:10px;height:10px;border-radius:50%;background:#b84208;border:2px solid #fff}" +
    ".back{position:fixed;inset:0;z-index:60;background:rgba(28,25,23,.25)}" +
    ".panel{position:fixed;z-index:61;right:0;bottom:0;left:0;max-height:85vh;overflow:auto;background:#fff;border-radius:16px 16px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 24px rgba(28,25,23,.15)}" +
    "@media (min-width:768px){.panel{left:auto;right:16px;bottom:16px;width:380px;border-radius:16px}}" +
    ".head{display:flex;gap:8px;align-items:center;margin-bottom:12px}" +
    ".seg{display:flex;flex:1;gap:4px;padding:3px;border-radius:999px;background:#f5f5f4}" +
    ".seg button{flex:1;min-height:40px;border:0;border-radius:999px;background:transparent;color:#57534e;font:inherit;font-size:14px;font-weight:600;cursor:pointer;position:relative}" +
    ".seg button[aria-selected=true]{background:#fff;color:#1c1917;box-shadow:0 1px 3px rgba(28,25,23,.12)}" +
    ".seg .dot{top:8px;left:auto;right:12px}.panel:focus{outline:none}" +
    ".x{min-width:44px;min-height:44px;border:0;background:transparent;color:#57534e;font-size:22px;cursor:pointer;border-radius:10px}" +
    ".two{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
    ".pick{min-height:56px;border:2px solid #d6d3d1;border-radius:12px;background:#fff;color:#292524;font:inherit;font-size:16px;font-weight:600;cursor:pointer}" +
    ".pick.good[aria-pressed=true]{border-color:#15803d;background:#f0fdf4;color:#14532d}" +
    ".pick.bad[aria-pressed=true]{border-color:#b84208;background:#fff7ed;color:#7c2d12}" +
    "label{display:block;margin:12px 0 4px;font-size:13px;color:#57534e}" +
    "textarea{width:100%;min-height:64px;padding:10px;border:1px solid #d6d3d1;border-radius:10px;font:inherit;font-size:16px;color:#1c1917;resize:vertical}" +
    ".note{margin:6px 0 0;font-size:12px;color:#57534e}" +
    ".send{margin-top:12px;width:100%;min-height:48px;border:0;border-radius:999px;background:#b84208;color:#fff;font:inherit;font-size:16px;font-weight:600;cursor:pointer}" +
    ".send:disabled{background:#d6d3d1;color:#44403c;cursor:default}" +
    ".done{padding:20px 4px;text-align:center;font-size:15px;color:#14532d}" +
    ".err{margin-top:8px;font-size:13px;color:#b91c1c}" +
    "ul{list-style:none;margin:0;padding:0}" +
    "li{padding:12px 2px;border-top:1px solid #e7e5e4;font-size:14px;line-height:1.6;color:#292524}" +
    "li:first-child{border-top:0}" +
    ".date{display:block;font-size:12px;color:#57534e;margin-bottom:2px}" +
    ".new{display:inline-block;margin-left:6px;padding:0 6px;border-radius:999px;background:#fff7ed;color:#9a3412;font-size:11px;font-weight:600}" +
    ".foot{margin-top:14px;text-align:right}" +
    ".link{min-height:44px;border:0;background:transparent;color:#57534e;font:inherit;font-size:12px;text-decoration:underline;cursor:pointer}";

  var updates = [];
  function newestId() {
    return updates[0] ? String(updates[0].id || updates[0].date || "") : "";
  }
  function hasNew() {
    var id = newestId();
    return !!id && lsGet(LS.seen) !== id;
  }

  function el(tagName, attrs, text) {
    var n = document.createElement(tagName);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function mount() {
    if (document.querySelector("age3-learn-kit")) return;
    if (!window.customElements) return;
    if (!customElements.get("age3-learn-kit")) {
      customElements.define("age3-learn-kit", class extends HTMLElement {});
    }
    var host = document.createElement("age3-learn-kit");
    var root = host.attachShadow({ mode: "open" });
    var style = el("style");
    style.textContent = CSS;
    root.appendChild(style);

    var tabBtn = el("button", { type: "button", class: "tab", "aria-label": "ご意見・お知らせ" }, "ご\n意\n見");
    var tabDot = el("span", { class: "dot", "aria-hidden": "true" });
    root.appendChild(tabBtn);

    var layer = null;
    var mode = "fb";

    function refreshDot() {
      if (hasNew()) {
        if (!tabDot.parentNode) tabBtn.appendChild(tabDot);
      } else if (tabDot.parentNode) tabDot.parentNode.removeChild(tabDot);
    }

    function close() {
      if (layer) {
        layer.forEach(function (n) {
          if (n.parentNode) n.parentNode.removeChild(n);
        });
        layer = null;
      }
      tabBtn.focus();
    }

    function open(which) {
      if (layer) close();
      mode = which || mode;
      var back = el("div", { class: "back" });
      back.addEventListener("click", close);
      var panel = el("div", { class: "panel", tabindex: "-1", role: "dialog", "aria-modal": "true", "aria-label": "ご意見・お知らせ" });
      var head = el("div", { class: "head" });
      var seg = el("div", { class: "seg", role: "tablist" });
      var bFb = el("button", { type: "button", role: "tab", "aria-selected": String(mode === "fb") }, "ご意見");
      var bUp = el("button", { type: "button", role: "tab", "aria-selected": String(mode === "up") }, "お知らせ");
      if (hasNew() && mode !== "up") bUp.appendChild(el("span", { class: "dot", "aria-hidden": "true" }));
      bFb.addEventListener("click", function () {
        open("fb");
      });
      bUp.addEventListener("click", function () {
        open("up");
      });
      seg.appendChild(bFb);
      seg.appendChild(bUp);
      var x = el("button", { type: "button", class: "x", "aria-label": "閉じる" }, "×");
      x.addEventListener("click", close);
      head.appendChild(seg);
      head.appendChild(x);
      panel.appendChild(head);
      panel.appendChild(mode === "fb" ? feedbackBody() : updatesBody());

      var foot = el("div", { class: "foot" });
      var stop = el("button", { type: "button", class: "link" }, "この端末ではボタンを出さない");
      stop.addEventListener("click", function () {
        lsSet(LS.off, "1");
        close();
        if (host.parentNode) host.parentNode.removeChild(host);
      });
      foot.appendChild(stop);
      panel.appendChild(foot);

      root.appendChild(back);
      root.appendChild(panel);
      layer = [back, panel];
      panel.addEventListener("keydown", function (e) {
        if (e.key === "Escape") close();
      });
      panel.focus();
    }

    function feedbackBody() {
      var box = el("div");
      var picked = "";
      var two = el("div", { class: "two" });
      var good = el("button", { type: "button", class: "pick good", "aria-pressed": "false" }, "よかった");
      var bad = el("button", { type: "button", class: "pick bad", "aria-pressed": "false" }, "こまった");
      var lab = el("label", { for: "lk-c" }, "ひとこと（なくても送れます）");
      var ta = el("textarea", { id: "lk-c", maxlength: String(LIMIT.comment), rows: "2" });
      var note = el("p", { class: "note" }, "お名前・電話番号・金額などは書かないでください。");
      var send = el("button", { type: "button", class: "send", disabled: "" }, "送る");
      var msg = el("p", { class: "err", role: "status" });
      function pick(v) {
        picked = v;
        good.setAttribute("aria-pressed", String(v === "good"));
        bad.setAttribute("aria-pressed", String(v === "bad"));
        send.removeAttribute("disabled");
      }
      good.addEventListener("click", function () {
        pick("good");
      });
      bad.addEventListener("click", function () {
        pick("bad");
      });
      send.addEventListener("click", function () {
        if (!picked) return;
        send.setAttribute("disabled", "");
        send.textContent = "送っています…";
        record({ t: "fb", v: picked, cm: redact(ta.value, LIMIT.comment) });
        flush(true).then(function (ok) {
          if (ok) {
            box.textContent = "";
            box.appendChild(el("p", { class: "done", role: "status" }, "受け取りました。ありがとうございます。"));
            setTimeout(close, 1500);
          } else {
            send.removeAttribute("disabled");
            send.textContent = "送る";
            msg.textContent = "いまは送れませんでした。この端末に残して、つながったときに送ります。";
          }
        });
      });
      two.appendChild(good);
      two.appendChild(bad);
      box.appendChild(two);
      box.appendChild(lab);
      box.appendChild(ta);
      box.appendChild(note);
      box.appendChild(send);
      box.appendChild(msg);
      return box;
    }

    function updatesBody() {
      var seen = lsGet(LS.seen) || "";
      var ul = el("ul");
      if (!updates.length) {
        ul.appendChild(el("li", null, "まだお知らせはありません。"));
      }
      var newerThanSeen = true;
      updates.slice(0, 30).forEach(function (u) {
        var id = String(u.id || u.date || "");
        if (id === seen) newerThanSeen = false;
        var li = el("li");
        var d = el("span", { class: "date" }, (u.dateLabel || u.date || "") + (u.app ? "　" + u.app : ""));
        if (newerThanSeen && seen) d.appendChild(el("span", { class: "new" }, "新しい"));
        li.appendChild(d);
        li.appendChild(document.createTextNode(u.text || ""));
        ul.appendChild(li);
      });
      if (newestId()) lsSet(LS.seen, newestId());
      refreshDot();
      return ul;
    }

    tabBtn.addEventListener("click", function () {
      open(hasNew() ? "up" : "fb");
    });

    document.body.appendChild(host);

    // ページ単位で止めている間は隠す（お客様に端末を渡す画面など）
    function applyPageSwitch() {
      host.style.display = pageOff() ? "none" : "";
      if (pageOff() && layer) close();
    }
    applyPageSwitch();
    new MutationObserver(applyPageSwitch).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-learn-kit-off"],
    });

    if (nativeFetch) {
      nativeFetch(CFG.updates, { cache: "no-store" })
        .then(function (r) {
          return r.ok ? r.json() : { updates: [] };
        })
        .then(function (j) {
          updates = (j && j.updates) || [];
          updates.sort(function (a, b) {
            return String(b.date).localeCompare(String(a.date));
          });
          refreshDot();
        })
        .catch(function () {
          /* お知らせが読めなくても、ご意見は送れるようにしておく */
        });
    }

    window.__age3LearnKit.open = open;
    window.__age3LearnKit.flush = flush;
  }

  // 画面の組み立て（React の hydration）が終わってから置く
  function later() {
    setTimeout(mount, 300);
  }
  if (document.readyState === "complete") later();
  else window.addEventListener("load", later);
})();
