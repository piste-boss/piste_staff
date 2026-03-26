import { useState, useRef, useEffect } from "react";
import { Save, Loader2, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { callApi } from "../lib/api";
import { fmtYM, isoDate, monthDays, dayLabel } from "../lib/utils";

const WISH_STYLE = {
  "1": "bg-sky-100 text-sky-700",
  "2": "bg-emerald-100 text-emerald-700",
};
const WISH_STYLE_OFF_WEEKDAY = "bg-amber-100 text-amber-700";  // 火〜金の休み
const WISH_STYLE_OFF_HOLIDAY = {                                // 土日月の休み（行背景と同色）
  0: "bg-pink-50 text-pink-300",
  1: "bg-pink-50 text-pink-300",
  6: "bg-sky-50 text-sky-300",
};
const WISH_LABEL = { "1": "1", "2": "2", "×": "×" };

const DOW_COLOR = {
  0: "bg-pink-50 text-rose-600",   // 日
  1: "bg-pink-50 text-rose-600",   // 月
  6: "bg-sky-50 text-sky-600",     // 土
};

export function DesiredShiftsTab({
  state, setState, selectedStaff, setSelectedStaff, currentMonth, setCurrentMonth,
  wishesByDate, setWishesByDate, confirmedByDate, setConfirmedByDate,
}) {
  const [syncing, setSyncing] = useState(false);
  // staffId -> { 'YYYY-MM-DD': '1'|'2'|'×' }
  const [allStaffWishes, setAllStaffWishes] = useState({});
  const loading = useRef(false);

  const validStaff = state.staff.filter((s) => s.staffId);

  const navigateMonth = (delta) => {
    const [y, m] = currentMonth.split("-").map(Number);
    setCurrentMonth(fmtYM(new Date(y, m - 1 + delta, 1)));
  };

  const syncAll = async () => {
    if (loading.current) return;
    loading.current = true;
    setSyncing(true);
    const result = {};
    try {
      await Promise.all(
        validStaff.map(async (s) => {
          const res = await callApi("getSubmittedShifts", {
            tenantId: s.tenantId || "",
            staffId: s.staffId,
            month: currentMonth,
            sheetName: "提出シフト",
          });
          if (res?.ok && Array.isArray(res.items)) {
            const map = {};
            for (const it of res.items) {
              if (!it?.date) continue;
              const w = String(it.wish || "");
              if (w === "1" || w === "2" || w === "×") map[it.date] = w;
            }
            result[s.staffId] = map;
          }
        })
      );
      setAllStaffWishes(result);
    } finally {
      loading.current = false;
      setSyncing(false);
    }
  };

  // 自動同期: 月が変わったら全スタッフ取得
  useEffect(() => {
    if (currentMonth && validStaff.length > 0) {
      syncAll();
    }
  }, [currentMonth]);

  // 日付一覧を生成
  const [y, m] = currentMonth.split("-").map(Number);
  const { days } = monthDays(y, m - 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>提出シフト一覧</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={syncAll} disabled={syncing}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              再同期
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <Button variant="outline" onClick={() => navigateMonth(-1)} className="rounded-xl">前月</Button>
          <div className="text-lg font-semibold">{currentMonth}</div>
          <Button variant="outline" onClick={() => navigateMonth(1)} className="rounded-xl">翌月</Button>
          <div className="flex items-center gap-3 ml-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-sky-100 inline-block" />1: 9:30〜</span>
            <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-emerald-100 inline-block" />2: 10:00〜</span>
            <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-rose-100 inline-block" />×: 休</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold border-b border-r whitespace-nowrap">
                  日付
                </th>
                {validStaff.map((s) => (
                  <th key={s.staffId} className="px-3 py-2 text-center font-semibold border-b whitespace-nowrap">
                    {s.name || s.staffId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const dateStr = isoDate(d);
                const dow = d.getDay();
                const dowCls = DOW_COLOR[dow] || "";
                // 火(2)〜金(5)で出勤者(1or2)が2人未満ならアラート
                const isTueFri = dow >= 2 && dow <= 5;
                const workCount = isTueFri
                  ? validStaff.filter((s) => {
                      const w = allStaffWishes[s.staffId]?.[dateStr] || "";
                      return w === "1" || w === "2";
                    }).length
                  : 2;
                const isShort = isTueFri && workCount < 2;
                return (
                  <tr key={dateStr} className={`${dowCls || "hover:bg-slate-50"} ${isShort ? "ring-2 ring-inset ring-red-500 bg-red-50/50" : ""}`}>
                    <td className={`sticky left-0 z-10 px-3 py-1.5 border-b border-r whitespace-nowrap font-medium text-xs ${isShort ? "bg-red-50 text-red-700" : (dowCls || "bg-white")}`}>
                      {d.getDate()}({dayLabel(d)})
                      {isShort && <span className="ml-1 text-red-500 font-bold">!</span>}
                    </td>
                    {validStaff.map((s) => {
                      const wish = allStaffWishes[s.staffId]?.[dateStr] || "";
                      let style = WISH_STYLE[wish] || "";
                      if (wish === "×") {
                        style = isTueFri
                          ? WISH_STYLE_OFF_WEEKDAY
                          : (WISH_STYLE_OFF_HOLIDAY[dow] || "");
                      }
                      return (
                        <td key={s.staffId} className={`px-3 py-1.5 border-b text-center text-xs font-semibold ${style}`}>
                          {WISH_LABEL[wish] || ""}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
