/*************************
 * auth.js — LIFF 認証 + スタッフ自動識別
 * 依存: config.js, utils.js, api.js
 *
 * 使い方:
 *   await Auth.init();
 *   var staff = Auth.getStaff(); // { staffId, staffName, lineUid }
 *************************/
var Auth = (function () {
  var _profile = null;   // LIFF profile
  var _staff = null;     // { staffId, staffName, lineUid }
  var _ready = false;

  /** LIFF 初期化 → ログイン → スタッフ照合 */
  async function init() {
    if (_ready) return;

    // LIFF SDK未読込 or LIFF ID未設定 → スキップ
    if (typeof liff === "undefined" || !CONFIG.LIFF_ID || CONFIG.LIFF_ID === "YOUR_LIFF_ID") {
      console.warn("LIFF not available, falling back to localStorage");
      _fallbackToLS();
      return;
    }

    try {
      await liff.init({ liffId: CONFIG.LIFF_ID });
    } catch (e) {
      console.error("LIFF init failed:", e);
      _fallbackToLS();
      return;
    }

    // 未ログインならログインページへ
    if (!liff.isLoggedIn()) {
      liff.login();
      return; // リダイレクトするのでここで終了
    }

    // プロフィール取得
    try {
      _profile = await liff.getProfile();
    } catch (e) {
      console.error("LIFF getProfile failed:", e);
      _fallbackToLS();
      return;
    }

    var lineUid = _profile.userId || "";
    LS.set("lineUid", lineUid);

    // GAS でスタッフ照合
    try {
      var r = await sendGAS({
        type: "syncStaff",
        tenantId: CONFIG.TENANT_ID,
        lineUid: lineUid,
      });
      if (r && r.ok) {
        _staff = {
          staffId: String(r.staffId || ""),
          staffName: String(r.name || ""),
          lineUid: lineUid,
        };
        LS.set("staffId", _staff.staffId);
        LS.set("staffName", _staff.staffName);
      } else {
        // LINE UID で見つからない場合は localStorage のstaffIdで再試行
        var fallbackSid = LS.get("staffId");
        if (fallbackSid) {
          var r2 = await sendGAS({
            type: "syncStaff",
            tenantId: CONFIG.TENANT_ID,
            staffId: fallbackSid,
            lineUid: lineUid,
          });
          if (r2 && r2.ok) {
            _staff = {
              staffId: fallbackSid,
              staffName: String(r2.name || ""),
              lineUid: lineUid,
            };
            LS.set("staffName", _staff.staffName);
          } else {
            _fallbackToLS();
          }
        } else {
          _fallbackToLS();
        }
      }
    } catch (e) {
      console.error("syncStaff failed:", e);
      _fallbackToLS();
    }

    _ready = true;
  }

  function _fallbackToLS() {
    _staff = {
      staffId: LS.get("staffId") || "",
      staffName: LS.get("staffName") || "",
      lineUid: LS.get("lineUid") || "",
    };
    _ready = true;
  }

  function getStaff() {
    return _staff || { staffId: "", staffName: "", lineUid: "" };
  }

  function getProfile() {
    return _profile;
  }

  function isInLine() {
    return typeof liff !== "undefined" && liff.isInClient && liff.isInClient();
  }

  function isReady() {
    return _ready;
  }

  return {
    init: init,
    getStaff: getStaff,
    getProfile: getProfile,
    isInLine: isInLine,
    isReady: isReady,
  };
})();
