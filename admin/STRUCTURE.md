# 管理者アプリ（admin-piste.netlify.app）構造ドキュメント

## 概要
- **タイトル**: 勤怠管理・管理者版
- **技術スタック**: React 18 + Vite + Tailwind CSS
- **デプロイ先**: admin-piste.netlify.app (Netlify)
- **バックエンド**: Google Apps Script (GAS) — `GAS/code.gs` と共通

---

## 画面構成（5タブ）

### 1. スタッフ情報 (`tab: "staff"`)
- スタッフ一覧テーブル（テナントID / スタッフID / 氏名 / 時給 / 初期表示）
- 行ごとにインライン編集可能
- 初期表示: Select（1 / 2 / ×）
- 操作: 「選択」「削除」ボタン
- 「スタッフを追加」ボタン
- 「保存」→ `saveStaff` API
- スタッフ数表示

### 2. 提出シフト (`tab: "desired"`)
- スタッフ選択（Select）
- 月送り（前月 / 翌月）
- 編集モード（Switch トグル）
- カレンダーグリッド（7列 × N行）
  - 各日: クリックでシフト値トグル（1 → 2 → × → 空）
  - 色: 1=sky-600, 2=emerald-600, ×=rose-600
- 「提出から反映」→ `getSubmittedShifts` API
- 「一括確定」→ `confirmShifts` API

### 3. 確定シフト (`tab: "confirmed"`)
- 「本日の出勤」セクション（当日の確定シフトを全スタッフ分表示）
- スタッフ選択 + 月送り
- カレンダーグリッド（読み取り専用）
- データ: `getConfirmedShifts` API

### 4. 通知設定 (`tab: "notifications"`)
左右2カラム:

**左: 固定通知（PWA化時 / スタッフ向け）**
- PWA プッシュ通知を利用（Switch）
- Topic 入力欄
- シフト提出 締切3日前リマインド（Switch + 時刻 + テンプレート）
- シフト提出 締切当日（Switch + 時刻 + テンプレート）

**右: イベント通知**
- シフト確定（スタッフ向け）（Switch + テンプレート）
- シフト提出（管理者向け）（Switch + テンプレート）
- プレースホルダ: `{staffName}`, `{month}`, `{deadlineDate}`, `{submittedAt}`, `{confirmedAt}`
- 「保存」→ `saveNotifications` API

### 5. システム (`tab: "system"`)
- GAS WebApp URL 入力欄（`window.__GAS_URL__` に反映）
- 「設定を保存」→ `saveAdminAll` API

---

## ヘッダー共通操作
- **Export**: JSON形式でダウンロード（`admin-attendance-{timestamp}.json`）
- **Import**: JSONファイル読み込み
- **全体を保存**: `saveAdminAll` API（スタッフ + 通知を一括保存）

---

## API通信（`mt()` 関数）

### 通信フロー（3段階フォールバック）
1. `google.script.run.handleApi()` — GAS HTMLサービス内
2. `fetch()` POST（`Content-Type: application/json`、失敗時 `text/plain`）
3. JSONP GET（読み取り系のみ: `ping`, `getAdminState`, `getSubmittedShifts`, `state`, `getConfirmedShifts`）

### GAS URL 解決順序
1. `window.__GAS_URL__`
2. localStorage (`apiBase` キー)
3. 環境変数 (`VITE_GAS_URL` / `NEXT_PUBLIC_GAS_URL`)

### 使用API一覧

| API type | 用途 | メソッド |
|----------|------|----------|
| `getAdminState` | 初期データ読み込み（スタッフ + 通知） | GET/POST |
| `saveStaff` | スタッフ情報保存 | POST |
| `getSubmittedShifts` | 提出シフト取得（月・スタッフ別） | GET/POST |
| `getConfirmedShifts` | 確定シフト取得（月・スタッフ別） | GET/POST |
| `confirmShifts` | 提出→確定シフト一括確定 | POST |
| `saveNotifications` | 通知設定保存 | POST |
| `saveAdminAll` | 全体保存（スタッフ + 通知） | POST |

---

## 状態管理

### メイン state（`useState`）
```js
{
  apiBase: string,          // GAS URL
  staff: [
    {
      tenantId: string,
      staffId: string,      // = メールアドレス
      name: string,
      hourlyWage: number,
      initialView: "1" | "2" | "×",
      _rid: string          // ランダムID（React key用）
    }
  ],
  desiredShifts: [
    {
      staffId: string,
      month: "YYYY-MM",
      days: ["YYYY-MM-DD", ...]
    }
  ],
  fixed: {
    enablePWA: boolean,
    topic: string,
    shiftSubmitReminder3DaysBefore: {
      enabled: boolean,
      time: "HH:mm",
      template: string
    },
    shiftDeadlineDay: {
      enabled: boolean,
      time: "HH:mm",
      template: string
    }
  },
  events: {
    shiftConfirmedForStaff: { enabled: boolean, template: string },
    shiftSubmittedForAdmin: { enabled: boolean, template: string }
  }
}
```

### その他 state
- `selectedStaffId` (string) — 選択中スタッフ
- `currentMonth` (string) — 表示中月 "YYYY-MM"
- `wishesByDate` (Object) — `{ "staffId|YYYY-MM": { "YYYY-MM-DD": "1"|"2"|"×" } }`
- `confirmedByDate` (Object) — 同上（確定分）
- `editMode` (boolean) — 提出シフト編集モード
- `todayAttendance` (Array) — 本日の出勤者リスト
- `loading` / `confirming` (boolean)

---

## UIコンポーネント

### カスタムコンポーネント
| コンポーネント | 役割 |
|---------------|------|
| `Up` (App) | メインアプリコンポーネント |
| `Ru` (CalendarGrid) | 月間カレンダーグリッド（7x N） |
| `qr` (PlaceholderHint) | テンプレートのプレースホルダ説明 |

### UIプリミティブ（shadcn/ui ベース）
| ミニファイ名 | 推定コンポーネント | 用途 |
|-------------|-------------------|------|
| `ge` | Button | ボタン（variant: default/outline/destructive, size: sm/default） |
| `pt` | Input | テキスト入力 |
| `Jr` | Textarea | テキストエリア |
| `rn` | Switch | トグルスイッチ |
| `me` | Label | ラベル |
| `ji` | Select | セレクトボックス |
| `Ci` | SelectTrigger | Select トリガー |
| `Ei` | SelectPlaceholder | Select プレースホルダ |
| `_i` | SelectContent | Select コンテンツ |
| `un` | SelectItem | Select 項目 |
| `bt` | Card | カード |
| `en` | CardHeader | カードヘッダー |
| `tn` | CardTitle | カードタイトル |
| `nn` | CardContent | カードコンテンツ |
| `Cp` | Tabs | タブコンテナ |
| `Ep` | TabsList | タブリスト |
| `Yn` | TabsTrigger | タブボタン |
| `Gn` | TabsContent | タブコンテンツ |

### アイコン（Lucide React 推定）
| ミニファイ名 | 推定アイコン | 用途 |
|-------------|-------------|------|
| `Rp` | Users | スタッフ情報タブ |
| `Iu` | Calendar | 提出/確定シフトタブ |
| `Lp` | Bell | 通知設定タブ |
| `Tp` | Settings | システムタブ |
| `Dp` | Download | Export |
| `Ip` | Upload | Import |
| `on` | Save | 保存 |
| `ln` | Loader2 | ローディングスピナー |

---

## デフォルト値
```js
{
  apiBase: "",
  staff: [{
    tenantId: "demo-tenant",
    staffId: "s001",
    name: "山田 花子",
    hourlyWage: 1100,
    initialView: "1"
  }],
  desiredShifts: [{
    staffId: "s001",
    month: "YYYY-MM (current)",
    days: []
  }],
  fixed: {
    enablePWA: false,
    topic: "shift",
    shiftSubmitReminder3DaysBefore: {
      enabled: true,
      time: "09:00",
      template: "{staffName}さん、{month} のシフト提出締切まであと3日です。期限: {deadlineDate}。忘れずに提出してください。"
    },
    shiftDeadlineDay: {
      enabled: true,
      time: "09:00",
      template: "{staffName}さん、本日が {month} のシフト提出締切日です（{deadlineDate}）。提出がまだの方は至急お願いします。"
    }
  },
  events: {
    shiftConfirmedForStaff: {
      enabled: true,
      template: "{staffName}さん、{month} のシフトが確定しました。確定日: {confirmedAt}。アプリでご確認ください。"
    },
    shiftSubmittedForAdmin: {
      enabled: true,
      template: "【管理者通知】{staffName}さんが {month} の希望シフトを提出しました（提出日: {submittedAt}）。"
    }
  }
}
```

---

## localStorage 永続化
- キー: `ws` (ミニファイ済み、実際のキー名は不明)
- 保存内容: `{ apiBase: string }` を含むstate全体
- 読み込み: アプリ起動時にlocalStorageから復元、GAS APIからも `getAdminState` で取得

---

## ビルド構成（推定）
- **Vite** + React プラグイン
- **Tailwind CSS** (PostCSS統合)
- **shadcn/ui** コンポーネントライブラリ
- **Lucide React** アイコン
- 出力: `dist/assets/index-{hash}.js` + `dist/assets/index-{hash}.css`
