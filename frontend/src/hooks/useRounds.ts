import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { roundsApi } from "@/lib/api";
import type { CreateRoundInput, UpdateRoundInput } from "@/types";

export function useRounds() {
  return useQuery({
    queryKey: ["rounds"],
    queryFn: roundsApi.list,
  });
}

export function useRound(id: string | undefined) {
  return useQuery({
    queryKey: ["rounds", id],
    queryFn: () => roundsApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateRound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoundInput | Record<string, unknown>) => roundsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rounds"] });
    },
  });
}

export function useUpdateRound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoundInput | Record<string, unknown> }) =>
      roundsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rounds"] });
      queryClient.invalidateQueries({ queryKey: ["rounds", variables.id] });
    },
  });
}

export function useDeleteRound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => roundsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rounds"] });
    },
  });
}

export function useFinishRound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => roundsApi.finish(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["rounds"] });
      queryClient.invalidateQueries({ queryKey: ["rounds", id] });
    },
  });
}
