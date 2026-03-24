/*************************
 * utils.js — 共通ユーティリティ
 *************************/

/** LocalStorage ラッパー */
const LS = {
  get(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

/** 全角スペース含むトリム */
function ztrim(s) { return String(s || "").replace(/[\u3000\s]+/g, " ").trim(); }

/** GAS URL を /exec に正規化 */
function normalizeExecUrl(u) {
  var s = ztrim(u);
  if (!s) return "";
  try {
    var url = new URL(s);
    if (!/\/exec$/.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/dev$/, "/exec");
      if (!/\/exec$/.test(url.pathname)) url.pathname += "/exec";
    }
    return url.toString();
  } catch (e) {
    return "";
  }
}

/** キャッシュバスター付きURL */
function withBuster(u) {
  var base = normalizeExecUrl(u);
  if (!base) return "";
  var url = new URL(base);
  url.searchParams.set("_t", String(Date.now()));
  return url.toString();
}

/** JST フォーマット 'YYYY-MM-DD HH:mm:ss' */
function formatJST(d) {
  var jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  var y = jst.getUTCFullYear();
  var m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  var day = String(jst.getUTCDate()).padStart(2, "0");
  var hh = String(jst.getUTCHours()).padStart(2, "0");
  var mm = String(jst.getUTCMinutes()).padStart(2, "0");
  var ss = String(jst.getUTCSeconds()).padStart(2, "0");
  return y + "-" + m + "-" + day + " " + hh + ":" + mm + ":" + ss;
}

/** 'YYYY-MM' フォーマット (month0 は 0-indexed) */
function fmtYM(year, month0) {
  var m = month0 + 1;
  return year + "-" + String(m).padStart(2, "0");
}

/** Date → 'YYYY-MM-DD' */
function isoDate(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var dd = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + dd;
}

/** シフト値サイクル: '' → '1' → '2' → '×' → '' */
function cycleValue(v) {
  switch (v) {
    case "": return "1";
    case "1": return "2";
    case "2": return "×";
    case "×": return "";
    default: return "";
  }
}

/** 確定シフトを cells にマージ（同日上書き） */
function mergeConfirmedCells(baseCells, items, monthKey) {
  var out = Object.assign({}, baseCells || {});
  if (!Array.isArray(items)) return out;
  var key = String(monthKey || "");
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var d = String((it && (it.date || it["\u65e5\u4ed8"])) || "");
    if (!d || (key && !d.startsWith(key))) continue;
    var v = String(it.wish || it.value || it.shift || it["\u78ba\u5b9a"] || "").trim();
    if (v === "1" || v === "2" || v === "\u00d7" || v === "") {
      out[d] = v;
    }
  }
  return out;
}

/*************************
 * トースト通知
 *************************/
var TOASTS = [];
var TOAST_ID = 1;

function toast(text, ms) {
  if (ms === undefined) ms = 2200;
  var id = TOAST_ID++;
  TOASTS.push({ id: id, text: text });
  window.dispatchEvent(new Event("__toast__"));
  setTimeout(function () {
    var i = TOASTS.findIndex(function (t) { return t.id === id; });
    if (i >= 0) TOASTS.splice(i, 1);
    window.dispatchEvent(new Event("__toast__"));
  }, ms);
}
