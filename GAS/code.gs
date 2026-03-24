/****************************************************
 * Piste 勤怠・提出・管理 API（ES5 / JSON & JSONP / HTMLサービス）
 * 2025-10-10 完全版（提出・確定ともにE列「日付」ベース）
 * - state/syncStaff をフロント互換（defaultWish/初期表示シフト/defaultCalendar）
 * - getConfirmedShifts は E/F/G 既定・ヘッダー優先で {items:[{date,wish}]}
 ****************************************************/

/** ★参照DB固定：Script Properties に DB_SHEET_ID があれば openById、無ければ ActiveSS */
function getDB_() {
  var id = PropertiesService.getScriptProperties().getProperty('DB_SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function doPost(e) {
  // LINE Webhook 判定: body.events が存在 → LINE処理
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "";
    if (raw) {
      var body = JSON.parse(raw);
      if (body.events && Array.isArray(body.events)) {
        return handleLineWebhook_(e, body);
      }
    }
  } catch (_) {
    // JSON パース失敗 → 通常のAPIとして処理
  }
  return handle_(e, /*isGet=*/false);
}
function doGet(e)  { return handle_(e, /*isGet=*/true); }

/** WebApp 入口（JSON/JSONP） */
function handle_(e, isGet) {
  try {
    var p = isGet ? (e && e.parameter) : parseJson_(e);
    var t = String(p.type || "").toLowerCase();
    if (!t || t === "ping")         return out_(e, { ok:true, ts: jstNow_() });

    if (t === "state")              return handleState_(e, p);
    if (t === "syncstaff")          return handleSyncStaff_(e, p);

    if (t === "clockin")            return handleClockIn_(e, p);
    if (t === "clockout")           return handleClockOut_(e, p);

    if (t === "submitshifts")       return handleSubmitShifts_(e, p);      // 提出
    if (t === "getsubmittedshifts") return handleGetSubmittedShifts_(e, p);// 提出: E列（日付）

    if (t === "getconfirmedshifts") return handleGetConfirmedShifts_(e, p);// 確定: E/F/G

    if (t === "confirmshifts")      return handleConfirmShifts_(e, p);     // 管理

    if (t === "getadminstate")      return handleGetAdminState_(e, p);
    if (t === "savestaff")          return handleSaveStaff_(e, p);
    if (t === "savedesiredshifts")  return handleSaveDesiredShifts_(e, p);
    if (t === "savenotifications")  return handleSaveNotifications_(e, p);
    if (t === "saveadminall")       return handleSaveAdminAll_(e, p);

    return out_(e, { ok:true, ignored:true, type:t });
  } catch (err) {
    return out_(e, { ok:false, error:String(err && err.stack ? err.stack : err) });
  }
}

/** HTMLサービス：google.script.run.handleApi({type,...}) */
function handleApi(p) { try { return route_(p||{}); } catch (err) { return { ok:false, error:String(err) }; } }
function route_(p) {
  var t = String((p && p.type) || "").toLowerCase();
  if (!t || t === "ping") return { ok:true, ts: jstNow_() };
  function J(r){ return JSON.parse(r.getContent()); }

  if (t === "state")              return J(handleState_(null,p));
  if (t === "syncstaff")          return J(handleSyncStaff_(null,p));
  if (t === "clockin")            return J(handleClockIn_(null,p));
  if (t === "clockout")           return J(handleClockOut_(null,p));
  if (t === "submitshifts")       return J(handleSubmitShifts_(null,p));
  if (t === "getsubmittedshifts") return J(handleGetSubmittedShifts_(null,p));
  if (t === "getconfirmedshifts") return J(handleGetConfirmedShifts_(null,p));
  if (t === "confirmshifts")      return J(handleConfirmShifts_(null,p));
  if (t === "getadminstate")      return J(handleGetAdminState_(null,p));
  if (t === "savestaff")          return J(handleSaveStaff_(null,p));
  if (t === "savedesiredshifts")  return J(handleSaveDesiredShifts_(null,p));
  if (t === "savenotifications")  return J(handleSaveNotifications_(null,p));
  if (t === "saveadminall")       return J(handleSaveAdminAll_(null,p));
  return { ok:true, ignored:true, type:t };
}

/******************** ユーティリティ ********************/
function parseJson_(e) {
  var body = {};
  if (e && e.postData && e.postData.contents) {
    var ctype = String(e.postData.type||"");
    var txt = e.postData.contents;
    if (ctype.indexOf("application/json")>=0) {
      try{ body=JSON.parse(txt);}catch(err){ body={}; }
    } else if (ctype.indexOf("application/x-www-form-urlencoded")>=0) {
      body = Utilities.parseQueryString(txt);
    } else {
      try{ body=JSON.parse(txt);}catch(err){
        try{ body=Utilities.parseQueryString(txt);}catch(err2){ body={}; }
      }
    }
  }
  var q = (e && e.parameter) ? e.parameter : {};
  for (var k in q) if (body[k]==null) body[k]=q[k];
  ["items","desiredShifts","staff"].forEach(function(key){
    if (typeof body[key] === "string") { try { body[key] = JSON.parse(body[key]); } catch(_){} }
  });
  return body;
}
function ztrim(s){ return String(s||"").replace(/^[\s\u3000]+|[\s\u3000]+$/g,""); }
function out_(e, obj) {
  var cb = (e && e.parameter && e.parameter.callback) ? String(e.parameter.callback) : "";
  var s = JSON.stringify(obj);
  if (cb) return ContentService.createTextOutput(cb + "(" + s + ")").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}
function jstNow_() { return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'); }
function toYmd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd');
  var s = String(v || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/.exec(s);
  if (m) return [m[1], ("0"+m[2]).slice(-2), ("0"+m[3]).slice(-2)].join("-");
  return "";
}
function headerMap_(sh) {
  var lastCol = sh.getLastColumn();
  var raw = sh.getRange(1,1,1,lastCol).getValues()[0];
  var headers = raw.map(function(h){ return String(h||"").trim().replace(/（/g,"(").replace(/）/g,")"); });
  function find(cands, required) {
    for (var i=0;i<cands.length;i++){
      var n = cands[i].replace(/（/g,"(").replace(/）/g,")");
      var idx = headers.indexOf(n);
      if (idx >= 0) return idx + 1; // 1-based
    }
    if (required) throw new Error("列が見つかりません: " + JSON.stringify(cands));
    return -1;
  }
  return { headers: headers, find: find };
}

/********** シート自動作成のホワイトリスト制御 **********/
var ALLOWED_WRITE_SHEETS = Object.freeze({
  "提出シフト": true,
  "確定シフト": true,
  "打刻": true,
  "給与": true,
  "スタッフ": true,
  "通知": true
});
function getSheetOrNull_(name) { return getDB_().getSheetByName(String(name||"")); }
function getOrCreateSheetSafe_(name, headers) {
  name = String(name||"");
  if (!ALLOWED_WRITE_SHEETS[name]) throw new Error("write to disallowed sheet: " + name);
  var sh = getDB_().getSheetByName(name);
  if (!sh) sh = getDB_().insertSheet(name);
  var needCols = headers.length;
  var lastCol = Math.max(sh.getLastColumn(), needCols);
  var current = (sh.getLastRow() >= 1 && lastCol >= 1) ? sh.getRange(1,1,1,lastCol).getValues()[0] : [];
  var toWrite = current.length ? current.slice(0) : headers.slice(0);
  for (var c=0; c<needCols; c++) if (!toWrite[c]) toWrite[c] = headers[c];
  sh.getRange(1,1,1,Math.max(toWrite.length, needCols)).setValues([toWrite]);
  return sh;
}

/******************** スタッフ：読み取り/同期（フロント互換） ********************/
function handleState_(e, p) {
  var tenantFilter = ztrim(String(p.tenantId || p["テナントID"] || ""));
  var sh = getDB_().getSheetByName("スタッフ");
  if (!sh) return out_(e, { ok:false, error:"シート「スタッフ」がありません" });

  var hm = headerMap_(sh);
  var colTID  = hm.find(["テナントID","tenantId"], true);
  var colSID  = hm.find(["スタッフID","staffId","id"], true);
  var colNM   = hm.find(["名前","name"], false);
  var colHW   = hm.find(["時給","hourly","hourlyWage"], false);
  var colINIT = hm.find(["初期表示","初期表示シフト","initialView","defaultView"], false); // 任意

  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (last < 2) return out_(e, { ok:true, staff:[] });

  function normalizeInit(v){
    v=String(v||"").trim();
    if (v==="１") v="1"; if (v==="２") v="2";
    if (/^(x|X|✕|×|休)$/.test(v)) v="×";
    return (v==="1"||v==="2"||v==="×")?v:"";
  }

  var rg = sh.getRange(2, 1, last - 1, lastCol).getValues();
  var staff = [];
  for (var i = 0; i < rg.length; i++) {
    var row = rg[i];
    var tA = ztrim(String(row[colTID-1] || ""));
    if (tenantFilter && tA !== tenantFilter) continue;
    var init = colINIT>0 ? normalizeInit(row[colINIT-1]) : "";
    staff.push({
      tenantId   : tA,
      staffId    : String(row[colSID-1] || ""),
      name       : colNM>0 ? String(row[colNM-1] || "") : "",
      hourlyWage : colHW>0 ? Number(row[colHW-1] || 0) : 0,
      initialView: init || "1",                 // 既存互換
      // ★フロント互換キー（どれで読まれてもOK）
      "初期表示シフト": init,
      defaultWish: init,
      defaultCalendar: init
    });
  }
  return out_(e, { ok:true, staff: staff });
}

function handleSyncStaff_(e, p) {
  var tid = ztrim(String(p.tenantId || p["テナントID"] || ""));
  var sid = ztrim(String(p.staffId  || p["スタッフID"] || ""));
  var lineUid = ztrim(String(p.lineUid || p["lineUid"] || ""));
  var emailParam = ztrim(String(p.email || p["メール"] || p["メールアドレス"] || "")).toLowerCase();

  // いずれかの識別子が必要
  if (!emailParam && !lineUid && (!tid || !sid)) return out_(e, { ok:false, error:"email, staffId, or lineUid required" });

  var sh = getDB_().getSheetByName("スタッフ");
  if (!sh) return out_(e, { ok:false, error:"シート「スタッフ」がありません" });

  var hm = headerMap_(sh);
  var colTID  = hm.find(["テナントID","tenantId"], true);
  var colSID  = hm.find(["スタッフID","staffId","id"], true);
  var colNM   = hm.find(["名前","name"], false);
  var colHW   = hm.find(["時給","hourly","hourlyWage"], false);
  var colINIT = hm.find(["初期表示","初期表示シフト","initialView","defaultView"], false);
  var colUID  = hm.find(["LINE UID","lineUid","LINE_UID"], false);
  var colEmail = hm.find(["メール","メールアドレス","email","Email","mail"], false);

  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (last < 2) return out_(e, { ok:false, error:"台帳が空です" });

  function normalizeInit(v){
    v=String(v||"").trim();
    if (v==="１") v="1"; if (v==="２") v="2";
    if (/^(x|X|✕|×|休)$/.test(v)) v="×";
    return (v==="1"||v==="2"||v==="×")?v:"";
  }

  var rg = sh.getRange(2, 1, last - 1, lastCol).getValues();
  for (var j = 0; j < rg.length; j++) {
    var r = rg[j];
    var tA2 = ztrim(String(r[colTID-1] || ""));
    var tB2 = ztrim(String(r[colSID-1] || ""));
    var rowUid = colUID > 0 ? ztrim(String(r[colUID-1] || "")) : "";
    var rowEmail = colEmail > 0 ? ztrim(String(r[colEmail-1] || "")).toLowerCase() : "";

    // メールアドレス / LINE UID / テナント+スタッフID で照合
    var matched = false;
    if (emailParam && rowEmail && rowEmail === emailParam) {
      matched = true;
    } else if (lineUid && rowUid === lineUid) {
      matched = true;
    } else if (tid && sid && tA2 === tid && tB2 === sid) {
      matched = true;
    }

    if (matched) {
      // lineUid が送られてきていて未記録なら書き込み
      if (lineUid && colUID > 0 && !rowUid) {
        sh.getRange(2 + j, colUID).setValue(lineUid);
      }
    }

    if (matched) {
      var name   = colNM>0 ? String(r[colNM-1] || "") : "";
      var hourly = colHW>0 ? Number(r[colHW-1] || 0) : 0;
      var init   = colINIT>0? normalizeInit(r[colINIT-1]) : "";
      return out_(e, {
        ok:true,
        staffId: tB2,
        name:name,
        hourly:hourly,
        lineUid: rowUid || lineUid,
        initialView: init || "1",
        defaultWish: init,
        defaultCalendar: init
      });
    }
  }
  return out_(e, { ok:false, error:"staff not found" });
}

/******************** 打刻/給与 ********************/
function handleClockIn_(e, p) {
  var tid = ztrim(String(p.tenantId || p["テナントID"] || ""));
  var sid = ztrim(String(p.staffId  || p["スタッフID"] || ""));
  var name = String(p.name || p["名前"] || "");
  var inAt = toJstString_(p["出勤時刻"]);
  var ts = toJstString_(p["タイムスタンプ"]) || inAt || jstNow_();
  if (!tid || !sid) return out_(e, { ok:false, error:"tenantId, staffId required" });
  if (!inAt) inAt = ts;

  var sh = getOrCreateSheetSafe_("打刻", [
    "テナントID","スタッフID","名前","時給",
    "出勤時刻","退勤時刻","タイムスタンプ",
    "勤務時間(分)","勤務時間(時間)","金額(円)"
  ]);

  var hm = headerMap_(sh);
  var colTID = hm.find(["テナントID","tenantId"], true);
  var colSID = hm.find(["スタッフID","staffId","id"], true);
  var colNM  = hm.find(["名前","name"], false);
  var colHW  = hm.find(["時給","hourly","hourlyWage"], false);
  var colIN  = hm.find(["出勤時刻","出勤","in","clockIn"], true);

  // 同日二度押し禁止
  var last = sh.getLastRow();
  if (last >= 2) {
    var vals = sh.getRange(2,1,last-1,sh.getLastColumn()).getValues();
    var dateKey = inAt.slice(0,10);
    for (var i=0;i<vals.length;i++){
      var r = vals[i];
      var tA = ztrim(String(r[colTID-1]||""));
      var tB = String(r[colSID-1]||"");
      var rin= toJstString_(r[colIN-1]);
      if (tA===tid && tB===sid && rin && rin.slice(0,10)===dateKey) {
        return out_(e, { ok:false, error:"already_clocked_in_today" });
      }
    }
  }

  var row = sh.getLastRow()+1;
  sh.getRange(row, colTID).setValue(tid);
  sh.getRange(row, colSID).setValue(sid);
  if (colNM>0) sh.getRange(row, colNM).setValue(name);
  var hourly = getHourlyFromStaff_(tid, sid) || 0;
  if (colHW>0) { sh.getRange(row, colHW).setNumberFormat("0"); sh.getRange(row, colHW).setValue(hourly); }
  sh.getRange(row, colIN ).setValue(inAt);
  return out_(e, { ok:true, saved:1 });
}

function handleClockOut_(e, p) {
  var tid = ztrim(String(p.tenantId || p["テナントID"] || ""));
  var sid = ztrim(String(p.staffId  || p["スタッフID"] || ""));
  var name = String(p.name || p["名前"] || "");
  var outAt = toJstString_(p["退勤時刻"]);
  var ts = toJstString_(p["タイムスタンプ"]) || outAt || jstNow_();
  if (!tid || !sid) return out_(e, { ok:false, error:"tenantId, staffId required" });
  if (!outAt) outAt = ts;

  var sh = getOrCreateSheetSafe_("打刻", [
    "テナントID","スタッフID","名前","時給",
    "出勤時刻","退勤時刻","タイムスタンプ",
    "勤務時間(分)","勤務時間(時間)","金額(円)"
  ]);

  var hm = headerMap_(sh);
  var colTID = hm.find(["テナントID","tenantId"], true);
  var colSID = hm.find(["スタッフID","staffId","id"], true);
  var colNM  = hm.find(["名前","name"], false);
  var colHW  = hm.find(["時給","hourly","hourlyWage"], false);
  var colIN  = hm.find(["出勤時刻","出勤","in","clockIn"], true);
  var colOUT = hm.find(["退勤時刻","退勤","out","clockOut"], true);
  var colTS  = hm.find(["タイムスタンプ","timestamp","TS"], false);
  var colMIN = hm.find(["勤務時間(分)","勤務分","minutes"], false);
  var colH   = hm.find(["勤務時間(時間)","勤務時間","hours"], false);
  var colAMT = hm.find(["金額(円)","金額","amount"], false);

  var last = sh.getLastRow();
  if (last < 2) return out_(e, { ok:false, error:"no_open_clockin" });

  var rng = sh.getRange(2,1,last-1,sh.getLastColumn());
  var vals = rng.getValues();

  for (var i = vals.length - 1; i >= 0; i--) {
    var r = vals[i];
    var tA = ztrim(String(r[colTID-1]||""));
    var tB = String(r[colSID-1]||"");
    var nm = colNM>0 ? String(r[colNM -1]||"") : "";
    var hw = colHW>0 ? Number(r[colHW -1]||0) : 0;
    var inAt = toJstString_(r[colIN-1]);
    var outOld = String(r[colOUT-1]||"");

    if (tA===tid && tB===sid && inAt && !outOld) {
      var rowIdx = 2 + i;

      if (colNM>0 && !nm && name) sh.getRange(rowIdx, colNM ).setValue(name);
      if (colHW>0 && !hw) { hw = getHourlyFromStaff_(tid, sid) || 0; sh.getRange(rowIdx, colHW).setNumberFormat("0"); sh.getRange(rowIdx, colHW).setValue(hw); }

      sh.getRange(rowIdx, colOUT).setValue(outAt);
      if (colTS>0) sh.getRange(rowIdx, colTS ).setValue(ts);

      var minsRaw = diffMinutesClippedByCalendarDay_(inAt, outAt);
      if (!isFinite(minsRaw)) minsRaw = 0;
      var pr = calcPayroll_(minsRaw, hw);

      if (colMIN>0) { sh.getRange(rowIdx, colMIN).setNumberFormat("0"); sh.getRange(rowIdx, colMIN).setValue(pr.minsRounded); }
      if (colH  >0) { sh.getRange(rowIdx, colH  ).setNumberFormat("0.00"); sh.getRange(rowIdx, colH  ).setValue(pr.hours); }
      if (colAMT>0) { sh.getRange(rowIdx, colAMT).setNumberFormat("¥#,##0"); sh.getRange(rowIdx, colAMT).setValue(pr.amount); }

      // 給与追記
      var pay = getOrCreateSheetSafe_("給与", [
        "テナントID","スタッフID","名前","日付","出勤時刻","退勤時刻",
        "勤務時間(分)","勤務時間(時間)","時給","金額(円)","支給額","タイムスタンプ"
      ]);
      var pm = headerMap_(pay);
      var pTID = pm.find(["テナントID","tenantId"], true);
      var pSID = pm.find(["スタッフID","staffId"], true);
      var pNM  = pm.find(["名前","name"], false);
      var pDATE= pm.find(["日付","date"], false);
      var pIN  = pm.find(["出勤時刻","出勤","in"], true);
      var pOUT = pm.find(["退勤時刻","退勤","out"], true);
      var pMIN = pm.find(["勤務時間(分)","勤務分"], true);
      var pH   = pm.find(["勤務時間(時間)","勤務時間"], true);
      var pHW  = pm.find(["時給","hourly","hourlyWage"], true);
      var pAMT = pm.find(["金額(円)","金額","amount","支給額"], true);
      var pTS  = pm.find(["タイムスタンプ","timestamp","TS"], false);
      var pAMT_Yen = pm.find(["金額(円)","金額","amount"], false);
      var pAMT_Pay = pm.find(["支給額"], false);

      var inDate = inAt ? inAt.slice(0,10) : jstNow_().slice(0,10);
      var prow = pay.getLastRow()+1;

      if (pMIN>0) pay.getRange(prow, pMIN).setNumberFormat("0");
      if (pH  >0) pay.getRange(prow, pH  ).setNumberFormat("0.00");
      if (pHW >0) pay.getRange(prow, pHW ).setNumberFormat("0");
      if (pAMT_Yen>0) pay.getRange(prow, pAMT_Yen).setNumberFormat("¥#,##0");
      if (pAMT_Pay>0) pay.getRange(prow, pAMT_Pay).setNumberFormat("¥#,##0");

      pay.getRange(prow, pTID ).setValue(tid);
      pay.getRange(prow, pSID ).setValue(sid);
      if (pNM>0)   pay.getRange(prow, pNM ).setValue(nm || name || "");
      if (pDATE>0) pay.getRange(prow, pDATE).setValue(inDate);
      pay.getRange(prow, pIN  ).setValue(inAt);
      pay.getRange(prow, pOUT ).setValue(outAt);
      pay.getRange(prow, pMIN ).setValue(pr.minsRounded);
      pay.getRange(prow, pH   ).setValue(pr.hours);
      pay.getRange(prow, pHW  ).setValue(hw);
      if (pAMT_Yen>0) pay.getRange(prow, pAMT_Yen).setValue(pr.amount);
      if (pAMT_Pay>0) pay.getRange(prow, pAMT_Pay).setValue(pr.amount);
      pay.getRange(prow, pAMT ).setValue(pr.amount);
      if (pTS>0)   pay.getRange(prow, pTS ).setValue(ts);

      return out_(e, { ok:true, updatedRow: rowIdx, minutes: pr.minsRounded, hours: pr.hours, amount: pr.amount });
    }
  }
  return out_(e, { ok:false, error:"no_open_clockin" });
}

/******************** 提出（書込み：提出シフト固定） ********************/
function handleSubmitShifts_(e, p) {
  var tid = ztrim(String(p.tenantId || p["テナントID"] || ""));
  var sid = ztrim(String(p.staffId  || p["スタッフID"] || ""));
  var name = String(p.name || p["名前"] || "");
  var month = String(p.month || "");
  var items = p.items || [];

  if (!tid || !sid) return out_(e, { ok:false, error:"tenantId, staffId required" });
  if (typeof items === "string") { try { items = JSON.parse(items); } catch (_) { items = []; } }
  if (!items || !items.length) return out_(e, { ok:false, error:"no_items" });

  var sh = getOrCreateSheetSafe_("提出シフト", ["テナントID","スタッフID","名前","月","日付","希望","ステータス","タイムスタンプ"]);
  var nowJst = jstNow_();
  var rows = [];
  for (var i=0; i<items.length; i++) {
    var it = items[i] || {};
    rows.push([tid, sid, name, month, String(it.date||""), String(it.wish||""), String(it.status||""), nowJst]);
  }
  if (rows.length) sh.getRange(sh.getLastRow()+1, 1, rows.length, 8).setValues(rows);

  // LINE通知：管理者にシフト提出を通知
  try { notifyShiftSubmitted_(name || sid, month); } catch (_) {}

  return out_(e, { ok:true, saved: rows.length });
}

/******************** 提出（読み取り：E列「日付」で絞る） ********************/
function handleGetSubmittedShifts_(e, p) {
  var tid   = ztrim(String(p.tenantId || p["テナントID"] || ""));
  var sid   = ztrim(String(p.staffId  || p["スタッフID"] || ""));
  var month = String(p.month || "");            // "YYYY-MM"
  var name  = String(p.sheetName || "提出シフト");
  if (!sid) return out_(e, { ok:false, error:"staffId required" });

  var sh = getSheetOrNull_(name);
  if (!sh) return out_(e, { ok:true, items:[] });

  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (last < 2) return out_(e, { ok:true, items:[] });

  var headers = sh.getRange(1,1,1,lastCol).getValues()[0].map(function(h){ return String(h||"").trim(); });
  function findIdx(keys, def){ for (var i=0;i<keys.length;i++){ var j=headers.indexOf(keys[i]); if (j>=0) return j; } return (typeof def==="number"?def:-1); }
  var IDX_TID = findIdx(["テナントID","tenantId"], 0);
  var IDX_SID = findIdx(["スタッフID","staffId","id"], 1);
  var IDX_DATE= findIdx(["日付","date"], 4);    // E列（0-based 4）
  var IDX_WISH= findIdx(["希望","wish","シフト"], 5);

  var monthPrefix = month ? month.slice(0,7) : ""; // "YYYY-MM"

  var rg = sh.getRange(2,1,last-1,lastCol).getValues();
  var items = [];
  for (var r=0; r<rg.length; r++){
    var row = rg[r];
    var tA = ztrim(String(row[IDX_TID]||""));
    var tB = ztrim(String(row[IDX_SID]||""));
    var dt = toYmd_(row[IDX_DATE]);  // YYYY-MM-DD
    var wi = String(row[IDX_WISH]||"");
    if (tid && tA && tA !== tid) continue;
    if (tB !== sid) continue;
    if (!dt) continue;
    if (monthPrefix && dt.indexOf(monthPrefix) !== 0) continue;
    items.push({ date: dt, wish: wi });
  }
  return out_(e, { ok:true, items: items });
}

/******************** 確定（読み取り：E=日付 / F=1|2|× / G=ステータス=確定） ********************/
function handleGetConfirmedShifts_(e, p) {
  var tid   = ztrim(String(p.tenantId || p["テナントID"] || ""));
  var sid   = ztrim(String(p.staffId  || p["スタッフID"] || ""));
  var month = String(p.month || "");
  var name  = String(p.sheetName || "確定シフト");
  if (!tid || !sid) return out_(e, { ok:false, error:"tenantId, staffId required" });

  var sh = getSheetOrNull_(name);
  if (!sh) return out_(e, { ok:true, items:[] });

  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (last < 2) return out_(e, { ok:true, items:[] });

  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return String(h || "").trim(); });
  function findIdx(cands, defIdx) {
    for (var i=0;i<cands.length;i++){ var k=cands[i]; for (var j=0;j<headers.length;j++){ if (headers[j] === k) return j; } }
    return (typeof defIdx === "number" ? defIdx : -1);
  }

  var IDX_TID  = findIdx(["テナントID","tenantId"], 0);
  var IDX_SID  = findIdx(["スタッフID","staffId","id"], 1);
  var IDX_DATE = findIdx(["日付","date"], 4);  // 既定 E（0-based 4）
  var IDX_WISH = findIdx(["シフト","確定値","確定シフト","wish","value","shift"], 5); // 既定 F
  var IDX_STAT = findIdx(["ステータス","status","確定"], 6); // 既定 G

  var monthN = String(month||"").slice(0,7);

  var rg = sh.getRange(2, 1, last-1, lastCol).getValues();
  var items = [];
  for (var r=0; r<rg.length; r++){
    var row = rg[r];
    var tA  = ztrim(String(row[IDX_TID]  || ""));
    var tB  = ztrim(String(row[IDX_SID]  || ""));
    var d   = toYmd_(row[IDX_DATE]);
    var w   = ztrim(String(row[IDX_WISH] || ""));
    var st  = ztrim(String(row[IDX_STAT] || ""));
    if (tid && tA !== tid) continue;
    if (tB !== sid) continue;
    if (!d) continue;
    if (monthN && d.indexOf(monthN) !== 0) continue;
    var isConfirmed = (st === "確定" || st === "confirmed" || st === "CONFIRMED" || st === "true" || st === "TRUE" || st === "1" );
    if (!isConfirmed) continue;
    if (w !== "1" && w !== "2" && w !== "×") continue;
    items.push({ date: d, wish: w });
  }
  return out_(e, { ok:true, items: items });
}

/******************** 管理：一括確定（提出→確定シフトへ反映） ********************/
function handleConfirmShifts_(e, p) {
  var tid   = ztrim(String(p.tenantId || p["テナントID"] || ""));
  var sid   = ztrim(String(p.staffId  || p["スタッフID"] || ""));
  var name  = String(p.name || p["名前"] || "");
  var month = String(p.month || "");            // "YYYY-MM"
  var items = p.items || [];                    // [{date:"YYYY-MM-DD", wish:"1|2|×"}, ...]

  if (!tid || !sid || !month) return out_(e, { ok:false, error:"tenantId, staffId, month required" });
  if (typeof items === "string") { try { items = JSON.parse(items); } catch(_) { items = []; } }

  var sh = getOrCreateSheetSafe_("確定シフト", ["テナントID","スタッフID","名前","月","日付","希望","ステータス","タイムスタンプ"]);
  var hm = headerMap_(sh);
  var colTID  = hm.find(["テナントID","tenantId"], true);
  var colSID  = hm.find(["スタッフID","staffId","id"], true);
  var colNM   = hm.find(["名前","name"], false);
  var colMON  = hm.find(["月","month"], true);
  var colDATE = hm.find(["日付","date"], true);
  var colW    = hm.find(["希望","wish","シフト"], true);
  var colST   = hm.find(["ステータス","status"], true);
  var colTS   = hm.find(["タイムスタンプ","timestamp","TS"], false);

  // staffId+month を入れ替え
  var last = sh.getLastRow();
  if (last >= 2) {
    var vals = sh.getRange(2,1,last-1,sh.getLastColumn()).getValues();
    var keep = [];
    for (var i=0;i<vals.length;i++){
      var r = vals[i];
      var rTid = ztrim(String(r[colTID-1]||""));
      var rSid = String(r[colSID-1]||"");
      var rMon = String(r[colMON-1]||"");
      if (!(rTid===tid && rSid===sid && rMon===month)) keep.push(r);
    }
    sh.getRange(2,1,last-1,sh.getLastColumn()).clearContent();
    if (keep.length) sh.getRange(2,1,keep.length,sh.getLastColumn()).setValues(keep);
  }

  var now = jstNow_();
  var rows = [];
  for (var j=0;j<items.length;j++){
    var it = items[j] || {};
    var d  = toYmd_(it.date);
    var w  = String(it.wish||"");
    if (!d) continue;
    if (w!=="1" && w!=="2" && w!=="×") continue;
    rows.push([tid, sid, name, month, d, w, "確定", now]);
  }
  if (rows.length) sh.getRange(sh.getLastRow()+1, 1, rows.length, sh.getLastColumn()).setValues(rows);

  // Google Calendar にイベント作成
  try { createCalendarEvents_(name || sid, rows); } catch (_) {}

  // LINE通知：スタッフにシフト確定を通知
  try {
    var staffInfo = getStaffByLineUid_ ? null : null; // line.gs が無い場合のガード
    // スタッフシートから LINE UID を取得
    var staffSh = getDB_().getSheetByName("スタッフ");
    if (staffSh) {
      var shm = headerMap_(staffSh);
      var sColSID = shm.find(["スタッフID","staffId","id"], true);
      var sColUID = shm.find(["LINE UID","lineUid","LINE_UID"], false);
      var sColTID = shm.find(["テナントID","tenantId"], true);
      if (sColUID > 0) {
        var sLast = staffSh.getLastRow();
        if (sLast >= 2) {
          var sVals = staffSh.getRange(2,1,sLast-1,staffSh.getLastColumn()).getValues();
          for (var si=0; si<sVals.length; si++) {
            var sTid = ztrim(String(sVals[si][sColTID-1]||""));
            var sSid = String(sVals[si][sColSID-1]||"");
            if (sTid === tid && sSid === sid) {
              var sUid = String(sVals[si][sColUID-1]||"").trim();
              if (sUid) notifyShiftConfirmed_(sUid, name, month);
              break;
            }
          }
        }
      }
    }
  } catch (_) {}

  return out_(e, { ok:true, saved: rows.length });
}

/******************** Google Calendar イベント作成 ********************/
function createCalendarEvents_(staffName, rows) {
  var calId = PropertiesService.getScriptProperties().getProperty("GOOGLE_CALENDAR_ID");
  if (!calId) return;
  var cal = CalendarApp.getCalendarById(calId);
  if (!cal) return;

  for (var i = 0; i < rows.length; i++) {
    var dateStr = String(rows[i][4] || ""); // 日付列 (E)
    var wish = String(rows[i][5] || "");    // 希望列 (F)
    if (!dateStr || !wish) continue;

    var label = wish === "1" ? "9:30\u301c" : wish === "2" ? "10:00\u301c" : wish === "\u00d7" ? "\u4f11" : wish;
    var title = staffName + " " + label;

    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!m) continue;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

    // 既存イベントを削除してから再作成（重複防止）
    var existing = cal.getEventsForDay(d, { search: staffName });
    for (var k = 0; k < existing.length; k++) {
      existing[k].deleteEvent();
    }
    cal.createAllDayEvent(title, d);
  }
}

/******************** 管理：起動時一括初期化（起動時集計なし） ********************/
function handleGetAdminState_(e, p) {
  var data = {
    staff: readStaff_(),
    desiredShifts: [], // 自動集計はしない
    fixed: readNotifications_().fixed,
    events: readNotifications_().events
  };
  return out_(e, { ok:true, data:data });
}

/******************** 管理：スタッフ保存（初期表示対応） ********************/
function handleSaveStaff_(e, p) {
  var staff = p.staff || p["staff"];
  if (!Array.isArray(staff)) return out_(e, { ok:false, error:"staff array required" });

  var sh = getOrCreateSheetSafe_("スタッフ", ["テナントID","スタッフID","名前","時給","初期表示"]);
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2,1,last-1,Math.max(5, sh.getLastColumn())).clearContent();

  if (staff.length) {
    var idRange = sh.getRange(2, 2, staff.length, 1);
    idRange.setNumberFormat("@");
    try { idRange.clearDataValidations(); } catch(_) {}
  }
  function normalizeInit(v){
    v=String(v||"").trim();
    if (v==="１") v="1"; if (v==="２") v="2";
    if (/^(x|X|✕|×|休)$/.test(v)) v="×";
    return (v==="1"||v==="2"||v==="×")?v:"1";
  }

  var rows = [];
  for (var i=0;i<staff.length;i++) {
    var s = staff[i] || {};
    rows.push([
      String(s.tenantId||""),
      String(s.staffId||""),
      String(s.name||""),
      Number(s.hourlyWage||0),
      normalizeInit(s.initialView)
    ]);
  }
  if (rows.length) sh.getRange(2,1,rows.length,5).setValues(rows);
  return out_(e, { ok:true, saved: rows.length });
}

/******************** 管理：提出→desired 集約（表示用 — 現状未使用だが残置） ********************/
function readStaff_() {
  var sh = getDB_().getSheetByName("スタッフ");
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var hm = headerMap_(sh);
  var colTID  = hm.find(["テナントID","tenantId"], true);
  var colSID  = hm.find(["スタッフID","staffId","id"], true);
  var colNM   = hm.find(["名前","name"], false);
  var colHW   = hm.find(["時給","hourly","hourlyWage"], false);
  var colINIT = hm.find(["初期表示","初期表示シフト","initialView","defaultView"], false);

  function normalizeInit(v){
    v=String(v||"").trim();
    if (v==="１") v="1"; if (v==="２") v="2";
    if (/^(x|X|✕|×|休)$/.test(v)) v="×";
    return (v==="1"||v==="2"||v==="×")?v:"1";
  }

  var vals = sh.getRange(2,1,last-1,sh.getLastColumn()).getValues();
  var out = [];
  for (var i=0;i<vals.length;i++){
    var r = vals[i];
    out.push({
      tenantId    : String(r[colTID-1]||""),
      staffId     : String(r[colSID-1]||""),
      name        : colNM>0 ? String(r[colNM-1]||"") : "",
      hourlyWage  : colHW>0 ? Number(r[colHW-1]||0) : 0,
      initialView : colINIT>0 ? normalizeInit(r[colINIT-1]) : "1"
    });
  }
  return out;
}

function readDesiredFromSubmitted_() {
  var sh = getDB_().getSheetByName("提出シフト");
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var hm = headerMap_(sh);
  var cSID = hm.find(["スタッフID","staffId","id"], true);
  var cDATE= hm.find(["日付","date"], true);
  var cW   = hm.find(["希望","wish","シフト"], false);

  var vals = sh.getRange(2,1,last-1,sh.getLastColumn()).getValues();
  var m = {};
  for (var i=0;i<vals.length;i++){
    var r = vals[i];
    var sid = String(r[cSID-1]||"");
    var dateStr = toYmd_(r[cDATE-1]); // E列ベース
    if (!sid || !dateStr) continue;
    var mon = dateStr.slice(0,7);
    var wish= cW>0 ? String(r[cW-1]||"") : "";
    if (wish === "×") continue; // ×は希望に含めない
    var key = sid + "|" + mon;
    if (!m[key]) m[key] = { staffId:sid, month:mon, days:[] };
    m[key].days.push(dateStr);
  }
  var out = [];
  for (var k in m) { m[k].days.sort(); out.push(m[k]); }
  return out;
}

/******************** 通知：保存/読込 ********************/
function handleSaveNotifications_(e, p) {
  var fixed  = p.fixed  || {};
  var events = p.events || {};
  var sh = getOrCreateSheetSafe_("通知", ["key","value","updatedAt"]);
  var map = { fixed: JSON.stringify(fixed||{}), events: JSON.stringify(events||{}) };
  var now = jstNow_();

  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2,1,last-1,3).clearContent();

  var rows = [];
  for (var k in map) rows.push([k, map[k], now]);
  if (rows.length) sh.getRange(2,1,rows.length,3).setValues(rows);
  return out_(e, { ok:true, saved: rows.length });
}
function readNotifications_() {
  var sh = getDB_().getSheetByName("通知");
  var out = { fixed:{ enablePWA:false, topic:"shift",
    shiftSubmitReminder3DaysBefore:{enabled:true,time:"09:00",template:""},
    shiftDeadlineDay:{enabled:true,time:"09:00",template:""} }, events:{
    shiftConfirmedForStaff:{enabled:true, template:""},
    shiftSubmittedForAdmin:{enabled:true, template:""}
  }};
  if (!sh) return out;
  var last = sh.getLastRow();
  if (last < 2) return out;
  var vals = sh.getRange(2,1,last-1,3).getValues();
  for (var i=0;i<vals.length;i++){
    var k = String(vals[i][0]||"");
    var v = String(vals[i][1]||"");
    try { if (k === "fixed") out.fixed = JSON.parse(v); if (k === "events") out.events = JSON.parse(v); } catch(_) {}
  }
  return out;
}

/******************** まとめ保存（全体を保存） ********************/
function handleSaveAdminAll_(e, p) {
  var err = [];
  try {
    var s = p.staff || [];
    var r1 = JSON.parse(handleSaveStaff_(null, { staff: s }).getContent());
    if (!r1.ok) err.push("saveStaff:"+String(r1.error||""));
  } catch(ex){ err.push("saveStaff:"+String(ex)); }

  try {
    var d = p.desiredShifts || [];
    var r2 = JSON.parse(handleSaveDesiredShifts_(null, { desiredShifts: d }).getContent());
    if (!r2.ok) err.push("saveDesiredShifts:"+String(r2.error||""));
  } catch(ex){ err.push("saveDesiredShifts:"+String(ex)); }

  try {
    var f = p.fixed || {}, ev = p.events || {};
    var r3 = JSON.parse(handleSaveNotifications_(null, { fixed:f, events:ev }).getContent());
    if (!r3.ok) err.push("saveNotifications:"+String(r3.error||""));
  } catch(ex){ err.push("saveNotifications:"+String(ex)); }

  if (err.length) return out_(e, { ok:false, error: err.join(" | ") });
  return out_(e, { ok:true, saved:true });
}

/******************** 計算・時刻 ********************/
function diffMinutesClippedByCalendarDay_(inStr, outStr) {
  var inJ  = parseJstStringToDate_(inStr);
  var outJ = parseJstStringToDate_(outStr);
  if (isNaN(inJ.getTime()) || isNaN(outJ.getTime())) return NaN;
  var y = inJ.getFullYear(), m = inJ.getMonth(), d = inJ.getDate();
  var start = new Date(y, m, d, 0, 0, 0, 0);
  var end   = new Date(y, m, d, 23, 59, 59, 999);
  var s = Math.max(inJ.getTime(), start.getTime());
  var e = Math.min(outJ.getTime(), end.getTime());
  if (e <= s) return 0;
  return Math.floor((e - s) / 60000);
}
function calcPayroll_(minsRaw, hourly) {
  if (!isFinite(minsRaw) || minsRaw < 0) return { mins:0, minsRounded:0, hours:0, amount:0 };
  var minsRounded = Math.floor(minsRaw / 15) * 15;
  var hours = minsRounded / 60;
  var amount = Math.floor((+hourly || 0) * hours);
  return { mins: minsRaw, minsRounded: minsRounded, hours: hours, amount: amount };
}
function toJstString_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  var s = String(v || "");
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
  var iso = s.replace('T',' ').replace('Z','');
  var m = /^(\d{4})-(\d{2})-(\d{2})[ T]([0-9]{2}):([0-9]{2}):([0-9]{2})$/.exec(iso);
  if (m) {
    var d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
    return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  }
  return "";
}
function parseJstStringToDate_(s) {
  var m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})[ T]([0-9]{2}):([0-9]{2}):([0-9]{2})$/.exec(String(s||""));
  if (!m) return new Date(NaN);
  return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]);
}
function getHourlyFromStaff_(tenantId, staffId) {
  var sh = getOrCreateSheetSafe_("スタッフ", ["テナントID","スタッフID","名前","時給","初期表示"]);
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var vals = sh.getRange(2,1,last-1,5).getValues();
  for (var i=0;i<vals.length;i++){
    var r = vals[i];
    if (ztrim(String(r[0]||""))===tenantId && String(r[1]||"")===staffId) {
      return Number(r[3]||0);
    }
  }
  return 0;
}
