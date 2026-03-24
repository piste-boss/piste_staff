/*************************
 * config.js — アプリ設定（ハードコード）
 * GAS URL・テナントID等をここで一元管理
 *************************/
const CONFIG = {
  // GAS WebApp URL（デプロイ後に差し替え）
  GAS_EXEC_URL: "https://script.google.com/macros/s/AKfycbzK4M1R53aYdoznEgnxVeJVA6u5EpSKptrexvvqYh8jMSYiLIjprgXNOleAf2uWRbMyWg/exec",

  // LIFF ID（LINE Developers Console で取得）
  LIFF_ID: "YOUR_LIFF_ID",

  // テナントID（固定）
  TENANT_ID: "piste",

  // Google Calendar（確定シフト用）
  GOOGLE_CALENDAR_ID: "",   // 例: "xxxxx@group.calendar.google.com"
  GOOGLE_API_KEY: "",       // Google Cloud Console で取得（リファラー制限推奨）

  // アプリバージョン
  VERSION: "2.0.0",
};
