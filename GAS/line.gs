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
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    try {
      if (ev.type === "follow") {
        handleLineFollow_(ev);
      } else if (ev.type === "message" && ev.message && ev.message.type === "text") {
        handleLineMessage_(ev);
      }
    } catch (err) {
      Logger.log("LINE event error: " + String(err));
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

/** テキストメッセージ処理（将来拡張用） */
function handleLineMessage_(ev) {
  var uid = ev.source && ev.source.userId ? ev.source.userId : "";
  var text = String(ev.message.text || "").trim();

  // プロキシ経由ではreplyTokenが期限切れのため、常にpushで送信する
  function reply(msg) {
    sendLinePush_(uid, msg);
  }

  // LINE連携コマンド：「連携 メールアドレス」
  if (/^(\u9023\u643a|link)\s+/.test(text)) {
    var emailInput = text.replace(/^(\u9023\u643a|link)\s+/, "").trim().toLowerCase();
    if (!emailInput || emailInput.indexOf("@") < 0) {
      reply("\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u306e\u5f62\u5f0f\u304c\u6b63\u3057\u304f\u3042\u308a\u307e\u305b\u3093\u3002\n\u4f8b\uff1a\u9023\u643a example@gmail.com");
      return;
    }
    var sh = getDB_().getSheetByName("\u30b9\u30bf\u30c3\u30d5");
    if (!sh) { reply("\u30b9\u30bf\u30c3\u30d5\u30b7\u30fc\u30c8\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002"); return; }
    var hm = headerMap_(sh);
    var colEmail = hm.find(["\u30e1\u30fc\u30eb", "\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9", "email", "Email", "mail", "\u30b9\u30bf\u30c3\u30d5ID", "staffId", "id"], true);
    var colUID   = hm.find(["LINE UID", "lineUid", "LINE_UID"], false);
    var colNM    = hm.find(["\u540d\u524d", "name"], false);
    if (colUID < 0) { reply("LINE UID\u5217\u304c\u30b7\u30fc\u30c8\u306b\u3042\u308a\u307e\u305b\u3093\u3002\u7ba1\u7406\u8005\u306b\u9023\u7d61\u3057\u3066\u304f\u3060\u3055\u3044\u3002"); return; }
    var last = sh.getLastRow();
    if (last < 2) { reply("\u30b9\u30bf\u30c3\u30d5\u304c\u767b\u9332\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002"); return; }
    var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
    for (var k = 0; k < vals.length; k++) {
      var rowEmail = String(vals[k][colEmail - 1] || "").toLowerCase().trim();
      if (rowEmail === emailInput) {
        var existingUid = String(vals[k][colUID - 1] || "").trim();
        if (existingUid && existingUid !== uid) {
          reply("\u3053\u306e\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u306f\u65e2\u306b\u5225\u306eLINE\u30a2\u30ab\u30a6\u30f3\u30c8\u3068\u9023\u643a\u3055\u308c\u3066\u3044\u307e\u3059\u3002");
          return;
        }
        sh.getRange(2 + k, colUID).setValue(uid);
        var staffName = colNM > 0 ? String(vals[k][colNM - 1] || "") : "";
        reply("\u2705 LINE\u9023\u643a\u304c\u5b8c\u4e86\u3057\u307e\u3057\u305f\uff01\n\u30b9\u30bf\u30c3\u30d5: " + (staffName || emailInput) + "\n\u4eca\u5f8c\u30b7\u30d5\u30c8\u3084\u6253\u523b\u306e\u901a\u77e5\u304c\u5c4a\u304d\u307e\u3059\u3002");
        return;
      }
    }
    reply("\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u300c" + emailInput + "\u300d\u306f\u30b9\u30bf\u30c3\u30d5\u306b\u767b\u9332\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002\n\u7ba1\u7406\u8005\u306b\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
    return;
  }

  // 簡易コマンド
  if (text === "\u30b7\u30d5\u30c8" || text === "shift") {
    reply("\u30b7\u30d5\u30c8\u7ba1\u7406\u306f\u30ea\u30c3\u30c1\u30e1\u30cb\u30e5\u30fc\u304b\u3089\u300c\u30b7\u30d5\u30c8\u7ba1\u7406\u300d\u3092\u30bf\u30c3\u30d7\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
    return;
  }
  if (text === "\u51fa\u52e4" || text === "\u9000\u52e4") {
    reply("\u51fa\u9000\u52e4\u306f\u30ea\u30c3\u30c1\u30e1\u30cb\u30e5\u30fc\u304b\u3089\u300c\u51fa\u9000\u52e4\u300d\u3092\u30bf\u30c3\u30d7\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
    return;
  }
}

/*************************
 * LINE API ヘルパー
 *************************/

/** Push Message（1対1送信） */
function sendLinePush_(lineUid, message) {
  if (!lineUid) return;
  var token = getLineToken_();
  if (!token) { Logger.log("LINE_CHANNEL_ACCESS_TOKEN not set"); return; }
  try {
    UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
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
  } catch (e) {
    Logger.log("LINE push error: " + String(e));
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

/** シフト提出通知（管理者向け） */
function notifyShiftSubmitted_(staffName, month) {
  var adminUid = PropertiesService.getScriptProperties().getProperty("LINE_ADMIN_UID");
  if (!adminUid) return;
  var msg = (staffName || "\u30b9\u30bf\u30c3\u30d5") + "\u304c" + month + "\u306e\u30b7\u30d5\u30c8\u3092\u63d0\u51fa\u3057\u307e\u3057\u305f\u3002";
  sendLinePush_(adminUid, msg);
}

/** シフト確定通知（スタッフ向け） */
function notifyShiftConfirmed_(lineUid, staffName, month) {
  if (!lineUid) return;
  var msg = (staffName || "") + "\u3055\u3093\u3001" + month + "\u306e\u30b7\u30d5\u30c8\u304c\u78ba\u5b9a\u3057\u307e\u3057\u305f\u3002\u30a2\u30d7\u30ea\u3067\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
  sendLinePush_(lineUid, msg);
}

/** シフト提出確認通知（スタッフ向け） */
function notifyShiftSubmittedToStaff_(tenantId, staffId, staffName, month, count) {
  var uid = getLineUidByStaffId_(tenantId, staffId);
  if (!uid) return;
  var msg = (staffName || "") + "\u3055\u3093\u3001" + month + "\u306e\u30b7\u30d5\u30c8\u3092" + count + "\u4ef6\u63d0\u51fa\u3057\u307e\u3057\u305f\u3002";
  sendLinePush_(uid, msg);
}

/** 出勤通知（スタッフ向け） */
function notifyClockIn_(tenantId, staffId, staffName, clockInTime) {
  var uid = getLineUidByStaffId_(tenantId, staffId);
  if (!uid) return;
  var time = String(clockInTime || "").slice(11, 16); // HH:mm
  var msg = (staffName || "") + "\u3055\u3093\u306e\u51fa\u52e4\u3092\u8a18\u9332\u3057\u307e\u3057\u305f\u3002\n\u51fa\u52e4\u6642\u523b: " + time;
  sendLinePush_(uid, msg);
}

/** 退勤通知（スタッフ向け） */
function notifyClockOut_(tenantId, staffId, staffName, clockInTime, clockOutTime, payroll) {
  var uid = getLineUidByStaffId_(tenantId, staffId);
  if (!uid) return;
  var inTime = String(clockInTime || "").slice(11, 16);
  var outTime = String(clockOutTime || "").slice(11, 16);
  var hours = payroll && payroll.hours ? Number(payroll.hours).toFixed(2) : "0";
  var amount = payroll && payroll.amount ? payroll.amount : 0;
  var msg = (staffName || "") + "\u3055\u3093\u306e\u9000\u52e4\u3092\u8a18\u9332\u3057\u307e\u3057\u305f\u3002\n" +
    "\u51fa\u52e4: " + inTime + " \u2192 \u9000\u52e4: " + outTime + "\n" +
    "\u52e4\u52d9\u6642\u9593: " + hours + "h / " + amount + "\u5186";
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
  var sh = getDB_().getSheetByName("\u30b9\u30bf\u30c3\u30d5");
  if (!sh) return;
  var hm = headerMap_(sh);
  var colUID = hm.find(["LINE UID", "lineUid", "LINE_UID"], false);
  var colNM  = hm.find(["\u540d\u524d", "name"], false);
  if (colUID < 0) return;

  var last = sh.getLastRow();
  if (last < 2) return;

  // 翌月の年月を計算
  var now = new Date();
  var nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  var ym = Utilities.formatDate(nextMonth, "Asia/Tokyo", "yyyy-MM");

  var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < vals.length; i++) {
    var uid = String(vals[i][colUID - 1] || "").trim();
    var name = colNM > 0 ? String(vals[i][colNM - 1] || "") : "";
    if (!uid) continue;
    var msg = (name ? name + "\u3055\u3093\u3001" : "") +
      "\u660e\u65e5\u304c" + ym + "\u306e\u30b7\u30d5\u30c8\u63d0\u51fa\u7de0\u5207\u3067\u3059\u3002\n\u307e\u3060\u63d0\u51fa\u3057\u3066\u3044\u306a\u3044\u5834\u5408\u306f\u3001\u4eca\u65e5\u4e2d\u306b\u63d0\u51fa\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
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
