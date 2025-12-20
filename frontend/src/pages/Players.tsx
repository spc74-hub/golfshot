import { useState } from "react";
import { usePlayers, useCreatePlayer, useUpdatePlayer, useDeletePlayer } from "@/hooks/usePlayers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Plus, Pencil, Trash2, UserCircle } from "lucide-react";
import type { SavedPlayer, CreateSavedPlayerInput } from "@/types";

interface PlayerFormData {
  name: string;
  handicapIndex: string;
  preferredTee: string;
}

const INITIAL_FORM: PlayerFormData = {
  name: "",
  handicapIndex: "24.0",
  preferredTee: "",
};

export function Players() {
  const { data: players, isLoading } = usePlayers();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();

  const [showDialog, setShowDialog] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<SavedPlayer | null>(null);
  const [formData, setFormData] = useState<PlayerFormData>(INITIAL_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openCreateDialog = () => {
    setEditingPlayer(null);
    setFormData(INITIAL_FORM);
    setShowDialog(true);
  };

  const openEditDialog = (player: SavedPlayer) => {
    setEditingPlayer(player);
    setFormData({
      name: player.name,
      handicapIndex: player.handicapIndex.toString(),
      preferredTee: player.preferredTee || "",
    });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    const handicapValue = parseFloat(formData.handicapIndex.replace(",", ".")) || 24.0;

    const playerData: CreateSavedPlayerInput = {
      name: formData.name.trim(),
      handicapIndex: handicapValue,
      preferredTee: formData.preferredTee.trim() || undefined,
    };

    if (editingPlayer) {
      await updatePlayer.mutateAsync({
        id: editingPlayer.id,
        player: playerData,
      });
    } else {
      await createPlayer.mutateAsync(playerData);
    }

    setShowDialog(false);
    setFormData(INITIAL_FORM);
    setEditingPlayer(null);
  };

  const handleDelete = async (id: string) => {
    await deletePlayer.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const isFormValid = formData.name.trim().length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Jugadores</h1>
          <p className="text-muted-foreground">
            Gestiona tus jugadores habituales
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Jugador
        </Button>
      </div>

      {players && players.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {players.map((player) => (
            <Card key={player.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserCircle className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{player.name}</CardTitle>
                      <CardDescription>
                        Handicap: {player.handicapIndex}
                        {player.preferredTee && ` • Tee: ${player.preferredTee}`}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(player)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirm(player.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin jugadores</h3>
            <p className="text-muted-foreground mb-4">
              Añade jugadores para seleccionarlos rapidamente al crear partidas
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Añadir primer jugador
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPlayer ? "Editar Jugador" : "Nuevo Jugador"}
            </DialogTitle>
            <DialogDescription>
              {editingPlayer
                ? "Modifica los datos del jugador"
                : "Añade un nuevo jugador a tu lista"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Nombre del jugador"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="handicap">Handicap Index</Label>
              <Input
                id="handicap"
                type="text"
                inputMode="decimal"
                value={formData.handicapIndex}
                onChange={(e) => {
                  const value = e.target.value.replace(",", ".");
                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    setFormData({ ...formData, handicapIndex: value });
                  }
                }}
                placeholder="24.0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tee">Tee preferido (opcional)</Label>
              <Input
                id="tee"
                value={formData.preferredTee}
                onChange={(e) =>
                  setFormData({ ...formData, preferredTee: e.target.value })
                }
                placeholder="Ej: Amarillas"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || createPlayer.isPending || updatePlayer.isPending}
            >
              {createPlayer.isPending || updatePlayer.isPending
                ? "Guardando..."
                : editingPlayer
                ? "Guardar cambios"
                : "Crear jugador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar jugador</DialogTitle>
            <DialogDescription>
              ¿Estas seguro que deseas eliminar este jugador? Esta accion no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deletePlayer.isPending}
            >
              {deletePlayer.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
