import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import type { StatsFilters, StatsComparisonParams } from "@/types";

export function useUserStats() {
  return useQuery({
    queryKey: ["user-stats"],
    queryFn: usersApi.getMyStats,
  });
}

export function useUserStatsFiltered(filters?: StatsFilters) {
  return useQuery({
    queryKey: ["user-stats-filtered", filters],
    queryFn: () => usersApi.getMyStatsFiltered(filters),
  });
}

export function useStatsComparison(params: StatsComparisonParams, enabled = true) {
  return useQuery({
    queryKey: ["stats-comparison", params],
    queryFn: () => usersApi.compareStats(params),
    enabled,
  });
}
