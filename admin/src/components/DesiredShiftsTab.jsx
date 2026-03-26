import { useState, useRef, useEffect } from "react";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "./ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { callApi } from "../lib/api";
import { fmtYM, isoDate, monthDays, dayLabel } from "../lib/utils";

const WISH_LABEL = { "1": "1", "2": "2", "×": "×" };

const DOW_COLOR = {
  0: "bg-pink-50 text-rose-600",
  1: "bg-pink-50 text-rose-600",
  6: "bg-sky-50 text-sky-600",
};

export function DesiredShiftsTab({
  state, setState, selectedStaff, setSelectedStaff, currentMonth, setCurrentMonth,
  wishesByDate, setWishesByDate, confirmedByDate, setConfirmedByDate,
}) {
  const [syncing, setSyncing] = useState(false);
  const [allStaffWishes, setAllStaffWishes] = useState({});
  const loading = useRef(false);

  // 出勤依頼モーダル
  const [requestModal, setRequestModal] = useState(null); // { dateStr }
  const [requestStaff, setRequestStaff] = useState("");
  const [requestWish, setRequestWish] = useState("1");
  const [sending, setSending] = useState(false);

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

  useEffect(() => {
    if (currentMonth && validStaff.length > 0) {
      syncAll();
    }
  }, [currentMonth]);

  // 出勤依頼送信
  const sendWorkRequest = async () => {
    if (!requestStaff || !requestModal?.dateStr) return;
    const staffObj = validStaff.find((s) => s.staffId === requestStaff);
    if (!staffObj) return;
    setSending(true);
    try {
      const res = await callApi("sendWorkRequest", {
        tenantId: staffObj.tenantId || "piste",
        staffId: staffObj.staffId,
        name: staffObj.name || "",
        date: requestModal.dateStr,
        wish: requestWish,
      });
      if (res?.ok) {
        alert("出勤依頼を送信しました");
        setRequestModal(null);
      } else {
        alert("送信失敗: " + (res?.error || "不明なエラー"));
      }
    } finally {
      setSending(false);
    }
  };

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
            <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-sky-100 inline-block" />1: 9:30~</span>
            <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-emerald-100 inline-block" />2: 10:00~</span>
            <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-amber-100 inline-block" />×: 休</span>
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
                <th className="px-3 py-2 text-center font-semibold border-b whitespace-nowrap">依頼</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const dateStr = isoDate(d);
                const dow = d.getDay();
                const dowCls = DOW_COLOR[dow] || "";
                const isTueFri = dow >= 2 && dow <= 5;
                const workCount = isTueFri
                  ? validStaff.filter((s) => {
                      const w = allStaffWishes[s.staffId]?.[dateStr] || "";
                      return w === "1" || w === "2";
                    }).length
                  : 2;
                const isShort = isTueFri && workCount < 2;
                return (
                  <tr key={dateStr} className={`${dowCls || "hover:bg-slate-50"} ${isShort ? "ring-4 ring-inset ring-yellow-400 bg-yellow-50/50" : ""}`}>
                    <td className={`sticky left-0 z-10 px-3 py-1.5 border-b border-r whitespace-nowrap font-medium text-xs ${isShort ? "bg-yellow-50 text-yellow-800" : (dowCls || "bg-white")}`}>
                      {d.getDate()}({dayLabel(d)})
                      {isShort && <span className="ml-1 text-yellow-600 font-bold text-lg leading-none">!</span>}
                    </td>
                    {validStaff.map((s) => {
                      const wish = allStaffWishes[s.staffId]?.[dateStr] || "";
                      let cellCls = "px-3 py-1.5 border-b text-center text-xs font-semibold";
                      if (wish === "1") {
                        cellCls += " bg-sky-100 text-sky-700";
                      } else if (wish === "2") {
                        cellCls += " bg-emerald-100 text-emerald-700";
                      } else if (wish === "×" && isTueFri) {
                        cellCls += " bg-amber-100 text-amber-700";
                      } else if (wish === "×" && dow === 6) {
                        cellCls += " bg-sky-50 text-sky-300";
                      } else if (wish === "×" && (dow === 0 || dow === 1)) {
                        cellCls += " bg-pink-50 text-pink-300";
                      }
                      return (
                        <td key={s.staffId} className={cellCls}>
                          {WISH_LABEL[wish] || ""}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 border-b text-center">
                      {isTueFri && (
                        <button
                          onClick={() => {
                            setRequestModal({ dateStr });
                            setRequestStaff("");
                            setRequestWish("1");
                          }}
                          className="text-blue-500 hover:text-blue-700 p-1"
                          title="出勤依頼を送信"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* 出勤依頼モーダル */}
      {requestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) setRequestModal(null); }}>
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold mb-4">出勤依頼</h3>
            <p className="text-sm text-slate-600 mb-4">日付: <span className="font-semibold">{requestModal.dateStr}</span></p>

            <div className="space-y-3 mb-4">
              <div>
                <Label className="text-sm mb-1 block">スタッフ</Label>
                <Select value={requestStaff} onValueChange={setRequestStaff}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="スタッフを選択" /></SelectTrigger>
                  <SelectContent>
                    {validStaff.map((s) => (
                      <SelectItem key={s.staffId} value={s.staffId}>
                        {s.name || s.staffId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm mb-1 block">シフト</Label>
                <Select value={requestWish} onValueChange={setRequestWish}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (9:30~)</SelectItem>
                    <SelectItem value="2">2 (10:00~)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={sendWorkRequest} disabled={!requestStaff || sending} className="flex-1">
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                LINE で依頼送信
              </Button>
              <Button variant="outline" onClick={() => setRequestModal(null)}>閉じる</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
