/*************************
 * calendar.js — FullCalendar 統合
 * 依存: config.js, utils.js, api.js
 *
 * FullCalendar 6.x を使用。
 * - 確定シフトをイベントとして色分け表示
 * - 日付タップでシフト選択モーダル表示
 * - 選択済みシフトを pendingShifts に蓄積 → 一括提出
 *************************/

var ShiftCalendar = (function () {
  var _calendar = null;
  var _pendingShifts = {};  // { 'YYYY-MM-DD': '1'|'2'|'×' }
  var _onPendingChange = null;

  /** 色定義 */
  var SHIFT_COLORS = {
    "1": { bg: "#3b82f6", border: "#2563eb", text: "早番" },
    "2": { bg: "#22c55e", border: "#16a34a", text: "遅番" },
    "×": { bg: "#ef4444", border: "#dc2626", text: "休" },
  };

  /** FullCalendar 初期化 */
  function init(containerEl, options) {
    var opts = options || {};
    _onPendingChange = opts.onPendingChange || null;

    _calendar = new FullCalendar.Calendar(containerEl, {
      initialView: "dayGridMonth",
      locale: "ja",
      height: "auto",
      headerToolbar: {
        left: "prev",
        center: "title",
        right: "next",
      },
      buttonText: {
        today: "今月",
      },
      dateClick: function (info) {
        _handleDateClick(info.dateStr);
      },
      datesSet: function (info) {
        // 月が変わったら確定シフトをロード
        if (opts.onMonthChange) {
          var start = info.view.currentStart;
          opts.onMonthChange(start.getFullYear(), start.getMonth());
        }
      },
      eventSources: _buildEventSources(opts),
    });

    _calendar.render();
    return _calendar;
  }

  /** イベントソース構築 */
  function _buildEventSources(opts) {
    var sources = [];

    // ペンディングシフト（ローカル）
    sources.push({
      id: "pending",
      events: function (info, success) {
        var events = [];
        Object.keys(_pendingShifts).forEach(function (dateStr) {
          var wish = _pendingShifts[dateStr];
          var color = SHIFT_COLORS[wish] || { bg: "#9ca3af", border: "#6b7280", text: wish };
          events.push({
            title: color.text + "（未提出）",
            start: dateStr,
            allDay: true,
            backgroundColor: color.bg,
            borderColor: color.border,
            textColor: "#fff",
            extendedProps: { type: "pending", wish: wish },
          });
        });
        success(events);
      },
    });

    // Google Calendar（確定シフト・APIキーがある場合）
    if (CONFIG.GOOGLE_CALENDAR_ID && CONFIG.GOOGLE_API_KEY) {
      sources.push({
        googleCalendarApiKey: CONFIG.GOOGLE_API_KEY,
        googleCalendarId: CONFIG.GOOGLE_CALENDAR_ID,
        className: "gcal-confirmed",
      });
    }

    return sources;
  }

  /** 日付クリック → モーダル表示 */
  function _handleDateClick(dateStr) {
    var current = _pendingShifts[dateStr] || "";
    _showShiftModal(dateStr, current);
  }

  /** シフト選択モーダル */
  function _showShiftModal(dateStr, currentValue) {
    // 既存モーダルを削除
    var existing = document.getElementById("shift-modal");
    if (existing) existing.remove();

    var overlay = document.createElement("div");
    overlay.id = "shift-modal";
    overlay.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/40";
    overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };

    var card = document.createElement("div");
    card.className = "bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl";

    var title = document.createElement("div");
    title.className = "text-lg font-bold mb-4 text-center";
    title.textContent = dateStr;
    card.appendChild(title);

    var choices = [
      { value: "1", label: "1（早番）", color: "bg-blue-500" },
      { value: "2", label: "2（遅番）", color: "bg-green-500" },
      { value: "×", label: "×（休）", color: "bg-red-500" },
      { value: "", label: "取消", color: "bg-gray-400" },
    ];

    choices.forEach(function (c) {
      var btn = document.createElement("button");
      btn.className = "w-full py-3 rounded-xl text-white font-semibold mb-2 " + c.color +
        (currentValue === c.value ? " ring-4 ring-offset-2 ring-gray-900" : "");
      btn.textContent = c.label;
      btn.onclick = function () {
        if (c.value) {
          _pendingShifts[dateStr] = c.value;
        } else {
          delete _pendingShifts[dateStr];
        }
        _refreshPending();
        overlay.remove();
      };
      card.appendChild(btn);
    });

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  /** ペンディングイベントを再描画 */
  function _refreshPending() {
    if (_calendar) {
      var src = _calendar.getEventSourceById("pending");
      if (src) {
        src.refetch();
      }
    }
    if (_onPendingChange) {
      _onPendingChange(Object.assign({}, _pendingShifts));
    }
  }

  /** 確定シフトをカスタムイベントとして追加（GASから取得した場合） */
  function setConfirmedShifts(items) {
    // 既存の確定イベントを削除
    if (_calendar) {
      _calendar.getEvents().forEach(function (ev) {
        if (ev.extendedProps && ev.extendedProps.type === "confirmed") {
          ev.remove();
        }
      });
    }

    if (!Array.isArray(items)) return;
    items.forEach(function (item) {
      var dateStr = item.date || "";
      var wish = item.wish || "";
      var color = SHIFT_COLORS[wish] || { bg: "#9ca3af", border: "#6b7280", text: wish };
      if (_calendar && dateStr) {
        _calendar.addEvent({
          title: color.text,
          start: dateStr,
          allDay: true,
          backgroundColor: color.bg,
          borderColor: color.border,
          textColor: "#fff",
          extendedProps: { type: "confirmed", wish: wish },
        });
      }
    });
  }

  /** ペンディングシフトを取得 */
  function getPendingShifts() {
    return Object.assign({}, _pendingShifts);
  }

  /** ペンディングをクリア */
  function clearPending() {
    _pendingShifts = {};
    _refreshPending();
  }

  /** カレンダーインスタンス取得 */
  function getCalendar() {
    return _calendar;
  }

  return {
    init: init,
    setConfirmedShifts: setConfirmedShifts,
    getPendingShifts: getPendingShifts,
    clearPending: clearPending,
    getCalendar: getCalendar,
    SHIFT_COLORS: SHIFT_COLORS,
  };
})();
