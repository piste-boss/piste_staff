/****************************************************
 * line.gs — LINE Messaging API 連携
 * Script Properties:
 *   LINE_CHANNEL_ACCESS_TOKEN — チャネルアクセストークン
 *   LINE_CHANNEL_SECRET       — チャネルシークレット
 *   LINE_ADMIN_UID            — 管理者の LINE UID（通知送信先）
 ****************************************************/

/** LINE Webhook 受信ハンドラ（doPost から呼ばれる） */
function handleLineWebhook_(e, body) {
  var events = body.events || [];
  Logger.log("handleLineWebhook_: eventCount=" + events.length + " body=" + JSON.stringify(body).slice(0, 300));
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    Logger.log("LINE event[" + i + "]: type=" + ev.type + " msgType=" + (ev.message ? ev.message.type : "N/A") + " source=" + JSON.stringify(ev.source || {}));
    try {
      if (ev.type === "follow") {
        handleLineFollow_(ev);
      } else if (ev.type === "message" && ev.message && ev.message.type === "text") {
        handleLineMessage_(ev);
      } else {
        Logger.log("LINE event skipped: type=" + ev.type);
      }
    } catch (err) {
      Logger.log("LINE event error: " + String(err && err.stack ? err.stack : err));
    }
  }
  // LINE には 200 OK を返す
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 友だち追加イベント：LINE UID をスタッフシートに記録（既にIDがあれば紐付け） */
function handleLineFollow_(ev) {
  var uid = ev.source && ev.source.userId ? ev.source.userId : "";
  if (!uid) return;

  // LIFF経由でプロフィール取得し名前を取得
  var displayName = "";
  try {
    var token = getLineToken_();
    var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/profile/" + uid, {
      headers: { "Authorization": "Bearer " + token },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() === 200) {
      var profile = JSON.parse(res.getContentText());
      displayName = profile.displayName || "";
    }
  } catch (e) {
    Logger.log("Profile fetch error: " + String(e));
  }

  // スタッフシートに LINE UID 列があれば書き込み
  var sh = getDB_().getSheetByName("\u30b9\u30bf\u30c3\u30d5");
  if (!sh) return;

  var hm = headerMap_(sh);
  var colUID = hm.find(["LINE UID", "lineUid", "LINE_UID"], false);
  if (colUID < 0) return; // LINE UID 列がなければスキップ

  var last = sh.getLastRow();
  if (last < 2) return;

  // 既存行に LINE UID が空のスタッフがいれば、名前一致で紐付け試行
  var colNM = hm.find(["\u540d\u524d", "name"], false);
  var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  for (var j = 0; j < vals.length; j++) {
    var existingUid = String(vals[j][colUID - 1] || "").trim();
    if (existingUid === uid) return; // 既に紐付け済み
  }

  // 名前一致で紐付け（同名がいる場合は最初の空UID行）
  if (displayName && colNM > 0) {
    for (var k = 0; k < vals.length; k++) {
      var nm = String(vals[k][colNM - 1] || "").trim();
      var uidCell = String(vals[k][colUID - 1] || "").trim();
      if (nm === displayName && !uidCell) {
        sh.getRange(2 + k, colUID).setValue(uid);
        sendLinePush_(uid, "\u53cb\u3060\u3061\u8ffd\u52a0\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059\uff01\u30b9\u30bf\u30c3\u30d5\u300c" + nm + "\u300d\u3068\u3057\u3066\u767b\u9332\u3057\u307e\u3057\u305f\u3002");
        return;
      }
    }
  }

  // 紐付けできなかった場合は通知のみ
  sendLinePush_(uid, "\u53cb\u3060\u3061\u8ffd\u52a0\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059\uff01\u7ba1\u7406\u8005\u306b\u30b9\u30bf\u30c3\u30d5\u767b\u9332\u3092\u4f9d\u983c\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
}

/** テキストメッセージ処理 */
function handleLineMessage_(ev) {
  var uid = ev.source && ev.source.userId ? ev.source.userId : "";
  var text = String(ev.message.text || "").trim();
  writeDebugLog_("handleLineMessage_: uid=" + (uid ? uid.slice(0,8) + "..." : "EMPTY") + " text=" + text);

  // プロキシ経由ではreplyTokenが期限切れのため、常にpushで送信する
  function reply(msg) {
    Logger.log("LINE reply: " + msg);
    sendLinePush_(uid, msg);
  }

  // メールアドレスを抽出（「連携 email」または直接メールアドレスのみ）
  var emailInput = "";
  if (/^(連携|link)\s+/i.test(text)) {
    emailInput = text.replace(/^(連携|link)\s+/i, "").trim().toLowerCase();
  } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    // メールアドレスだけ送信された場合も連携扱い
    emailInput = text.toLowerCase();
  }

  if (emailInput) {
    if (emailInput.indexOf("@") < 0) {
      reply("メールアドレスの形式が正しくありません。\n例：連携 example@gmail.com");
      return;
    }
    if (!uid) {
      Logger.log("LINE連携エラー: uidが空です");
      return;
    }
    var sh = getDB_().getSheetByName("スタッフ");
    if (!sh) { reply("スタッフシートが見つかりません。"); return; }
    var hm = headerMap_(sh);
    var colEmail = hm.find(["メール", "メールアドレス", "email", "Email", "mail", "スタッフID", "staffId", "id"], true);
    var colUID   = hm.find(["LINE UID", "lineUid", "LINE_UID"], false);
    var colNM    = hm.find(["名前", "name"], false);
    Logger.log("LINE連携: colEmail=" + colEmail + " colUID=" + colUID + " colNM=" + colNM);
    if (colUID < 0) { reply("LINE UID列がシートにありません。管理者に連絡してください。"); return; }
    var last = sh.getLastRow();
    if (last < 2) { reply("スタッフが登録されていません。"); return; }
    var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
    Logger.log("LINE連携: 検索email=" + emailInput + " 行数=" + vals.length);
    for (var k = 0; k < vals.length; k++) {
      var rowEmail = String(vals[k][colEmail - 1] || "").toLowerCase().trim();
      if (rowEmail === emailInput) {
        var existingUid = String(vals[k][colUID - 1] || "").trim();
        if (existingUid && existingUid !== uid) {
          reply("このメールアドレスは既に別のLINEアカウントと連携されています。");
          return;
        }
        if (existingUid === uid) {
          var staffNameAlready = colNM > 0 ? String(vals[k][colNM - 1] || "") : "";
          reply("✅ 既にLINE連携済みです。\nスタッフ: " + (staffNameAlready || emailInput));
          return;
        }
        sh.getRange(2 + k, colUID).setValue(uid);
        var staffName = colNM > 0 ? String(vals[k][colNM - 1] || "") : "";
        Logger.log("LINE連携成功: " + emailInput + " → " + uid.slice(0,8) + "...");
        reply("✅ LINE連携が完了しました！\nスタッフ: " + (staffName || emailInput) + "\n今後シフトや打刻の通知が届きます。");
        return;
      }
    }
    reply("メールアドレス「" + emailInput + "」はスタッフに登録されていません。\n管理者に確認してください。");
    return;
  }

  // 簡易コマンド
  if (text === "シフト" || text === "shift") {
    reply("シフト管理はリッチメニューから「シフト管理」をタップしてください。");
    return;
  }
  if (text === "出勤" || text === "退勤") {
    reply("出退勤はリッチメニューから「出退勤」をタップしてください。");
    return;
  }
  if (text === "ヘルプ" || text === "help") {
    reply("【使い方】\n・LINE連携：メールアドレスを送信\n　例：example@gmail.com\n・シフト確認：「シフト」と送信\n・出退勤：「出勤」「退勤」と送信");
    return;
  }
}

/*************************
 * LINE API ヘルパー
 *************************/

/** Push Message（1対1送信） */
function sendLinePush_(lineUid, message) {
  if (!lineUid) { _proxyDebug.push("push:no_uid"); writeDebugLog_("sendLinePush_: NO UID"); return; }
  var token = getLineToken_();
  if (!token) { _proxyDebug.push("push:no_token"); writeDebugLog_("sendLinePush_: NO TOKEN"); return; }
  _proxyDebug.push("push:to=" + lineUid.slice(0,8) + "...");
  writeDebugLog_("sendLinePush_: to=" + lineUid.slice(0,8) + "... msg=" + message.slice(0, 50));
  try {
    var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
      },
      payload: JSON.stringify({
        to: lineUid,
        messages: [{ type: "text", text: message }],
      }),
      muteHttpExceptions: true,
    });
    var status = res.getResponseCode();
    var body = res.getContentText().slice(0, 150);
    _proxyDebug.push("push:status=" + status + " body=" + body);
    writeDebugLog_("sendLinePush_: status=" + status + " body=" + body);
  } catch (e) {
    _proxyDebug.push("push:error=" + String(e));
    writeDebugLog_("sendLinePush_: ERROR=" + String(e));
  }
}

/** Reply Message（Webhook応答用） */
function sendLineReply_(replyToken, message) {
  if (!replyToken) return;
  var token = getLineToken_();
  if (!token) return;
  try {
    UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
      },
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: "text", text: message }],
      }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    Logger.log("LINE reply error: " + String(e));
  }
}

/** 通知設定を読み込んでテンプレートを適用するヘルパー */
function applyTemplate_(templateStr, vars) {
  var msg = String(templateStr || "");
  for (var k in vars) {
    msg = msg.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k] || ""));
  }
  return msg;
}

/** LINE通知が有効かチェック */
function isLineNotifyEnabled_() {
  var n = readNotifications_();
  return n.fixed.useLINE !== false;
}

/** シフト提出通知（管理者向け） */
function notifyShiftSubmitted_(staffName, month) {
  if (!isLineNotifyEnabled_()) return;
  var adminUid = PropertiesService.getScriptProperties().getProperty("LINE_ADMIN_UID");
  if (!adminUid) return;
  var n = readNotifications_();
  var cfg = n.events.shiftSubmittedForAdmin;
  if (cfg && cfg.enabled === false) return;
  var tmpl = (cfg && cfg.template) || "【管理者通知】{staffName}さんが {month} の希望シフトを提出しました（提出日: {submittedAt}）。";
  var msg = applyTemplate_(tmpl, { staffName: staffName || "スタッフ", month: month, submittedAt: jstNow_() });
  sendLinePush_(adminUid, msg);
}

/** シフト確定通知（スタッフ向け） */
function notifyShiftConfirmed_(lineUid, staffName, month) {
  if (!lineUid || !isLineNotifyEnabled_()) return;
  var n = readNotifications_();
  var cfg = n.events.shiftConfirmedForStaff;
  if (cfg && cfg.enabled === false) return;
  var tmpl = (cfg && cfg.template) || "{staffName}さん、{month} のシフトが確定しました。確定日: {confirmedAt}。アプリでご確認ください。";
  var msg = applyTemplate_(tmpl, { staffName: staffName || "", month: month, confirmedAt: jstNow_() });
  sendLinePush_(lineUid, msg);
}

/** シフト提出確認通知（スタッフ向け） */
function notifyShiftSubmittedToStaff_(tenantId, staffId, staffName, month, count) {
  if (!isLineNotifyEnabled_()) return;
  var uid = getLineUidByStaffId_(tenantId, staffId);
  if (!uid) return;
  var msg = (staffName || "") + "さん、" + month + " のシフトを" + count + "件提出しました。";
  sendLinePush_(uid, msg);
}

/** 出勤通知（スタッフ向け） */
function notifyClockIn_(tenantId, staffId, staffName, clockInTime) {
  if (!isLineNotifyEnabled_()) return;
  var uid = getLineUidByStaffId_(tenantId, staffId);
  if (!uid) return;
  var n = readNotifications_();
  var cfg = n.events.clockIn;
  if (cfg && cfg.enabled === false) return;
  var time = String(clockInTime || "").slice(11, 16);
  var tmpl = (cfg && cfg.template) || "{staffName}さんの出勤を記録しました。\n出勤時刻: {clockInTime}";
  var msg = applyTemplate_(tmpl, { staffName: staffName || "", clockInTime: time });
  sendLinePush_(uid, msg);
}

/** 退勤通知（スタッフ向け） */
function notifyClockOut_(tenantId, staffId, staffName, clockInTime, clockOutTime, payroll) {
  if (!isLineNotifyEnabled_()) return;
  var uid = getLineUidByStaffId_(tenantId, staffId);
  if (!uid) return;
  var n = readNotifications_();
  var cfg = n.events.clockOut;
  if (cfg && cfg.enabled === false) return;
  var inTime = String(clockInTime || "").slice(11, 16);
  var outTime = String(clockOutTime || "").slice(11, 16);
  var hours = payroll && payroll.hours ? Number(payroll.hours).toFixed(2) : "0";
  var amount = payroll && payroll.amount ? payroll.amount : 0;
  var tmpl = (cfg && cfg.template) || "{staffName}さんの退勤を記録しました。\n出勤: {clockInTime} → 退勤: {clockOutTime}\n勤務時間: {hours}h / {amount}円";
  var msg = applyTemplate_(tmpl, { staffName: staffName || "", clockInTime: inTime, clockOutTime: outTime, hours: hours, amount: amount });
  sendLinePush_(uid, msg);
}

/** メール(=staffId)からLINE UIDを取得するヘルパー */
function getLineUidByStaffId_(tenantId, staffId) {
  var sh = getDB_().getSheetByName("\u30b9\u30bf\u30c3\u30d5");
  if (!sh) return "";
  var hm = headerMap_(sh);
  var colTID = hm.find(["\u30c6\u30ca\u30f3\u30c8ID", "tenantId"], true);
  var colEmail = hm.find(["\u30e1\u30fc\u30eb", "\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9", "email", "Email", "mail", "\u30b9\u30bf\u30c3\u30d5ID", "staffId", "id"], true);
  var colUID = hm.find(["LINE UID", "lineUid", "LINE_UID"], false);
  if (colUID < 0) return "";
  var last = sh.getLastRow();
  if (last < 2) return "";
  var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  var target = String(staffId || "").toLowerCase().trim();
  for (var i = 0; i < vals.length; i++) {
    var tid = ztrim(String(vals[i][colTID - 1] || ""));
    var rowEmail = String(vals[i][colEmail - 1] || "").toLowerCase().trim();
    if (tid === tenantId && rowEmail === target) {
      return String(vals[i][colUID - 1] || "").trim();
    }
  }
  return "";
}

/*************************
 * シフト締切リマインダー（毎月19日に実行）
 * GASエディタで時限トリガー設定:
 *   関数: sendShiftDeadlineReminder
 *   種類: 時間主導型 → 月ベースのタイマー → 19日 → 午前9時〜10時
 *************************/
function sendShiftDeadlineReminder() {
  if (!isLineNotifyEnabled_()) return;
  var n = readNotifications_();
  var cfg = n.fixed.shiftDeadlineDay;
  if (cfg && cfg.enabled === false) return;

  var sh = getDB_().getSheetByName("スタッフ");
  if (!sh) return;
  var hm = headerMap_(sh);
  var colUID = hm.find(["LINE UID", "lineUid", "LINE_UID"], false);
  var colNM  = hm.find(["名前", "name"], false);
  if (colUID < 0) return;

  var last = sh.getLastRow();
  if (last < 2) return;

  var now = new Date();
  var nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  var ym = Utilities.formatDate(nextMonth, "Asia/Tokyo", "yyyy-MM");
  var deadlineDate = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd");

  var tmpl = (cfg && cfg.template) || "{staffName}さん、本日が {month} のシフト提出締切日です（{deadlineDate}）。提出がまだの方は至急お願いします。";

  var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < vals.length; i++) {
    var uid = String(vals[i][colUID - 1] || "").trim();
    var name = colNM > 0 ? String(vals[i][colNM - 1] || "") : "";
    if (!uid) continue;
    var msg = applyTemplate_(tmpl, { staffName: name, month: ym, deadlineDate: deadlineDate });
    sendLinePush_(uid, msg);
  }
}

/** シフト提出 締切3日前リマインダー（GASトリガーで実行） */
function sendShiftReminder3DaysBefore() {
  if (!isLineNotifyEnabled_()) return;
  var n = readNotifications_();
  var cfg = n.fixed.shiftSubmitReminder3DaysBefore;
  if (cfg && cfg.enabled === false) return;

  var sh = getDB_().getSheetByName("スタッフ");
  if (!sh) return;
  var hm = headerMap_(sh);
  var colUID = hm.find(["LINE UID", "lineUid", "LINE_UID"], false);
  var colNM  = hm.find(["名前", "name"], false);
  if (colUID < 0) return;

  var last = sh.getLastRow();
  if (last < 2) return;

  var now = new Date();
  var nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  var ym = Utilities.formatDate(nextMonth, "Asia/Tokyo", "yyyy-MM");
  // 締切日 = 3日後
  var deadline = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  var deadlineDate = Utilities.formatDate(deadline, "Asia/Tokyo", "yyyy-MM-dd");

  var tmpl = (cfg && cfg.template) || "{staffName}さん、{month} のシフト提出締切まであと3日です。期限: {deadlineDate}。忘れずに提出してください。";

  var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < vals.length; i++) {
    var uid = String(vals[i][colUID - 1] || "").trim();
    var name = colNM > 0 ? String(vals[i][colNM - 1] || "") : "";
    if (!uid) continue;
    var msg = applyTemplate_(tmpl, { staffName: name, month: ym, deadlineDate: deadlineDate });
    sendLinePush_(uid, msg);
  }
}

/** トークン取得 */
function getLineToken_() {
  return PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN") || "";
}

/** LINE UID からスタッフ情報を取得 */
function getStaffByLineUid_(lineUid) {
  if (!lineUid) return null;
  var sh = getDB_().getSheetByName("\u30b9\u30bf\u30c3\u30d5");
  if (!sh) return null;

  var hm = headerMap_(sh);
  var colUID = hm.find(["LINE UID", "lineUid", "LINE_UID"], false);
  if (colUID < 0) return null;

  var colTID   = hm.find(["\u30c6\u30ca\u30f3\u30c8ID", "tenantId"], true);
  var colEmail = hm.find(["\u30e1\u30fc\u30eb", "\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9", "email", "Email", "mail", "\u30b9\u30bf\u30c3\u30d5ID", "staffId", "id"], true);
  var colNM    = hm.find(["\u540d\u524d", "name"], false);
  var colHW    = hm.find(["\u6642\u7d66", "hourly", "hourlyWage"], false);

  var last = sh.getLastRow();
  if (last < 2) return null;

  var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < vals.length; i++) {
    var uid = String(vals[i][colUID - 1] || "").trim();
    if (uid === lineUid) {
      return {
        tenantId: String(vals[i][colTID - 1] || ""),
        staffId: String(vals[i][colEmail - 1] || ""),
        email: String(vals[i][colEmail - 1] || ""),
        name: colNM > 0 ? String(vals[i][colNM - 1] || "") : "",
        hourlyWage: colHW > 0 ? Number(vals[i][colHW - 1] || 0) : 0,
        lineUid: lineUid,
      };
    }
  }
  return null;
}
