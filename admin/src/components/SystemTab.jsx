import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { callApi } from "../lib/api";

export function SystemTab({ state, setState, onSaveAll, saving }) {
  return (
    <Card>
      <CardHeader><CardTitle>システム設定</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>GAS WebApp URL</Label>
            <Input
              placeholder="https://script.google.com/macros/s/…/exec"
              defaultValue={state.apiBase || ""}
              onBlur={(e) => {
                const v = e.target.value?.trim();
                setState((s) => ({ ...s, apiBase: v }));
                if (typeof window !== "undefined") window.__GAS_URL__ = v;
              }}
              onChange={(e) => {
                const v = e.target.value?.trim();
                setState((s) => ({ ...s, apiBase: v }));
                if (typeof window !== "undefined") window.__GAS_URL__ = v;
              }}
            />
            <p className="text-xs text-slate-500 mt-1">
              window.__GAS_URL__ または環境変数でも可。未設定時はローカル保存のみ。
            </p>
          </div>
        </div>
        <div className="pt-2 flex items-center gap-2">
          <Button onClick={onSaveAll} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            設定を保存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
