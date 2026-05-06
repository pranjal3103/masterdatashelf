export default function BookDetailLoading() {
  return (
    <main className="p-6 md:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="h-3 w-48 bg-gray-100 rounded animate-pulse mb-6" />

      {/* Cover + metadata */}
      <div className="flex flex-col sm:flex-row gap-8 mb-10">
        <div className="w-full sm:w-44 shrink-0">
          <div className="aspect-[2/3] rounded-lg bg-gray-200 animate-pulse" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="h-7 bg-gray-200 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded w-1/3 animate-pulse" />
          <div className="flex gap-2 mt-3">
            <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" />
            <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 max-w-sm">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-3 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      {/* More by author */}
      <div className="mt-8">
        <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[2/3] rounded-md bg-gray-200" />
              <div className="h-3 mt-2 bg-gray-100 rounded w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
