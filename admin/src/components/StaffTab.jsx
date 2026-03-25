import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "./ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { callApi } from "../lib/api";
import { rid } from "../lib/utils";

export function StaffTab({ state, setState, selectedStaff, setSelectedStaff }) {
  const [saving, setSaving] = useState(false);

  const update = (idx, patch) => {
    setState((s) => {
      const staff = [...s.staff];
      staff[idx] = { ...staff[idx], ...patch, _rid: staff[idx]._rid };
      return { ...s, staff };
    });
  };

  const remove = (idx) => {
    const sid = state.staff[idx]?.staffId;
    setState((s) => ({
      ...s,
      staff: s.staff.filter((_, i) => i !== idx),
      desiredShifts: s.desiredShifts.filter((d) => d.staffId !== sid),
    }));
    if (sid === selectedStaff) setSelectedStaff(state.staff[0]?.staffId || "");
  };

  const add = () => {
    const id = `s${Math.random().toString(36).slice(2, 6)}`;
    setState((s) => ({
      ...s,
      staff: [
        ...s.staff,
        {
          tenantId: s.staff[0]?.tenantId || "piste",
          staffId: id,
          name: "",
          hourlyWage: 1100,
          initialView: "1",
          _rid: rid(),
        },
      ],
    }));
    setSelectedStaff(id);
  };

  const save = async () => {
    const err = validate(state.staff);
    if (err) { alert(err); return; }
    setSaving(true);
    try {
      const staff = state.staff.map(({ _rid, ...rest }) => rest);
      const res = await callApi("saveStaff", { staff });
      if (res?.ok) alert("スタッフ情報を保存しました");
      else throw new Error(res?.error || "保存に失敗");
    } catch (e) {
      alert("スタッフ保存に失敗しました: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>スタッフ情報の編集</CardTitle></CardHeader>
      <CardContent>
        <div className="flex justify-end mb-3">
          <Button size="sm" variant="outline" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            保存
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">テナントID</th>
                <th className="py-2 pr-3">スタッフID</th>
                <th className="py-2 pr-3">氏名</th>
                <th className="py-2 pr-3">時給</th>
                <th className="py-2 pr-3">初期表示</th>
                <th className="py-2 pr-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {state.staff.map((s, i) => (
                <tr key={s._rid} className="border-b hover:bg-slate-50/80">
                  <td className="py-2 pr-3 min-w-[160px]">
                    <Input value={s.tenantId} onChange={(e) => update(i, { tenantId: e.target.value })} />
                  </td>
                  <td className="py-2 pr-3 min-w-[140px]">
                    <Input value={s.staffId} onChange={(e) => update(i, { staffId: e.target.value })} />
                  </td>
                  <td className="py-2 pr-3 min-w-[140px]">
                    <Input value={s.name || ""} onChange={(e) => update(i, { name: e.target.value })} />
                  </td>
                  <td className="py-2 pr-3 min-w-[120px]">
                    <Input type="number" value={s.hourlyWage} onChange={(e) => update(i, { hourlyWage: Number(e.target.value) })} />
                  </td>
                  <td className="py-2 pr-3 min-w-[140px]">
                    <Select value={s.initialView} onValueChange={(v) => update(i, { initialView: v })}>
                      <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="×">×</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant={selectedStaff === s.staffId ? "default" : "outline"} onClick={() => setSelectedStaff(s.staffId)}>
                        選択
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(i)}>削除</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-between">
          <div className="text-sm text-slate-500">スタッフ数：{state.staff.length}</div>
          <Button onClick={add}>スタッフを追加</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function validate(staff) {
  const ok = new Set(["1", "2", "×"]);
  for (const s of staff) {
    if (!s.tenantId || !s.staffId) return "テナントIDとスタッフIDは必須です";
    if (!ok.has(s.initialView)) return "初期表示は 1 / 2 / × のいずれかを選択してください";
    if (Number.isNaN(Number(s.hourlyWage))) return "時給は数値で入力してください";
  }
  return null;
}
