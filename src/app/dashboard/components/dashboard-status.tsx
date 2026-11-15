export function DashboardStatus({
  tone,
  message,
  action,
}: {
  tone: "loading" | "error" | "empty" | "success";
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  const styles = {
    loading: "border-blue-200 bg-blue-50 text-blue-900",
    error: "border-red-200 bg-red-50 text-red-900",
    empty: "border-slate-200 bg-white text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];

  return (
    <section
      className={`mt-6 flex flex-col gap-3 rounded-xl border px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between ${styles}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span>{message}</span>
      {action ? (
        <button
          className="self-start rounded-lg border border-current/20 bg-white px-3 py-2 font-medium hover:bg-white/60 sm:self-auto"
          onClick={action.onClick}
          type="button"
        >
          {action.label}
        </button>
      ) : null}
    </section>
  );
}
