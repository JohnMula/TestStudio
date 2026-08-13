import { SiteHeader } from '@/components/site-header'
import { Skeleton } from '@/components/skeleton'

export function ResultsBodySkeleton() {
  return (
    <div className="flex flex-col gap-8">
        <section className="flex flex-col items-center gap-5 rounded-[16px] border border-border bg-card p-6 shadow-soft sm:p-10">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex w-full flex-col items-center gap-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-2/3" /><Skeleton className="h-4 w-40" /></div>
          <div className="w-full rounded-[12px] border border-border bg-background px-5 py-4"><Skeleton className="h-3 w-20" /><Skeleton className="mt-3 h-9 w-32" /><Skeleton className="mt-2 h-7 w-16" /></div>
          <div className="grid w-full grid-cols-3 divide-x divide-border overflow-hidden rounded-[12px] border border-border bg-background">{Array.from({ length: 3 }, (_, index) => <div key={index} className="flex flex-col gap-2 px-3 py-3 sm:px-4"><Skeleton className="h-6 w-8" /><Skeleton className="h-3 w-14" /></div>)}</div>
        </section>
        <section className="flex flex-col gap-4"><div className="flex flex-col gap-2 px-1"><Skeleton className="h-6 w-36" /><Skeleton className="h-4 w-4/5" /></div>{Array.from({ length: 3 }, (_, index) => <article key={index} className="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-5 shadow-soft"><Skeleton className="h-3 w-12" /><Skeleton className="h-5 w-4/5" /><Skeleton className="h-10 w-full" /></article>)}</section>
    </div>
  )
}

export function ResultsSkeleton() {
  return <div className="min-h-screen bg-background"><SiteHeader maxWidth="max-w-2xl" right={<Skeleton className="h-4 w-20" />} /><main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12"><ResultsBodySkeleton /></main></div>
}
