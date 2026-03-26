import { useState, useRef, useEffect } from "react";
import { Save, Loader2, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "./ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { CalendarGrid } from "./CalendarGrid";
import { callApi } from "../lib/api";
import { fmtYM } from "../lib/utils";

export function DesiredShiftsTab({
  state, setState, selectedStaff, setSelectedStaff, currentMonth, setCurrentMonth,
  wishesByDate, setWishesByDate, confirmedByDate, setConfirmedByDate,
}) {
  const [editMode, setEditMode] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const loading = useRef(false);

  const staffObj = state.staff.find((s) => s.staffId === selectedStaff) || state.staff[0];
  const key = `${selectedStaff}|${currentMonth}`;

  const navigateMonth = (delta) => {
    const [y, m] = currentMonth.split("-").map(Number);
    setCurrentMonth(fmtYM(new Date(y, m - 1 + delta, 1)));
  };

  const pullSubmissions = async () => {
    if (!selectedStaff || !currentMonth || loading.current) return;
    loading.current = true;
    setSyncing(true);
    try {
      const res = await callApi("getSubmittedShifts", {
        tenantId: staffObj?.tenantId || "",
        staffId: selectedStaff,
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
        setWishesByDate((prev) => ({ ...prev, [key]: map }));
      }
      // Also load confirmed
      const cRes = await callApi("getConfirmedShifts", {
        tenantId: staffObj?.tenantId || "",
        staffId: selectedStaff,
        month: currentMonth,
        sheetName: "確定シフト",
      });
      if (cRes?.ok && Array.isArray(cRes.items)) {
        const cmap = {};
        for (const it of cRes.items) {
          if (!it?.date) continue;
          const w = String(it.wish || "");
          if (w === "1" || w === "2" || w === "×") cmap[it.date] = w;
        }
        setConfirmedByDate((prev) => ({ ...prev, [key]: cmap }));
      }
    } finally {
      loading.current = false;
      setSyncing(false);
    }
  };

  // 自動同期: スタッフ・月が変わったら自動取得
  useEffect(() => {
    if (selectedStaff && currentMonth) {
      pullSubmissions();
    }
  }, [selectedStaff, currentMonth]);

  const toggleCell = (dateStr) => {
    if (editMode) {
      setWishesByDate((prev) => {
        const current = { ...(prev[key] || {}) };
        const v = current[dateStr] || "";
        current[dateStr] = v === "" ? "1" : v === "1" ? "2" : v === "2" ? "×" : "";
        return { ...prev, [key]: current };
      });
    }
  };

  const bulkConfirm = async () => {
    if (!staffObj) { alert("スタッフが選択されていません"); return; }
    const data = wishesByDate[key] || {};
    const items = Object.entries(data)
      .filter(([, w]) => w === "1" || w === "2" || w === "×")
      .map(([date, wish]) => ({ date, wish }));
    if (!items.length) { alert("確定できる提出シフトがありません"); return; }

    setConfirming(true);
    try {
      const res = await callApi("confirmShifts", {
        tenantId: staffObj.tenantId,
        staffId: selectedStaff,
        name: staffObj.name || "",
        month: currentMonth,
        items,
      });
      if (res?.ok) alert("この月の提出シフトを一括確定しました");
      else alert("一括確定に失敗しました: " + (res?.error || ""));
    } finally {
      setConfirming(false);
    }
  };

  const merged = editMode
    ? (wishesByDate[key] || {})
    : { ...(wishesByDate[key] || {}), ...(confirmedByDate[key] || {}) };

  return (
    <Card>
      <CardHeader><CardTitle>提出シフトの編集</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap">スタッフ選択</Label>
            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="スタッフ" /></SelectTrigger>
              <SelectContent>
                {state.staff.filter((s) => s.staffId).map((s) => (
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
          <div className="flex items-center gap-3">
            <Label className="whitespace-nowrap">編集モード</Label>
            <Switch checked={editMode} onCheckedChange={setEditMode} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={pullSubmissions} disabled={syncing}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              再同期
            </Button>
            <Button size="sm" variant="outline" onClick={bulkConfirm} disabled={confirming}>
              {confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              一括確定
            </Button>
          </div>
        </div>
        <CalendarGrid month={currentMonth} wishesByDate={merged} editMode={editMode} onToggle={toggleCell} />
      </CardContent>
    </Card>
  );
}
