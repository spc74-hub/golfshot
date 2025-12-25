import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { handicapHistoryApi } from "@/lib/api";
import type { CreateHandicapHistoryInput, UpdateHandicapHistoryInput } from "@/types";

export function useHandicapHistory() {
  return useQuery({
    queryKey: ["handicap-history"],
    queryFn: handicapHistoryApi.list,
  });
}

export function useCurrentHandicap() {
  return useQuery({
    queryKey: ["handicap-history", "current"],
    queryFn: handicapHistoryApi.getCurrent,
  });
}

export function useHandicapAtDate(date: string) {
  return useQuery({
    queryKey: ["handicap-history", "at-date", date],
    queryFn: () => handicapHistoryApi.getAtDate(date),
    enabled: !!date,
  });
}

export function useCreateHandicapHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateHandicapHistoryInput) => handicapHistoryApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handicap-history"] });
    },
  });
}

export function useUpdateHandicapHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateHandicapHistoryInput }) =>
      handicapHistoryApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handicap-history"] });
    },
  });
}

export function useDeleteHandicapHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => handicapHistoryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handicap-history"] });
    },
  });
}
