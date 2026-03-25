import { useState, useEffect } from "react";
import { Users, Calendar, Bell, Settings, Download, Upload, Save, Loader2 } from "lucide-react";
import { Button } from "./components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { StaffTab } from "./components/StaffTab";
import { DesiredShiftsTab } from "./components/DesiredShiftsTab";
import { ConfirmedShiftsTab } from "./components/ConfirmedShiftsTab";
import { NotificationsTab } from "./components/NotificationsTab";
import { SystemTab } from "./components/SystemTab";
import { callApi, getGasUrl } from "./lib/api";
import { DEFAULTS } from "./lib/defaults";
import { loadState, saveState } from "./lib/storage";
import { rid, fmtYM } from "./lib/utils";

function ensureRids(staff) {
  return (staff || []).map((s) => ({ ...s, _rid: s._rid || rid() }));
}

export default function App() {
  const [state, setState] = useState(() => {
    const saved = loadState();
    if (saved) return { ...DEFAULTS, ...saved, staff: ensureRids(saved.staff || DEFAULTS.staff) };
    return { ...DEFAULTS, staff: ensureRids(DEFAULTS.staff) };
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("staff");
  const [selectedStaff, setSelectedStaff] = useState(state.staff[0]?.staffId || "");
  const [currentMonth, setCurrentMonth] = useState(fmtYM(new Date()));
  const [wishesByDate, setWishesByDate] = useState({});
  const [confirmedByDate, setConfirmedByDate] = useState({});
  const [initDone, setInitDone] = useState(false);

  // Persist to localStorage on state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Load from GAS on mount
  useEffect(() => {
    (async () => {
      const url = getGasUrl();
      if (!url) { setInitDone(true); return; }
      const res = await callApi("getAdminState", {});
      if (res?.ok && res.data) {
        const d = res.data;
        setState((prev) => ({
          ...prev,
          ...d,
          apiBase: prev.apiBase || url,
          staff: ensureRids(d.staff?.length ? d.staff : prev.staff),
          fixed: { ...DEFAULTS.fixed, ...prev.fixed, ...(d.fixed || {}) },
          events: { ...DEFAULTS.events, ...prev.events, ...(d.events || {}) },
        }));
        if (d.staff?.length && !selectedStaff) {
          setSelectedStaff(d.staff[0].staffId);
        }
      }
      setInitDone(true);
    })();
  }, []);

  const saveAll = async () => {
    setSaving(true);
    const res = await callApi("saveAdminAll", state);
    if (!res?.ok) alert("保存に失敗しました。API設定を確認してください。\n" + (res?.error || ""));
    setSaving(false);
  };

  const exportJson = () => {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `admin-attendance-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("エクスポートに失敗しました: " + e.message);
    }
  };

  const importJson = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data?.staff && data?.desiredShifts) {
          setState({ ...DEFAULTS, ...data, staff: ensureRids(data.staff) });
        } else {
          alert("JSONの形式が正しくありません");
        }
      } catch {
        alert("JSONの読込に失敗しました");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-bold">勤怠管理・管理者版</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportJson}>
              <Download className="mr-2 h-4 w-4" />Export
            </Button>
            <label className="inline-flex items-center px-3 py-2 border rounded-2xl cursor-pointer hover:bg-slate-50 text-sm">
              <Upload className="mr-2 h-4 w-4" />Import
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); }}
              />
            </label>
            <Button onClick={saveAll} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              全体を保存
            </Button>
          </div>
        </div>

        {getGasUrl() && (
          <p className="text-sm text-slate-600 mb-4">
            API: <span className="font-mono">{getGasUrl()}</span>
          </p>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList>
            <TabsTrigger value="staff"><Users className="mr-2 h-4 w-4" />スタッフ情報</TabsTrigger>
            <TabsTrigger value="desired"><Calendar className="mr-2 h-4 w-4" />提出シフト</TabsTrigger>
            <TabsTrigger value="confirmed"><Calendar className="mr-2 h-4 w-4" />確定シフト</TabsTrigger>
            <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4" />通知設定</TabsTrigger>
            <TabsTrigger value="system"><Settings className="mr-2 h-4 w-4" />システム</TabsTrigger>
          </TabsList>

          <TabsContent value="staff">
            <StaffTab
              state={state} setState={setState}
              selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff}
            />
          </TabsContent>

          <TabsContent value="desired">
            <DesiredShiftsTab
              state={state} setState={setState}
              selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff}
              currentMonth={currentMonth} setCurrentMonth={setCurrentMonth}
              wishesByDate={wishesByDate} setWishesByDate={setWishesByDate}
              confirmedByDate={confirmedByDate} setConfirmedByDate={setConfirmedByDate}
            />
          </TabsContent>

          <TabsContent value="confirmed">
            <ConfirmedShiftsTab
              state={state}
              selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff}
              currentMonth={currentMonth} setCurrentMonth={setCurrentMonth}
              confirmedByDate={confirmedByDate} setConfirmedByDate={setConfirmedByDate}
            />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsTab state={state} setState={setState} />
          </TabsContent>

          <TabsContent value="system">
            <SystemTab state={state} setState={setState} onSaveAll={saveAll} saving={saving} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
