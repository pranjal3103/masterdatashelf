export default function DashboardLoading() {
  return (
    <main className="p-6 md:p-8">
      <div className="h-7 w-32 bg-gray-200 rounded animate-pulse mb-6" />

      {/* Stat cards */}
      <div className="flex flex-wrap gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 px-5 py-4 shadow-sm w-[90px] animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-1" />
            <div className="h-3 bg-gray-100 rounded w-4/5" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm mb-8 animate-pulse">
        <div className="h-4 w-36 bg-gray-200 rounded mb-4" />
        <div className="h-[220px] bg-gray-100 rounded" />
      </div>

      {/* Strip skeleton */}
      <div className="mb-8">
        <div className="h-4 w-32 bg-gray-200 rounded mb-3 animate-pulse" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="shrink-0 w-20 animate-pulse">
              <div className="aspect-[2/3] rounded-md bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
