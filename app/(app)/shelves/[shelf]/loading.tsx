export default function ShelfLoading() {
  return (
    <main className="p-6 md:p-8">
      <div className="flex items-baseline justify-between mb-6">
        <div className="h-7 w-28 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Controls skeleton */}
      <div className="flex gap-2 mb-6">
        <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-8 w-28 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-8 w-28 bg-gray-100 rounded-lg animate-pulse" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[2/3] rounded-md bg-gray-200" />
            <div className="h-3 mt-2 bg-gray-100 rounded w-4/5" />
            <div className="h-2 mt-1 bg-gray-100 rounded w-3/5" />
          </div>
        ))}
      </div>
    </main>
  )
}
