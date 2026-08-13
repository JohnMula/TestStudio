import { Skeleton } from '@/components/skeleton'

export function LandingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-6"><Skeleton className="h-7 w-32" /><div className="flex gap-3"><Skeleton className="h-9 w-20 rounded-[12px]" /><Skeleton className="h-9 w-20 rounded-[12px]" /></div></header>
      <main className="mx-auto max-w-6xl px-4 sm:px-6"><section className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-24"><div className="flex flex-col items-start gap-5 sm:gap-6"><Skeleton className="h-7 w-28 rounded-full" /><Skeleton className="h-14 w-full max-w-lg" /><Skeleton className="h-14 w-4/5 max-w-lg" /><Skeleton className="h-5 w-full max-w-md" /><Skeleton className="h-5 w-2/3 max-w-md" /><div className="flex gap-3"><Skeleton className="h-12 w-48 rounded-[12px]" /><Skeleton className="h-12 w-36 rounded-[12px]" /></div></div><Skeleton className="h-80 w-full max-w-md justify-self-center rounded-[16px] md:justify-self-end" /></section><section className="grid gap-6 pb-16 sm:grid-cols-2 sm:pb-24 md:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <article key={index} className="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-6 shadow-soft"><Skeleton className="size-11 rounded-[12px]" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></article>)}</section></main><footer className="border-t border-border"><div className="mx-auto flex max-w-6xl justify-between px-4 py-8 sm:px-6"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-64" /></div></footer>
    </div>
  )
}
