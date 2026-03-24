/*************************
 * api.js — GAS 通信ユーティリティ
 * CONFIG.GAS_EXEC_URL を使用（config.js 必須）
 *************************/

/** JSONP(GET) ヘルパ */
function getJSONPExec(execUrl, params) {
  return new Promise(function (resolve) {
    try {
      var base = normalizeExecUrl(execUrl || "");
      if (!base) return resolve({ ok: false, error: "no_url" });
      var cb = "__jsonp_cb_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      var url = new URL(base);
      var all = Object.assign({}, params || {}, { callback: cb, _t: String(Date.now()) });
      Object.keys(all).forEach(function (k) { url.searchParams.set(k, String(all[k])); });
      var s = document.createElement("script");
      window[cb] = function (data) {
        try { resolve(data); } finally {
          try { delete window[cb]; } catch (e) {}
          try { s.remove(); } catch (e) {}
        }
      };
      s.src = url.toString();
      document.body.appendChild(s);
    } catch (e) {
      resolve({ ok: false });
    }
  });
}

/** 読み取り系: POST優先 → JSONP フォールバック */
function sendGAS(payload) {
  var gasUrl = CONFIG.GAS_EXEC_URL;
  return _sendGASCore(gasUrl, payload);
}

function _sendGASCore(gasUrl, payload) {
  return new Promise(function (resolve) {
    (async function () {
      try {
        var url = withBuster(gasUrl);
        if (!url) return resolve({ ok: false, error: "no_url" });
        var res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(payload),
        });
        var text = await res.text();
        try {
          resolve(JSON.parse(text));
          return;
        } catch (e) {
          // JSONでなければJSONP
        }
      } catch (e) {
        // 例外時もJSONPへ
      }
      // JSONP フォールバック
      try {
        var execUrl = normalizeExecUrl(gasUrl);
        if (!execUrl) return resolve({ ok: false, error: "no_url" });
        var qp = {};
        Object.keys(payload || {}).forEach(function (k) {
          var v = payload[k];
          if (v == null) return;
          qp[k] = (typeof v === "object") ? JSON.stringify(v) : String(v);
        });
        resolve(await getJSONPExec(execUrl, qp));
      } catch (e2) {
        resolve({ ok: false, error: "jsonp_failed", detail: String(e2) });
      }
    })();
  });
}

/** 書き込み系: JSONP優先 → POST フォールバック（CORS回避） */
function sendGASWrite(payload) {
  var gasUrl = CONFIG.GAS_EXEC_URL;
  return _sendGASWrite(gasUrl, payload);
}

function _sendGASWrite(gasUrl, payload) {
  return new Promise(function (resolve) {
    (async function () {
      try {
        var execUrl = normalizeExecUrl(gasUrl);
        if (!execUrl) return resolve({ ok: false, error: "no_url" });
        var qp = {};
        Object.keys(payload || {}).forEach(function (k) {
          var v = payload[k];
          if (v == null) return;
          qp[k] = (typeof v === "object") ? JSON.stringify(v) : String(v);
        });
        var r = await getJSONPExec(execUrl, qp);
        if (r && (r.ok || r.via === "no-cors")) return resolve(r);
        // フォールバックでJSON POST
        var url = withBuster(execUrl);
        var res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(payload),
        });
        var text = await res.text();
        try {
          resolve(JSON.parse(text));
        } catch (e) {
          resolve(res.ok ? { ok: true, raw: text } : { ok: false, status: res.status, raw: text });
        }
      } catch (e) {
        resolve({ ok: false, error: "write_failed", detail: String(e) });
      }
    })();
  });
}
