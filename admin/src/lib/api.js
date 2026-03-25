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

export async function callApi(type, params = {}) {
  const gasUrl = getGasUrl();
  if (!gasUrl) return { ok: true, mock: true, reason: "no_api_base" };

  const body = { type, ...params };

  // Step 1: fetch POST text/plain
  const tryPost = async (ct) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(gasUrl, {
        method: "POST",
        cache: "no-store",
        redirect: "follow",
        mode: "cors",
        headers: { "Content-Type": ct },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const text = await res.text().catch(() => "");
      try {
        return text ? JSON.parse(text) : {};
      } catch {
        return { ok: false, error: "invalid_json", body: text?.slice(0, 500) };
      }
    } catch (e) {
      clearTimeout(timer);
      return { ok: false, error: "failed_to_fetch", message: String(e?.message ?? e) };
    }
  };

  let result = await tryPost("text/plain;charset=utf-8");
  if (result?.ok !== false) return result;

  result = await tryPost("application/json");
  if (result?.ok !== false) return result;

  // Step 2: JSONP fallback for read endpoints
  const readTypes = new Set(["ping", "getAdminState", "getSubmittedShifts", "state", "getConfirmedShifts"]);
  if (readTypes.has(type)) {
    try {
      const cbName = `__jsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const qs = new URLSearchParams({ type, callback: cbName });
      for (const [k, v] of Object.entries(params)) {
        if (typeof v === "string") qs.set(k, v);
        else if (v != null) qs.set(k, JSON.stringify(v));
      }
      const script = document.createElement("script");
      const p = new Promise((resolve) => {
        window[cbName] = (data) => {
          resolve(data);
          try { delete window[cbName]; } catch {}
          script.remove();
        };
        script.onerror = () => {
          resolve({ ok: false, error: "jsonp_error" });
          try { delete window[cbName]; } catch {}
          script.remove();
        };
      });
      script.src = `${gasUrl}?${qs.toString()}`;
      document.head.appendChild(script);
      result = await p;
    } catch (e) {
      result = { ok: false, error: "jsonp_error", message: String(e?.message || e) };
    }
  }

  return result;
}
