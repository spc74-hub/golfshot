import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";

export function useUserStats() {
  return useQuery({
    queryKey: ["user-stats"],
    queryFn: usersApi.getMyStats,
  });
}
