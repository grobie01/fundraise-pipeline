export default function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 bg-gray-700 rounded w-48"></div>
        <div className="flex gap-2">
          <div className="h-10 bg-gray-700 rounded w-32"></div>
          <div className="h-10 bg-gray-700 rounded w-32"></div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-7 gap-4 p-4 bg-gray-750 border-b border-gray-700">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-6 bg-gray-700 rounded"></div>
          ))}
        </div>

        {/* Table rows */}
        {[...Array(5)].map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-7 gap-4 p-4 border-b border-gray-700"
          >
            {[...Array(7)].map((_, colIndex) => (
              <div key={colIndex} className="h-6 bg-gray-700 rounded"></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
