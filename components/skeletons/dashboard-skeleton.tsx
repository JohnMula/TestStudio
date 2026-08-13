import { SiteHeader } from '@/components/site-header'
import { Skeleton } from '@/components/skeleton'

function TestCardSkeleton() {
  return (
    <article className="flex min-h-40 flex-col gap-5 rounded-[16px] border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
      <div className="mt-auto flex items-center justify-between">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="size-4 rounded-full" />
      </div>
    </article>
  )
}

export function DashboardGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => <TestCardSkeleton key={index} />)}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        right={
          <>
            <Skeleton className="h-9 w-24 rounded-[12px]" />
            <Skeleton className="size-9 rounded-[10px]" />
          </>
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-7 flex flex-col gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-44" />
        </div>
        <section className="mb-7 flex flex-col gap-3 rounded-[16px] border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center">
          <Skeleton className="h-5 w-48" />
          <div className="flex flex-1 justify-end gap-2">
            <Skeleton className="h-10 w-40 rounded-[10px]" />
            <Skeleton className="h-10 w-14 rounded-[10px]" />
          </div>
        </section>
        <div className="mb-6 flex gap-7 border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <DashboardGridSkeleton />
      </main>
    </div>
  )
}
