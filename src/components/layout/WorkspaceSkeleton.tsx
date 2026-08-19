function RowSkeleton() {
  return (
    <div className="bg-[#1C1C1E] rounded-2xl p-4 border border-white/6">
      <div className="skeleton h-3 w-24 rounded mb-3" />
      <div className="space-y-2">
        <div className="skeleton h-9 w-full rounded-xl" />
        <div className="skeleton h-9 w-full rounded-xl" />
      </div>
    </div>
  )
}

export default function WorkspaceSkeleton() {
  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true" aria-label="화면 로딩 중">
      <div className="bg-[#1C1C1E] rounded-2xl p-5 border border-white/6">
        <div className="skeleton h-3 w-28 rounded mb-4" />
        <div className="skeleton h-10 w-44 rounded-2xl" />
      </div>
      <RowSkeleton />
      <RowSkeleton />
      <p className="text-xs text-[#4E5968] text-center font-semibold">
        가계부 화면을 불러오는 중...
      </p>
    </div>
  )
}
