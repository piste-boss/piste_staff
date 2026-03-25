import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "./ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { CalendarGrid } from "./CalendarGrid";
import { callApi } from "../lib/api";
import { fmtYM, isoDate, dayLabel } from "../lib/utils";

export function ConfirmedShiftsTab({
  state, selectedStaff, setSelectedStaff, currentMonth, setCurrentMonth,
  confirmedByDate, setConfirmedByDate,
}) {
  const [todayList, setTodayList] = useState([]);

  const staffObj = state.staff.find((s) => s.staffId === selectedStaff) || state.staff[0];
  const key = `${selectedStaff}|${currentMonth}`;

  const navigateMonth = (delta) => {
    const [y, m] = currentMonth.split("-").map(Number);
    setCurrentMonth(fmtYM(new Date(y, m - 1 + delta, 1)));
  };

  // Load confirmed shifts + today attendance
  useEffect(() => {
    const load = async () => {
      if (!selectedStaff || !currentMonth) return;
      const res = await callApi("getConfirmedShifts", {
        tenantId: staffObj?.tenantId || "",
        staffId: selectedStaff,
        month: currentMonth,
        sheetName: "確定シフト",
      });
      if (res?.ok && Array.isArray(res.items)) {
        const map = {};
        for (const it of res.items) {
          if (!it?.date) continue;
          const w = String(it.wish || "");
          if (w === "1" || w === "2" || w === "×") map[it.date] = w;
        }
        setConfirmedByDate((prev) => ({ ...prev, [key]: map }));
      }

      // Today attendance across all staff
      const today = isoDate(new Date());
      const list = [];
      for (const st of state.staff) {
        const r = await callApi("getConfirmedShifts", {
          tenantId: st.tenantId,
          staffId: st.staffId,
          month: currentMonth,
          sheetName: "確定シフト",
        });
        if (r?.ok && Array.isArray(r.items)) {
          const found = r.items.find((it) => it?.date === today && (it.wish === "1" || it.wish === "2"));
          if (found) list.push({ name: st.name || st.staffId, staffId: st.staffId, wish: found.wish });
        }
      }
      list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
      setTodayList(list);
    };
    load();
  }, [selectedStaff, currentMonth, state.staff]);

  const now = new Date();
  const todayLabel = `${now.getMonth() + 1}月${now.getDate()}日（${dayLabel(now)}）`;

  return (
    <Card>
      <CardHeader><CardTitle>確定シフト</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="text-sm text-slate-600">本日の出勤</div>
          <div className="mt-1 rounded-xl border p-3 bg-slate-50">
            <div className="font-semibold mb-1">{todayLabel}</div>
            {todayList.length === 0 ? (
              <div className="text-sm text-slate-500">該当なし</div>
            ) : (
              <ul className="text-sm space-y-1">
                {todayList.map((t) => (
                  <li key={t.staffId}>{t.name}：{t.wish}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap">スタッフ選択</Label>
            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="スタッフ" /></SelectTrigger>
              <SelectContent>
                {state.staff.map((s) => (
                  <SelectItem key={s._rid || s.staffId} value={s.staffId}>
                    {s.name || s.staffId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigateMonth(-1)} className="rounded-xl">前月</Button>
            <div className="font-semibold">{currentMonth}</div>
            <Button variant="outline" onClick={() => navigateMonth(1)} className="rounded-xl">翌月</Button>
          </div>
        </div>
        <CalendarGrid month={currentMonth} wishesByDate={confirmedByDate[key] || {}} editMode={false} />
      </CardContent>
    </Card>
  );
}
