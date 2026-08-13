import { SiteHeader } from '@/components/site-header'
import { Skeleton } from '@/components/skeleton'

export function TakeATestSkeleton() {
  return <div className="min-h-screen bg-background"><SiteHeader maxWidth="max-w-2xl" right={<Skeleton className="h-4 w-12" />} /><main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16"><div className="flex flex-col items-center gap-3"><Skeleton className="size-11 rounded-[12px]" /><Skeleton className="h-8 w-36" /><Skeleton className="h-4 w-64" /><Skeleton className="h-4 w-44" /></div><section className="flex flex-col gap-5 rounded-[16px] border border-border bg-card p-5 shadow-soft sm:p-6"><div className="flex flex-col gap-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-11 w-full" /></div><Skeleton className="h-12 w-full rounded-[12px]" /><div className="flex items-center gap-3"><Skeleton className="h-px flex-1" /><Skeleton className="h-3 w-6" /><Skeleton className="h-px flex-1" /></div><Skeleton className="h-12 w-full rounded-[12px]" /></section></main></div>
}
