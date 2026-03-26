/*************************
 * app.js — メインアプリ (index.html 用)
 * 依存: config.js, utils.js, api.js, auth.js, calendar.js
 *************************/
const { useEffect, useMemo, useState, useRef, useCallback } = React;

/*************************
 * 小物コンポーネント
 *************************/
function ToastHost() {
  var [, force] = useState(0);
  useEffect(function () {
    var h = function () { force(function (v) { return v + 1; }); };
    window.addEventListener("__toast__", h);
    return function () { window.removeEventListener("__toast__", h); };
  }, []);
  return (
    <div className="fixed bottom-20 left-0 right-0 flex flex-col items-center gap-2 px-3 pointer-events-none z-50">
      {TOASTS.map(function (t) {
        return (<div key={t.id} className="pointer-events-auto max-w-sm w-full bg-gray-900 text-white text-sm px-3 py-2 rounded-xl shadow">{t.text}</div>);
      })}
    </div>
  );
}

/*************************
 * LINE連携コンポーネント
 *************************/
function LineLink({ email }) {
  var [lineLinked, setLineLinked] = useState(false);
  var [checking, setChecking] = useState(false);

  // 連携状態を確認
  useEffect(function () {
    if (!email) return;
    setChecking(true);
    getJSONPExec(CONFIG.GAS_EXEC_URL, {
      type: "checkLineLink",
      tenantId: CONFIG.TENANT_ID,
      email: email,
    }).then(function (r) {
      if (r && r.ok && r.linked) setLineLinked(true);
      else setLineLinked(false);
      setChecking(false);
    }).catch(function () { setChecking(false); });
  }, [email]);

  // LINE連携実行
  function handleLinkLine() {
    if (!email) return toast("\u5148\u306b\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u3067\u540c\u671f\u3057\u3066\u304f\u3060\u3055\u3044");
    // LINE公式アカウントを友だち追加するよう案内
    // 友だち追加後、LINEで「連携 メールアドレス」と送信してもらう
    toast("LINE\u516c\u5f0f\u30a2\u30ab\u30a6\u30f3\u30c8\u306b\u300c\u9023\u643a " + email + "\u300d\u3068\u9001\u4fe1\u3057\u3066\u304f\u3060\u3055\u3044");
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{"\u30b9\u30c6\u30fc\u30bf\u30b9"}</span>
        {checking ? (
          <span className="text-sm text-gray-400">{"\u78ba\u8a8d\u4e2d\u2026"}</span>
        ) : (
          <span className={"text-sm font-semibold " + (lineLinked ? "text-green-600" : "text-gray-400")}>
            {lineLinked ? "\u2705 \u9023\u643a\u6e08\u307f" : "\u672a\u9023\u643a"}
          </span>
        )}
      </div>

      <div className="text-xs text-gray-500">
        {"LINE\u9023\u643a\u3059\u308b\u3068\u4ee5\u4e0b\u306e\u901a\u77e5\u304c\u5c4a\u304d\u307e\u3059\u3002"}
      </div>
      <ul className="text-xs text-gray-600 space-y-1 ml-3">
        <li>{"\u2022 \u30b7\u30d5\u30c8\u63d0\u51fa\u6642\u306e\u78ba\u8a8d\u901a\u77e5"}</li>
        <li>{"\u2022 \u30b7\u30d5\u30c8\u78ba\u5b9a\u6642\u306e\u304a\u77e5\u3089\u305b"}</li>
        <li>{"\u2022 \u30b7\u30d5\u30c8\u7de0\u5207\u524d\u65e5\uff0819\u65e5\uff09\u306e\u30ea\u30de\u30a4\u30f3\u30c0\u30fc"}</li>
        <li>{"\u2022 \u51fa\u52e4\u30fb\u9000\u52e4\u6642\u306e\u8a18\u9332\u901a\u77e5"}</li>
      </ul>

      {!lineLinked && (
        <div className="space-y-2">
          <div className="rounded-lg bg-green-50 p-3 text-xs text-gray-700">
            <div className="font-semibold mb-1">{"\u9023\u643a\u624b\u9806"}</div>
            <ol className="list-decimal ml-4 space-y-1">
              <li>{"LINE\u516c\u5f0f\u30a2\u30ab\u30a6\u30f3\u30c8\u3092\u53cb\u3060\u3061\u8ffd\u52a0"}</li>
              <li>{"LINE\u306e\u30c8\u30fc\u30af\u753b\u9762\u3067\u4ee5\u4e0b\u3092\u9001\u4fe1\uff1a"}</li>
            </ol>
            <div className="mt-2 bg-white rounded-lg p-2 text-center font-mono text-sm select-all border">
              {"\u9023\u643a " + (email || "(\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9)")}
            </div>
          </div>
          <button onClick={handleLinkLine} className="w-full py-3 rounded-xl bg-green-500 text-white font-semibold shadow-sm active:bg-green-600">
            {"\u9023\u643a\u72b6\u614b\u3092\u78ba\u8a8d"}
          </button>
        </div>
      )}
    </div>
  );
}

/*************************
 * メインアプリ
 *************************/
function Input({ label, value, onChange, placeholder, disabled }) {
  return (
    <label className="block">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <input className={"w-full rounded-xl border px-3 py-3 text-base " + (disabled ? "bg-gray-100 text-gray-400" : "")} value={value} onChange={function(e){ onChange(e.target.value); }} placeholder={placeholder} disabled={disabled} />
    </label>
  );
}

function StaffApp() {
  var [tab, setTab] = useState("home");
  var [staffId, setStaffId] = useState(LS.get("staffId") || "");
  var [staffName, setStaffName] = useState(LS.get("staffName") || "");
  var [email, setEmail] = useState(LS.get("email") || "");
  var [pendingCount, setPendingCount] = useState(0);
  var [loading, setLoading] = useState(true);
  var calContainerRef = useRef(null);
  var calInitialized = useRef(false);

  // LIFF認証 → スタッフ情報取得
  useEffect(function () {
    (async function () {
      try {
        await Auth.init();
        var staff = Auth.getStaff();
        if (staff.staffId) {
          setStaffId(staff.staffId);
          LS.set("staffId", staff.staffId);
        }
        if (staff.staffName) {
          setStaffName(staff.staffName);
          LS.set("staffName", staff.staffName);
        }
      } catch (e) {
        console.error("Auth init error:", e);
      }
      setLoading(false);
    })();
  }, []);

  // 確定シフトをロード（emailで検索）
  var loadConfirmedShifts = useCallback(async function (year, month0) {
    var addr = email || LS.get("email") || "";
    if (!addr) return;
    var monthKey = fmtYM(year, month0);
    try {
      var r = await getJSONPExec(CONFIG.GAS_EXEC_URL, {
        type: "getConfirmedShifts",
        tenantId: CONFIG.TENANT_ID,
        email: addr,
        month: monthKey,
        sheetName: "\u78ba\u5b9a\u30b7\u30d5\u30c8",
      });
      if (r && r.ok && Array.isArray(r.items)) {
        ShiftCalendar.setConfirmedShifts(r.items);
      }
    } catch (e) {
      // 失敗は黙殺
    }
  }, [email]);

  // FullCalendar 初期化
  useEffect(function () {
    if (loading || calInitialized.current || !calContainerRef.current) return;
    calInitialized.current = true;

    ShiftCalendar.init(calContainerRef.current, {
      onPendingChange: function (pending) {
        setPendingCount(Object.keys(pending).length);
      },
      onMonthChange: function (year, month0) {
        loadConfirmedShifts(year, month0);
      },
    });

    // レイアウト確定後にリサイズ + 初期シフト反映
    setTimeout(function () {
      var cal = ShiftCalendar.getCalendar();
      if (cal) cal.updateSize();
      var dw = LS.get("defaultWishOtherDays") || "";
      if (dw) ShiftCalendar.applyDefaultShifts(dw);
    }, 100);

    // 初回ロード
    var now = new Date();
    loadConfirmedShifts(now.getFullYear(), now.getMonth());
  }, [loading, loadConfirmedShifts]);

  // シフト提出
  async function handleSubmitShifts() {
    var addr = email || LS.get("email") || "";
    if (!addr) return toast("\u30de\u30a4\u30da\u30fc\u30b8\u3067\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u3092\u540c\u671f\u3057\u3066\u304f\u3060\u3055\u3044");
    var pending = ShiftCalendar.getPendingShifts();
    var items = Object.entries(pending).map(function (kv) {
      return { date: kv[0], wish: kv[1], status: "\u63d0\u51fa\u6e08\u307f" };
    });
    if (!items.length) return toast("\u63d0\u51fa\u3059\u308b\u30b7\u30d5\u30c8\u304c\u3042\u308a\u307e\u305b\u3093");

    // 月を推定（最初のアイテムから）
    var monthKey = items[0].date.slice(0, 7);

    toast("\u63d0\u51fa\u4e2d\u2026");
    try {
      var r = await sendGASWrite({
        type: "submitShifts",
        tenantId: CONFIG.TENANT_ID,
        email: addr,
        name: staffName || "",
        month: monthKey,
        items: items,
        sheetName: "\u63d0\u51fa\u30b7\u30d5\u30c8",
      });
      if (r && r.ok) {
        toast("\u30b7\u30d5\u30c8\u63d0\u51fa\u5b8c\u4e86\uff08" + (r.saved || items.length) + "\u4ef6\uff09");
        ShiftCalendar.clearPending();
      } else if (r && r.via === "no-cors") {
        toast("\u30b7\u30d5\u30c8\u63d0\u51fa\u5b8c\u4e86\uff08no-cors\uff09");
        ShiftCalendar.clearPending();
      } else {
        toast("\u63d0\u51fa\u306b\u5931\u6557\u3057\u307e\u3057\u305f" + (r && r.error ? ": " + r.error : ""));
      }
    } catch (e) {
      toast("\u63d0\u51fa\u30a8\u30e9\u30fc\uff1a\u901a\u4fe1\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044");
    }
  }

  // スタッフ同期（メールアドレスで検索、JSONP優先でCORS回避）
  async function handleSync() {
    var addr = ztrim(email);
    if (!addr) return toast("\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044");
    toast("\u540c\u671f\u4e2d\u2026");
    try {
      var r = await getJSONPExec(CONFIG.GAS_EXEC_URL, {
        type: "syncStaff",
        tenantId: CONFIG.TENANT_ID,
        email: addr,
      });
      console.log("syncStaff response:", JSON.stringify(r));
      if (r && r.ok) {
        var name = String(r.name || "");
        var sid = String(r.staffId || r.email || addr);
        if (name) { setStaffName(name); LS.set("staffName", name); }
        setStaffId(sid); LS.set("staffId", sid);
        setEmail(addr); LS.set("email", addr);
        // 初期表示シフトを保存 & カレンダーに反映
        var dw = String(r.defaultWish || r.initialView || "").trim();
        dw = (dw === "1" || dw === "2") ? dw : "";
        LS.set("defaultWishOtherDays", dw);
        ShiftCalendar.applyDefaultShifts(dw);
        toast("\u540c\u671f\u3057\u307e\u3057\u305f\uff1a" + (name || addr));
      } else {
        toast("\u540c\u671f\u5931\u6557\uff1a" + (r && r.error ? r.error : "\u30b9\u30bf\u30c3\u30d5\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093"));
      }
    } catch (e) {
      toast("\u540c\u671f\u30a8\u30e9\u30fc");
    }
  }

  // 設定リセット
  function handleReset() {
    LS.del("staffId"); LS.del("staffName"); LS.del("lineUid"); LS.del("defaultWishOtherDays"); LS.del("email");
    setStaffId(""); setStaffName(""); setEmail("");
    toast("\u4fdd\u5b58\u5024\u3092\u30ea\u30bb\u30c3\u30c8\u3057\u307e\u3057\u305f");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md min-h-[100dvh] bg-white flex items-center justify-center">
        <div className="text-gray-400 text-sm">{"\u8aad\u307f\u8fbc\u307f\u4e2d\u2026"}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md min-h-[100dvh] bg-white text-gray-900">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">{"\u52e4\u6020\uff08\u30b9\u30bf\u30c3\u30d5\uff09"}</h1>
          <nav className="flex gap-2 text-sm">
            <button onClick={function(){ setTab("home"); setTimeout(function(){ var c = ShiftCalendar.getCalendar(); if(c) c.updateSize(); }, 50); }} className={"px-3 py-1 rounded-full border " + (tab === "home" ? "bg-gray-900 text-white" : "bg-white")}>{"\u30db\u30fc\u30e0"}</button>
            <button onClick={function(){ setTab("settings"); }} className={"px-3 py-1 rounded-full border " + (tab === "settings" ? "bg-gray-900 text-white" : "bg-white")}>{"\u30de\u30a4\u30da\u30fc\u30b8"}</button>
          </nav>
        </div>
      </header>

      <main className="p-4 pb-28" style={{display: tab === "home" ? "block" : "none"}}>
        {/* スタッフ名 */}
        <div className="mb-3">
          <div className="text-sm text-gray-500">{"\u30b9\u30bf\u30c3\u30d5"}</div>
          <div className="text-xl font-bold tracking-tight">{staffName || "\uff08\u672a\u540c\u671f\uff09"}</div>
        </div>

        {/* 凡例 */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mb-3">
          <span className="inline-flex items-center gap-1">
            <i className="w-3 h-3 rounded inline-block" style={{backgroundColor: "#3b82f6"}}/>{"1: 9:30\u301c"}
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="w-3 h-3 rounded inline-block" style={{backgroundColor: "#22c55e"}}/>{"2: 10:00\u301c"}
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="w-3 h-3 rounded inline-block" style={{backgroundColor: "#ef4444"}}/>{"\u00d7: \u4f11"}
          </span>
        </div>

        {/* FullCalendar */}
        <div ref={calContainerRef} className="rounded-2xl border shadow-sm p-2 mb-4" />

        {/* シフト提出バー */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSubmitShifts}
            disabled={pendingCount === 0}
            className={"flex-1 py-3 rounded-xl font-semibold shadow-sm transition-colors " +
              (pendingCount > 0
                ? "bg-blue-500 text-white active:bg-blue-600"
                : "bg-gray-200 text-gray-400 cursor-not-allowed")}
          >
            {pendingCount > 0
              ? "\u30b7\u30d5\u30c8\u63d0\u51fa\uff08" + pendingCount + "\u4ef6\uff09"
              : "\u65e5\u4ed8\u3092\u30bf\u30c3\u30d7\u3057\u3066\u30b7\u30d5\u30c8\u3092\u9078\u629e"}
          </button>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          {"* \u30ab\u30ec\u30f3\u30c0\u30fc\u306e\u65e5\u4ed8\u3092\u30bf\u30c3\u30d7\u3057\u3066\u30b7\u30d5\u30c8\u5e0c\u671b\u3092\u9078\u629e\u3057\u3001\u300c\u30b7\u30d5\u30c8\u63d0\u51fa\u300d\u3067\u9001\u4fe1\u3057\u307e\u3059\u3002"}
        </div>

        {/* 打刻ページへのリンク */}
        <a href="clock.html" className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-500 text-white font-semibold shadow-sm active:bg-green-600 no-underline">
          {"\u51fa\u9000\u52e4\u6253\u523b"}
        </a>
      </main>

      <main className="p-4 pb-28" style={{display: tab === "settings" ? "block" : "none"}}>
        <section className="space-y-5">
          {/* スタッフ情報 */}
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-2">{"\u30b9\u30bf\u30c3\u30d5\u60c5\u5831"}</h2>
            <div className="space-y-3">
              <Input label={"\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9"} value={email} onChange={setEmail} placeholder="example@gmail.com" />
              <Input label={"\u30b9\u30bf\u30c3\u30d5\u540d"} value={staffName} onChange={function(){}} placeholder="" disabled={true} />
              <div className="flex gap-2 flex-wrap">
                <button onClick={handleSync} className="flex-1 px-4 py-3 rounded-xl bg-blue-500 text-white font-semibold shadow-sm">{"\u540c\u671f"}</button>
                <button onClick={handleReset} className="px-4 py-3 rounded-xl border shadow-sm text-sm">{"\u30ea\u30bb\u30c3\u30c8"}</button>
              </div>
            </div>
          </div>

          {/* LINE連携 */}
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-2">{"LINE\u9023\u643a"}</h2>
            <LineLink email={email} />
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 border-t bg-white p-3 text-center text-xs text-gray-500">
        {"\u30b9\u30d7\u30ec\u30c3\u30c9\u30b7\u30fc\u30c8\u9023\u643a / \u30b9\u30bf\u30c3\u30d5\u7248 v" + CONFIG.VERSION}
      </footer>
      <ToastHost />
    </div>
  );
}

// マウント
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(StaffApp));
