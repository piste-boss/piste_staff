import { fmtYM, rid } from "./utils";

export const DEFAULTS = {
  apiBase: "",
  staff: [
    {
      tenantId: "piste",
      staffId: "",
      name: "",
      hourlyWage: 1100,
      initialView: "1",
      _rid: rid(),
    },
  ],
  desiredShifts: [],
  fixed: {
    useLINE: true,
    shiftSubmitReminder3DaysBefore: {
      enabled: true,
      time: "09:00",
      template:
        "{staffName}さん、{month} のシフト提出締切まであと3日です。期限: {deadlineDate}。忘れずに提出してください。",
    },
    shiftDeadlineDay: {
      enabled: true,
      time: "09:00",
      template:
        "{staffName}さん、本日が {month} のシフト提出締切日です（{deadlineDate}）。提出がまだの方は至急お願いします。",
    },
  },
  events: {
    shiftConfirmedForStaff: {
      enabled: true,
      template:
        "{staffName}さん、{month} のシフトが確定しました。確定日: {confirmedAt}。アプリでご確認ください。",
    },
    shiftSubmittedForAdmin: {
      enabled: true,
      template:
        "【管理者通知】{staffName}さんが {month} の希望シフトを提出しました（提出日: {submittedAt}）。",
    },
    clockIn: {
      enabled: true,
      template: "{staffName}さんの出勤を記録しました。\n出勤時刻: {clockInTime}",
    },
    clockOut: {
      enabled: true,
      template:
        "{staffName}さんの退勤を記録しました。\n出勤: {clockInTime} → 退勤: {clockOutTime}\n勤務時間: {hours}h / {amount}円",
    },
  },
};
