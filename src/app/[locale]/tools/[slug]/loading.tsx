export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-fade-in-up space-y-8">
      <div className="text-center">
        <div className="mb-4 h-8 rounded bg-slate-200 animate-pulse" />
        <div className="h-4 rounded bg-slate-200 animate-pulse" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-2xl bg-white ring-1 ring-slate-200 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

