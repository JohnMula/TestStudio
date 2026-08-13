import { SiteHeader } from '@/components/site-header'
import { Skeleton } from '@/components/skeleton'

export function LoginSkeleton() {
  return <div className="min-h-screen bg-background"><SiteHeader maxWidth="max-w-3xl" right={<Skeleton className="h-4 w-12" />} /><main className="mx-auto flex max-w-3xl justify-center px-4 py-10 sm:px-6 sm:py-16"><section className="flex w-full max-w-md flex-col gap-6 rounded-[16px] border border-border bg-card p-5 shadow-soft sm:p-8"><Skeleton className="size-11 rounded-[12px]" /><div className="flex flex-col gap-3"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div><Skeleton className="h-12 w-full rounded-[12px]" /><Skeleton className="h-12 w-full rounded-[12px]" /><Skeleton className="h-3 w-3/4 self-center" /></section></main></div>
}
