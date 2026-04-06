import { Skeleton } from "@/components/ui/skeleton";

function SkeletonCard() {
  return (
    <div className="bg-white border border-border rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex items-center gap-3 md:w-52 flex-shrink-0">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-1">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-1.5 md:min-w-[110px]">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="space-y-1.5 md:min-w-[100px]">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="flex items-center gap-3 md:flex-col md:items-end flex-shrink-0">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}

export function ScheduleSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
