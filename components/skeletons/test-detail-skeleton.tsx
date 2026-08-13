import { SiteHeader } from '@/components/site-header'
import { Skeleton } from '@/components/skeleton'

export function TestDetailBodySkeleton() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-4 shadow-soft sm:p-6">
            <Skeleton className="h-3 w-14" />
            <div className="flex gap-3">
              <Skeleton className="h-11 w-32 rounded-[10px]" />
              <Skeleton className="h-11 w-40 rounded-[10px]" />
            </div>
            <Skeleton className="h-3 w-3/4" />
          </section>
          <section className="overflow-hidden rounded-[16px] border border-border bg-card shadow-soft">
            <div className="flex items-center justify-between px-4 pb-4 pt-6 sm:px-6">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center justify-between border-t border-border px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-16" /></div>
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </section>
        </div>
        <Skeleton className="h-80 w-full rounded-[16px] md:w-96" />
      </div>
    </main>
  )
}

export function TestDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader maxWidth="max-w-4xl" right={<Skeleton className="h-4 w-20" />} />
      <TestDetailBodySkeleton />
    </div>
  )
}
