import { SiteHeader } from '@/components/site-header'
import { Skeleton } from '@/components/skeleton'

function SettingsCardSkeleton({ rows }: { rows: number }) {
  return <section className="overflow-hidden rounded-[16px] border border-border bg-card shadow-soft"><div className="flex flex-col gap-2 px-4 pb-4 pt-6 sm:px-6"><Skeleton className="h-5 w-44" /><Skeleton className="h-4 w-4/5" /></div>{Array.from({ length: rows }, (_, index) => <div key={index} className="flex items-center justify-between gap-4 border-t border-border px-4 py-4 sm:px-6"><div className="flex flex-col gap-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-52" /></div><Skeleton className="h-6 w-10 rounded-full" /></div>)}</section>
}

export function SettingsBodySkeleton() {
  return <div className="flex flex-col gap-6"><SettingsCardSkeleton rows={4} /><SettingsCardSkeleton rows={1} /><section className="flex gap-3 rounded-[16px] border border-border bg-card p-4 shadow-soft sm:p-5"><Skeleton className="size-4 rounded-full" /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-2/3" /></div></section><Skeleton className="h-11 w-32 self-end rounded-[12px]" /></div>
}

export function SettingsSkeleton() {
  return <div className="min-h-screen bg-background"><SiteHeader maxWidth="max-w-2xl" right={<Skeleton className="h-4 w-20" />} /><main className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6"><div className="mb-8 flex flex-col gap-2"><Skeleton className="h-8 w-28" /><Skeleton className="h-4 w-full max-w-xl" /></div><SettingsBodySkeleton /></main></div>
}