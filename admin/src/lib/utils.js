import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function rid() {
  try {
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    return Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

export function fmtYM(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
}

export function isoDate(d) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthDays(year, month0) {
  const first = new Date(year, month0, 1);
  const last = new Date(year, month0 + 1, 0);
  const days = [];
  for (let i = 1; i <= last.getDate(); i++) days.push(new Date(year, month0, i));
  return { first, last, days };
}

export function dayLabel(d) {
  return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
}
