const STORAGE_KEY = "admin_piste_state";

export function getGasUrl() {
  const win = typeof window !== "undefined" ? window.__GAS_URL__ : undefined;
  let ls;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.apiBase?.trim()) ls = parsed.apiBase.trim();
    }
  } catch {}
  const env = import.meta.env.VITE_GAS_URL;
  return normalize(win) || normalize(ls) || normalize(env);
}

function normalize(u) {
  if (!u || typeof u !== "string") return "";
  u = u.trim();
  if (u && !u.endsWith("/exec")) {
    u = u.replace(/\/exec\?.*$/, "/exec").replace(/\/?$/, "");
    if (!u.endsWith("/exec")) u += "/exec";
  }
  return u;
}

/** JSONP ヘルパ（GASのCORS制限を回避） */
function jsonpExec(gasUrl, type, params = {}) {
  return new Promise((resolve) => {
    try {
      const cbName = `__jsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const qs = new URLSearchParams({ type, callback: cbName, _t: String(Date.now()) });
      for (const [k, v] of Object.entries(params)) {
        if (v == null) continue;
        qs.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      }
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        resolve({ ok: false, error: "jsonp_timeout" });
        try { delete window[cbName]; } catch {}
        script.remove();
      }, 15000);
      window[cbName] = (data) => {
        clearTimeout(timer);
        resolve(data);
        try { delete window[cbName]; } catch {}
        script.remove();
      };
      script.onerror = () => {
        clearTimeout(timer);
        resolve({ ok: false, error: "jsonp_error" });
        try { delete window[cbName]; } catch {}
        script.remove();
      };
      script.src = `${gasUrl}?${qs.toString()}`;
      document.head.appendChild(script);
    } catch (e) {
      resolve({ ok: false, error: "jsonp_error", message: String(e?.message || e) });
    }
  });
}

export async function callApi(type, params = {}) {
  const gasUrl = getGasUrl();
  if (!gasUrl) return { ok: true, mock: true, reason: "no_api_base" };

  // JSONP優先（GASはCORSヘッダーを返さないため）
  const result = await jsonpExec(gasUrl, type, params);
  if (result?.ok !== false) return result;

  // フォールバック: no-cors POST（レスポンスは読めないが送信はできる）
  try {
    await fetch(gasUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ type, ...params }),
    });
    return { ok: true, via: "no-cors" };
  } catch (e) {
    return { ok: false, error: "all_failed", message: String(e?.message || e) };
  }
}
