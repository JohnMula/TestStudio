import { SiteHeader } from '@/components/site-header'
import { Skeleton } from '@/components/skeleton'

export function TakeTestBodySkeleton() {
  return (
    <section className="flex flex-col gap-6 rounded-[16px] border border-border bg-card p-5 shadow-soft sm:p-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <Skeleton className="h-11 w-full rounded-[10px]" />
      <Skeleton className="h-12 w-36 self-end rounded-[12px]" />
    </section>
  )
}

export function TakeTestSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        maxWidth="max-w-2xl"
        right={<Skeleton className="h-4 w-14" />}
      />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <TakeTestBodySkeleton />
      </main>
    </div>
  )
}
