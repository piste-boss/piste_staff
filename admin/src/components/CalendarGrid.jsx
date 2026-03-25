import { isoDate, monthDays } from "../lib/utils";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

export function CalendarGrid({ month, wishesByDate = {}, editMode, onToggle }) {
  const [y, m] = month.split("-").map(Number);
  const { first, days } = monthDays(y, m - 1);
  const offset = first.getDay();
  const cells = Array(offset).fill(null).concat(days);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-2xl border p-3 shadow-sm bg-white">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-600">
        {DOW.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 mt-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="h-12 rounded-xl" />;
          const key = isoDate(d);
          const val = wishesByDate[key] || "";
          const color =
            val === "1" ? "text-sky-600"
            : val === "2" ? "text-emerald-600"
            : val === "×" ? "text-rose-600"
            : "text-slate-400";
          const bg = editMode ? "bg-white hover:bg-slate-100 cursor-pointer" : "bg-white";
          return (
            <button
              key={key}
              onClick={() => onToggle?.(key)}
              disabled={!editMode && !onToggle}
              className={`h-12 rounded-xl border text-sm transition flex flex-col items-center justify-center ${bg}`}
              title={key}
            >
              <div className="leading-none">{d.getDate()}</div>
              <div className={`text-[10px] leading-none mt-0.5 ${color}`}>
                {val || (editMode ? "・" : "")}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
