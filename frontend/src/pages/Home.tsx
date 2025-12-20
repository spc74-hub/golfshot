import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useRounds } from "@/hooks/useRounds";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, History, Play, Flag, Users, BarChart3 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Safe date formatting function
function formatRoundDate(dateStr: string | undefined): string {
  if (!dateStr) return "Fecha no disponible";
  try {
    // Try parsing as ISO date first
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr; // Return original string if parsing fails
    }
    return format(date, "PPP", { locale: es });
  } catch {
    return dateStr; // Return original string on error
  }
}

export function Home() {
  const { user } = useAuth();
  const { data: rounds, isLoading } = useRounds();

  // Get active (unfinished) rounds
  const activeRounds = rounds?.filter((r) => !r.isFinished) || [];
  // Get recent finished rounds
  const recentRounds = rounds?.filter((r) => r.isFinished).slice(0, 3) || [];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">
          Hola, {user?.displayName || "Golfista"}
        </h1>
        <p className="text-muted-foreground">Bienvenido a Golf Shot</p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link to="/round/setup">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center space-x-4 pb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Nueva Partida</CardTitle>
                <CardDescription>Comienza una nueva ronda de golf</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
        <Link to="/history">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center space-x-4 pb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <History className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Historial</CardTitle>
                <CardDescription>Ver todas tus partidas</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
        <Link to="/stats">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center space-x-4 pb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Estadisticas</CardTitle>
                <CardDescription>Analiza tu rendimiento</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
        <Link to="/players">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center space-x-4 pb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Jugadores</CardTitle>
                <CardDescription>Gestiona tus jugadores habituales</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Active Rounds */}
      {activeRounds.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Partidas en Progreso</h2>
          <div className="grid gap-4">
            {activeRounds.map((round) => (
              <Link key={round.id} to={`/round/play?id=${round.id}`}>
                <Card className="hover:bg-accent transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{round.courseName}</CardTitle>
                      <Badge variant="secondary">
                        <Play className="h-3 w-3 mr-1" />
                        Hoyo {round.currentHole}
                      </Badge>
                    </div>
                    <CardDescription>
                      {formatRoundDate(round.roundDate)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{round.players.length} jugadores</span>
                      <span>-</span>
                      <span className="capitalize">{round.gameMode}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Rounds */}
      {recentRounds.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Partidas Recientes</h2>
            <Link to="/history">
              <Button variant="ghost" size="sm">
                Ver todas
              </Button>
            </Link>
          </div>
          <div className="grid gap-4">
            {recentRounds.map((round) => (
              <Link key={round.id} to={`/round/card?id=${round.id}`}>
                <Card className="hover:bg-accent transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{round.courseName}</CardTitle>
                      <Badge>Finalizada</Badge>
                    </div>
                    <CardDescription>
                      {formatRoundDate(round.roundDate)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{round.players.length} jugadores</span>
                      <span>-</span>
                      <span className="capitalize">{round.gameMode}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!rounds || rounds.length === 0) && (
        <Card className="text-center py-12">
          <CardContent>
            <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin partidas aun</h3>
            <p className="text-muted-foreground mb-4">
              Comienza tu primera partida de golf
            </p>
            <Link to="/round/setup">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Partida
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
