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

  // 簡易コマンド
  if (text === "\u30b7\u30d5\u30c8" || text === "shift") {
    sendLineReply_(ev.replyToken, "\u30b7\u30d5\u30c8\u7ba1\u7406\u306f\u30ea\u30c3\u30c1\u30e1\u30cb\u30e5\u30fc\u304b\u3089\u300c\u30b7\u30d5\u30c8\u7ba1\u7406\u300d\u3092\u30bf\u30c3\u30d7\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
    return;
  }
  if (text === "\u51fa\u52e4" || text === "\u9000\u52e4") {
    sendLineReply_(ev.replyToken, "\u51fa\u9000\u52e4\u306f\u30ea\u30c3\u30c1\u30e1\u30cb\u30e5\u30fc\u304b\u3089\u300c\u51fa\u9000\u52e4\u300d\u3092\u30bf\u30c3\u30d7\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
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

  var colTID = hm.find(["\u30c6\u30ca\u30f3\u30c8ID", "tenantId"], true);
  var colSID = hm.find(["\u30b9\u30bf\u30c3\u30d5ID", "staffId", "id"], true);
  var colNM  = hm.find(["\u540d\u524d", "name"], false);
  var colHW  = hm.find(["\u6642\u7d66", "hourly", "hourlyWage"], false);

  var last = sh.getLastRow();
  if (last < 2) return null;

  var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < vals.length; i++) {
    var uid = String(vals[i][colUID - 1] || "").trim();
    if (uid === lineUid) {
      return {
        tenantId: String(vals[i][colTID - 1] || ""),
        staffId: String(vals[i][colSID - 1] || ""),
        name: colNM > 0 ? String(vals[i][colNM - 1] || "") : "",
        hourlyWage: colHW > 0 ? Number(vals[i][colHW - 1] || 0) : 0,
        lineUid: lineUid,
      };
    }
  }
  return null;
}
