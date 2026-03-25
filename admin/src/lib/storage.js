import { DEFAULTS } from "./defaults";
import { rid } from "./utils";

const KEY = "admin_piste_state";

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.staff) {
      parsed.staff = parsed.staff.map((s) => ({ ...s, _rid: s._rid || rid() }));
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}
