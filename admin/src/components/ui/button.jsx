import { cn } from "../../lib/utils";

const base =
  "inline-flex items-center justify-center rounded-2xl text-sm font-medium transition hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none";

const variants = {
  default: "bg-slate-900 text-white border border-slate-900",
  outline: "border border-slate-300 bg-white hover:bg-slate-100",
  destructive: "bg-rose-600 text-white border border-rose-600",
};
const sizes = {
  default: "px-4 py-2",
  sm: "px-3 py-1 text-xs",
};

export function Button({ variant = "default", size = "default", className, ...props }) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
