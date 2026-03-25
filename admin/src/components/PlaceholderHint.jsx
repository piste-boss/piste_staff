export function PlaceholderHint({ admin = false }) {
  return (
    <div className="text-xs text-slate-600 mt-1">
      使用できるプレースホルダ：
      <code className="mx-1">{"{staffName}"}</code>
      <code className="mx-1">{"{month}"}</code>
      <code className="mx-1">{"{deadlineDate}"}</code>
      <code className="mx-1">{"{submittedAt}"}</code>
      <code className="mx-1">{"{confirmedAt}"}</code>
      <code className="mx-1">{"{clockInTime}"}</code>
      <code className="mx-1">{"{clockOutTime}"}</code>
      <code className="mx-1">{"{hours}"}</code>
      <code className="mx-1">{"{amount}"}</code>
      {admin && <span className="ml-2">（管理者宛て）</span>}
    </div>
  );
}
