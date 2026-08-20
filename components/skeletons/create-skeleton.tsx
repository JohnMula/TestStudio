import { SiteHeader } from '@/components/site-header'
import { Skeleton } from '@/components/skeleton'

function QuestionSkeleton() {
  return (
    <section className="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Skeleton className="size-4 rounded-full" /><Skeleton className="h-3 w-6" /><Skeleton className="h-6 w-28 rounded-full" /></div><Skeleton className="size-7 rounded-md" /></div>
      <Skeleton className="h-18 w-full" />
      <div className="flex flex-col gap-2">{Array.from({ length: 3 }, (_, index) => <div key={index} className="flex gap-2"><Skeleton className="size-6 rounded-full" /><Skeleton className="h-10 flex-1" /></div>)}</div>
      <div className="flex flex-col gap-3 border-t border-border pt-4"><Skeleton className="h-7 w-20" /><Skeleton className="h-10 w-full" /></div>
    </section>
  )
}

export function CreateBodySkeleton() {
  return (
    <div>
      <div className="mb-8 flex flex-col gap-2"><Skeleton className="h-8 w-40" /><Skeleton className="h-4 w-full max-w-lg" /></div>
      <section className="mb-6 flex flex-col gap-5 rounded-[16px] border border-border bg-card p-4 shadow-soft sm:p-6">
        <div className="flex flex-col gap-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-12 w-full" /></div>
        <div className="flex flex-col gap-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-12 w-full" /></div>
        <div className="flex flex-col gap-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-72" /></div>
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="flex items-center justify-between"><div className="flex flex-col gap-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div><Skeleton className="h-6 w-10 rounded-full" /></div>)}
      </section>
      <div className="mb-4 flex gap-2"><Skeleton className="h-10 w-32 rounded-[10px]" /><Skeleton className="h-10 w-44 rounded-[10px]" /></div>
      <div className="flex flex-col gap-4"><QuestionSkeleton /><QuestionSkeleton /></div>
      <div className="mt-8 flex items-center justify-between rounded-[16px] border border-border bg-card p-4 shadow-soft-lg"><Skeleton className="h-4 w-40" /><Skeleton className="h-11 w-28 rounded-[12px]" /></div>
    </div>
  )
}

export function CreateSkeleton() {
  return <div className="min-h-screen bg-background"><SiteHeader maxWidth="max-w-3xl" right={<Skeleton className="h-4 w-20" />} /><main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10"><CreateBodySkeleton /></main></div>
}
