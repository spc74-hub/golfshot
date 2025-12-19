import { Link } from "react-router-dom";
import { useRounds, useDeleteRound } from "@/hooks/useRounds";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Play, Trash2, Eye, Edit, Flag, Upload } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

export function History() {
  const { data: rounds, isLoading } = useRounds();
  const deleteRound = useDeleteRound();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (deleteId) {
      await deleteRound.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

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
          <h1 className="text-2xl font-bold">Historial de Partidas</h1>
          <p className="text-muted-foreground">Todas tus partidas de golf</p>
        </div>
        <Link to="/round/import">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
        </Link>
      </div>

      {rounds && rounds.length > 0 ? (
        <div className="grid gap-4">
          {rounds.map((round) => (
            <Card key={round.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{round.courseName}</CardTitle>
                  <div className="flex items-center gap-2">
                    {round.isImported && (
                      <Badge variant="outline" className="text-xs">
                        <Upload className="h-3 w-3 mr-1" />
                        Importada
                      </Badge>
                    )}
                    {round.isFinished ? (
                      <Badge>Finalizada</Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Play className="h-3 w-3 mr-1" />
                        Hoyo {round.currentHole}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription>
                  {format(new Date(round.roundDate), "PPP", { locale: es })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{round.players.length} jugadores</span>
                    <span>-</span>
                    <span className="capitalize">{round.gameMode}</span>
                    <span>-</span>
                    <span>
                      {round.courseLength === "18"
                        ? "18 hoyos"
                        : round.courseLength === "front9"
                        ? "Front 9"
                        : "Back 9"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {round.isFinished ? (
                      <>
                        <Link to={`/round/card?id=${round.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        </Link>
                        <Link to={`/round/play?id=${round.id}`}>
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <Link to={`/round/play?id=${round.id}`}>
                        <Button size="sm">
                          <Play className="h-4 w-4 mr-1" />
                          Continuar
                        </Button>
                      </Link>
                    )}
                    <Dialog
                      open={deleteId === round.id}
                      onOpenChange={(open) => !open && setDeleteId(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(round.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Eliminar partida</DialogTitle>
                          <DialogDescription>
                            Esta seguro que desea eliminar esta partida? Esta accion no
                            se puede deshacer.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDeleteId(null)}>
                            Cancelar
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleteRound.isPending}
                          >
                            {deleteRound.isPending ? "Eliminando..." : "Eliminar"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin partidas</h3>
            <p className="text-muted-foreground mb-4">
              Aun no has jugado ninguna partida
            </p>
            <Link to="/round/setup">
              <Button>Nueva Partida</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
