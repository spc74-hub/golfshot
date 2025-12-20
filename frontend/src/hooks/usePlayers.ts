import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { playersApi } from "@/lib/api";
import type { CreateSavedPlayerInput, UpdateSavedPlayerInput } from "@/types";

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: () => playersApi.list(),
  });
}

export function usePlayer(id: string) {
  return useQuery({
    queryKey: ["players", id],
    queryFn: () => playersApi.get(id),
    enabled: !!id,
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (player: CreateSavedPlayerInput) => playersApi.create(player),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
  });
}

export function useUpdatePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, player }: { id: string; player: UpdateSavedPlayerInput }) =>
      playersApi.update(id, player),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
  });
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => playersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
  });
}
