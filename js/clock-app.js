/*************************
 * clock-app.js — 出退勤専用ページ
 * 依存: config.js, utils.js, api.js, auth.js
 *************************/
const { useEffect, useState, useRef } = React;

function ClockApp() {
  var [staffName, setStaffName] = useState(LS.get("staffName") || "");
  var [now, setNow] = useState(new Date());
  var [status, setStatus] = useState(""); // "出勤中" or ""
  var [lastAction, setLastAction] = useState("");
  var [loading, setLoading] = useState(true);
  var timerRef = useRef(null);

  // 認証（localStorageのemailを使用）
  useEffect(function () {
    (async function () {
      try {
        await Auth.init();
        var staff = Auth.getStaff();
        if (staff.staffName) { setStaffName(staff.staffName); LS.set("staffName", staff.staffName); }
      } catch (e) {
        console.error("Auth init error:", e);
      }
      setLoading(false);
    })();
  }, []);

  // 現在時刻を毎秒更新
  useEffect(function () {
    timerRef.current = setInterval(function () { setNow(new Date()); }, 1000);
    return function () { clearInterval(timerRef.current); };
  }, []);

  // JST表示用
  var jstStr = formatJST(now);
  var timeDisplay = jstStr.slice(11, 19); // HH:mm:ss
  var dateDisplay = jstStr.slice(0, 10);  // YYYY-MM-DD

  // 出勤
  async function handleClockIn() {
    var addr = LS.get("email") || "";
    if (!addr) return toast("\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u304c\u672a\u8a2d\u5b9a\u3067\u3059\u3002\u30de\u30a4\u30da\u30fc\u30b8\u3067\u540c\u671f\u3057\u3066\u304f\u3060\u3055\u3044");
    var jst = formatJST(new Date());
    toast("\u51fa\u52e4\u6253\u523b\u4e2d\u2026");
    try {
      var r = await sendGASWrite({
        type: "clockIn",
        tenantId: CONFIG.TENANT_ID,
        email: addr,
        name: staffName || "",
        "\u51fa\u52e4\u6642\u523b": jst,
        "\u30bf\u30a4\u30e0\u30b9\u30bf\u30f3\u30d7": jst,
      });
      if (r && r.ok) {
        toast("\u51fa\u52e4\u3092\u8a18\u9332\u3057\u307e\u3057\u305f");
        setStatus("\u51fa\u52e4\u4e2d");
        setLastAction("\u51fa\u52e4: " + jst);
      } else if (r && r.error === "already_clocked_in_today") {
        toast("\u540c\u65e5\u306b\u4e8c\u5ea6\u306f\u51fa\u52e4\u3067\u304d\u307e\u305b\u3093");
      } else if (r && r.via === "no-cors") {
        toast("\u51fa\u52e4\u3092\u8a18\u9332\u3057\u307e\u3057\u305f\uff08no-cors\uff09");
        setStatus("\u51fa\u52e4\u4e2d");
      } else {
        toast("\u51fa\u52e4\u306e\u8a18\u9332\u306b\u5931\u6557\u3057\u307e\u3057\u305f" + (r && r.error ? ": " + r.error : ""));
      }
    } catch (e) {
      toast("\u51fa\u52e4\u30a8\u30e9\u30fc\uff1a\u901a\u4fe1\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044");
    }
  }

  // 退勤
  async function handleClockOut() {
    var addr = LS.get("email") || "";
    if (!addr) return toast("\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u304c\u672a\u8a2d\u5b9a\u3067\u3059\u3002\u30de\u30a4\u30da\u30fc\u30b8\u3067\u540c\u671f\u3057\u3066\u304f\u3060\u3055\u3044");
    var jst = formatJST(new Date());
    toast("\u9000\u52e4\u6253\u523b\u4e2d\u2026");
    try {
      var r = await sendGASWrite({
        type: "clockOut",
        tenantId: CONFIG.TENANT_ID,
        email: addr,
        name: staffName || "",
        "\u9000\u52e4\u6642\u523b": jst,
        "\u30bf\u30a4\u30e0\u30b9\u30bf\u30f3\u30d7": jst,
      });
      if (!(r && (r.ok || r.via === "no-cors"))) {
        var errMsg = (r && r.error) ? "\u9000\u52e4\u5931\u6557: " + r.error : "\u9000\u52e4\u306e\u8a18\u9332\u306b\u5931\u6557\u3057\u307e\u3057\u305f";
        return toast(errMsg);
      }
      if (r && r.ok && typeof r.amount !== "undefined") {
        var hrs = typeof r.hours !== "undefined" ? " / " + Number(r.hours).toFixed(2) + "h" : "";
        toast("\u9000\u52e4\uff06\u7d66\u4e0e\u8a18\u9332\uff1a" + r.amount + "\u5186" + hrs);
      } else {
        toast("\u9000\u52e4\u3092\u8a18\u9332\u3057\u307e\u3057\u305f");
      }
      setStatus("");
      setLastAction("\u9000\u52e4: " + jst);
    } catch (e) {
      toast("\u9000\u52e4\u30a8\u30e9\u30fc\uff1a\u901a\u4fe1\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md min-h-[100dvh] bg-white flex items-center justify-center">
        <div className="text-gray-400 text-sm">{"\u8aad\u307f\u8fbc\u307f\u4e2d\u2026"}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md min-h-[100dvh] bg-white text-gray-900 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-gray-900 text-white px-4 py-4">
        <h1 className="text-lg font-semibold text-center">{"\u51fa\u9000\u52e4\u6253\u523b"}</h1>
        <div className="text-center text-sm text-gray-300 mt-1">{staffName || "\u30b9\u30bf\u30c3\u30d5"}</div>
      </header>

      {/* 時計表示 */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-gray-500 text-sm mb-1">{dateDisplay}</div>
        <div className="text-6xl font-bold tracking-tight tabular-nums mb-8">{timeDisplay}</div>

        {status && (
          <div className="mb-4 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
            {status}
          </div>
        )}

        {/* 出退勤ボタン */}
        <div className="w-full grid grid-cols-2 gap-4 max-w-xs">
          <button
            onClick={handleClockIn}
            className="py-6 rounded-2xl bg-blue-500 text-white text-xl font-bold shadow-lg active:scale-[.97] transition-transform"
          >
            {"\u51fa\u52e4"}
          </button>
          <button
            onClick={handleClockOut}
            className="py-6 rounded-2xl bg-red-500 text-white text-xl font-bold shadow-lg active:scale-[.97] transition-transform"
          >
            {"\u9000\u52e4"}
          </button>
        </div>

        {lastAction && (
          <div className="mt-6 text-xs text-gray-400">{lastAction}</div>
        )}
      </div>

      <footer className="border-t bg-white p-3 text-center text-xs text-gray-500">
        {"v" + CONFIG.VERSION}
      </footer>
      <ToastHost />
    </div>
  );
}

// ToastHost (clock-app 用に再定義 — utils.js の TOASTS を参照)
function ToastHost() {
  var [, force] = useState(0);
  useEffect(function () {
    var h = function () { force(function (v) { return v + 1; }); };
    window.addEventListener("__toast__", h);
    return function () { window.removeEventListener("__toast__", h); };
  }, []);
  return (
    <div className="fixed bottom-20 left-0 right-0 flex flex-col items-center gap-2 px-3 pointer-events-none">
      {TOASTS.map(function (t) {
        return (<div key={t.id} className="pointer-events-auto max-w-sm w-full bg-gray-900 text-white text-sm px-3 py-2 rounded-xl shadow">{t.text}</div>);
      })}
    </div>
  );
}

// マウント
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(ClockApp));
