import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { PlaceholderHint } from "./PlaceholderHint";
import { callApi } from "../lib/api";

export function NotificationsTab({ state, setState }) {
  const [saving, setSaving] = useState(false);

  const updateFixed = (patch) =>
    setState((s) => ({ ...s, fixed: { ...s.fixed, ...patch } }));
  const updateEvents = (patch) =>
    setState((s) => ({ ...s, events: { ...s.events, ...patch } }));

  const save = async () => {
    setSaving(true);
    const res = await callApi("saveNotifications", { fixed: state.fixed, events: state.events });
    if (!res?.ok) alert("通知保存に失敗しました: " + (res?.error || ""));
    setSaving(false);
  };

  const { fixed, events } = state;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Left: scheduled */}
      <Card>
        <CardHeader><CardTitle>定期通知（LINE → スタッフ向け）</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">LINE通知を利用</Label>
              <p className="text-sm text-slate-600">LINE Messaging API でスタッフに通知を送信します。</p>
            </div>
            <Switch checked={fixed.useLINE} onCheckedChange={(v) => updateFixed({ useLINE: v })} />
          </div>

          <div className="flex items-end justify-end">
            <Button size="sm" variant="outline" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存
            </Button>
          </div>

          <hr className="my-2" />

          {/* 3-day reminder */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-medium">シフト提出 締切3日前リマインド</Label>
              <Switch
                checked={fixed.shiftSubmitReminder3DaysBefore.enabled}
                onCheckedChange={(v) => updateFixed({
                  shiftSubmitReminder3DaysBefore: { ...fixed.shiftSubmitReminder3DaysBefore, enabled: v },
                })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="md:col-span-1">
                <Label>送信時刻</Label>
                <Input
                  type="time"
                  value={fixed.shiftSubmitReminder3DaysBefore.time}
                  onChange={(e) => updateFixed({
                    shiftSubmitReminder3DaysBefore: { ...fixed.shiftSubmitReminder3DaysBefore, time: e.target.value },
                  })}
                />
              </div>
              <div className="md:col-span-5">
                <Label>テンプレート</Label>
                <Textarea
                  rows={3}
                  value={fixed.shiftSubmitReminder3DaysBefore.template}
                  onChange={(e) => updateFixed({
                    shiftSubmitReminder3DaysBefore: { ...fixed.shiftSubmitReminder3DaysBefore, template: e.target.value },
                  })}
                />
                <PlaceholderHint />
              </div>
            </div>
          </section>

          {/* Deadline day */}
          <section className="space-y-2">
            <div className="flex items-center justify-between mt-2">
              <Label className="font-medium">シフト提出 締切当日</Label>
              <Switch
                checked={fixed.shiftDeadlineDay.enabled}
                onCheckedChange={(v) => updateFixed({
                  shiftDeadlineDay: { ...fixed.shiftDeadlineDay, enabled: v },
                })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="md:col-span-1">
                <Label>送信時刻</Label>
                <Input
                  type="time"
                  value={fixed.shiftDeadlineDay.time}
                  onChange={(e) => updateFixed({
                    shiftDeadlineDay: { ...fixed.shiftDeadlineDay, time: e.target.value },
                  })}
                />
              </div>
              <div className="md:col-span-5">
                <Label>テンプレート</Label>
                <Textarea
                  rows={3}
                  value={fixed.shiftDeadlineDay.template}
                  onChange={(e) => updateFixed({
                    shiftDeadlineDay: { ...fixed.shiftDeadlineDay, template: e.target.value },
                  })}
                />
                <PlaceholderHint />
              </div>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* Right: event notifications */}
      <Card>
        <CardHeader><CardTitle>イベント通知（LINE自動送信）</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Shift confirmed */}
          <EventSection
            label="シフト確定（スタッフ向け）"
            cfg={events.shiftConfirmedForStaff}
            onChange={(v) => updateEvents({ shiftConfirmedForStaff: { ...events.shiftConfirmedForStaff, ...v } })}
          />
          {/* Shift submitted */}
          <EventSection
            label="シフト提出（管理者向け）"
            cfg={events.shiftSubmittedForAdmin}
            onChange={(v) => updateEvents({ shiftSubmittedForAdmin: { ...events.shiftSubmittedForAdmin, ...v } })}
            admin
          />
          {/* Clock in */}
          <EventSection
            label="出勤記録（スタッフ向け）"
            cfg={events.clockIn}
            onChange={(v) => updateEvents({ clockIn: { ...events.clockIn, ...v } })}
          />
          {/* Clock out */}
          <EventSection
            label="退勤記録（スタッフ向け）"
            cfg={events.clockOut}
            onChange={(v) => updateEvents({ clockOut: { ...events.clockOut, ...v } })}
          />

          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EventSection({ label, cfg, onChange, admin = false }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="font-medium">{label}</Label>
        <Switch checked={cfg.enabled} onCheckedChange={(v) => onChange({ enabled: v })} />
      </div>
      <div>
        <Label>テンプレート</Label>
        <Textarea
          rows={3}
          value={cfg.template}
          onChange={(e) => onChange({ template: e.target.value })}
        />
        <PlaceholderHint admin={admin} />
      </div>
    </section>
  );
}
