import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useRounds } from "@/hooks/useRounds";
import { useTemplates } from "@/hooks/useTemplates";
import { useUserStats } from "@/hooks/useStats";
import { roundsApi } from "@/lib/api";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
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
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  History,
  Play,
  Flag,
  Users,
  BarChart3,
  MapPin,
  UserPlus,
  Zap,
  TrendingUp,
  Target,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Round } from "@/types";

// Safe date formatting function - compact format for dashboard
function formatRoundDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  try {
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    return format(date, "d MMM", { locale: es });
  } catch {
    return dateStr;
  }
}

// Helper to format HVP deviation compared to user's real handicap
function formatHvpDeviation(
  hvp: number | null,
  userHandicap: number | null
): React.ReactNode {
  if (hvp === null || userHandicap === null) return null;

  const diff = hvp - userHandicap;
  if (Math.abs(diff) < 0.1) return null;

  const sign = diff > 0 ? "+" : "";
  const colorClass = diff < 0 ? "text-green-600" : "text-red-500";

  return (
    <span className={`text-xs font-normal ${colorClass}`}>
      ({sign}{diff.toFixed(1)})
    </span>
  );
}

// Calculate total strokes for a round (first player only)
function calculateTotalStrokes(round: Round): number {
  let total = 0;
  if (round.players.length > 0) {
    const player = round.players[0];
    for (const score of Object.values(player.scores)) {
      total += score.strokes;
    }
  }
  return total;
}

export function Home() {
  const { user } = useAuth();
  const { data: rounds, isLoading: roundsLoading, refetch } = useRounds();
  const { data: templates, isLoading: templatesLoading } = useTemplates();
  const { data: stats, isLoading: statsLoading } = useUserStats();
  const navigate = useNavigate();

  // Onboarding dialog
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  useEffect(() => {
    if (user && !onboardingDismissed) {
      const needsOnboarding = !user.displayName || !user.linkedPlayerId;
      setShowOnboarding(needsOnboarding);
    }
  }, [user, onboardingDismissed]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setOnboardingDismissed(true);
    window.location.reload();
  };

  // Join round dialog
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [shareCode, setShareCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Get active and recent rounds
  const activeRounds = rounds?.filter((r) => !r.isFinished) || [];
  const recentRounds = rounds?.filter((r) => r.isFinished).slice(0, 3) || [];

  // Sort templates: favorites first, then by name
  const sortedTemplates = templates
    ?.slice()
    .sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    }) || [];

  const handleJoinRound = async () => {
    if (!shareCode.trim() || shareCode.length !== 6) {
      setJoinError("El codigo debe tener 6 caracteres");
      return;
    }

    setJoinLoading(true);
    setJoinError(null);

    try {
      const result = await roundsApi.joinByCode(shareCode);
      setJoinDialogOpen(false);
      setShareCode("");
      await refetch();
      navigate(`/round/play?id=${result.roundId}`);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Error al unirse");
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">
          Hola, {user?.displayName || "Golfista"}
        </h1>
        <p className="text-muted-foreground">Bienvenido a Golf Shot</p>
      </div>

      {/* Quick Start Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-lg">Inicio Rapido</CardTitle>
            </div>
            {sortedTemplates.length > 0 && (
              <Link to="/templates">
                <Button variant="ghost" size="sm" className="text-xs">
                  Gestionar
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {/* Template buttons */}
            {sortedTemplates.slice(0, 5).map((template) => (
              <Link key={template.id} to={`/round/setup?template=${template.id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm"
                >
                  {template.isFavorite && <span className="mr-1 text-yellow-500">★</span>}
                  {template.name}
                  {template.courseName && (
                    <span className="ml-1 text-muted-foreground text-xs">
                      ({template.courseName.split(" ")[0]})
                    </span>
                  )}
                </Button>
              </Link>
            ))}
            {/* New round button - always shown */}
            <Link to="/round/setup">
              <Button variant="default" size="sm" className="text-sm">
                <Plus className="h-4 w-4 mr-1" />
                Nueva Partida
              </Button>
            </Link>
          </div>
          {sortedTemplates.length === 0 && !templatesLoading && (
            <p className="text-xs text-muted-foreground mt-2">
              <Link to="/templates" className="text-primary hover:underline">
                Crea plantillas
              </Link>{" "}
              para empezar partidas con un solo click
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats Overview Section */}
      {!statsLoading && stats && stats.totalRounds > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tu Rendimiento
            </h2>
            <Link to="/stats">
              <Button variant="ghost" size="sm" className="text-xs">
                Ver todo
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* HVP Month */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">HVP Mes</div>
                <div className="text-xl font-bold">
                  {stats.hvpMonth !== null ? (
                    <>
                      {stats.hvpMonth.toFixed(1)}
                      {" "}{formatHvpDeviation(stats.hvpMonth, stats.userHandicapIndex)}
                    </>
                  ) : (
                    <span className="text-muted-foreground text-base">-</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* HVP Quarter */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">HVP Trim.</div>
                <div className="text-xl font-bold">
                  {stats.hvpQuarter !== null ? (
                    <>
                      {stats.hvpQuarter.toFixed(1)}
                      {" "}{formatHvpDeviation(stats.hvpQuarter, stats.userHandicapIndex)}
                    </>
                  ) : (
                    <span className="text-muted-foreground text-base">-</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Rounds This Month */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Este Mes
                </div>
                <div className="text-xl font-bold">
                  {stats.roundsThisMonth}
                  <span className="text-xs font-normal text-muted-foreground ml-1">rondas</span>
                </div>
              </CardContent>
            </Card>

            {/* GIR */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  GIR
                </div>
                <div className="text-xl font-bold">
                  {stats.girPct !== null ? (
                    <>{stats.girPct.toFixed(0)}%</>
                  ) : (
                    <span className="text-muted-foreground text-base">-</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Active Rounds Section */}
      {activeRounds.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Play className="h-5 w-5 text-green-500" />
            Partidas en Progreso
          </h2>
          <div className="space-y-2">
            {activeRounds.map((round) => (
              <Link key={round.id} to={`/round/play?id=${round.id}`}>
                <Card className="hover:bg-accent transition-colors cursor-pointer">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{round.courseName}</div>
                        <div className="text-sm text-muted-foreground">
                          {round.players.length} jugadores · {round.gameMode}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          Hoyo {round.currentHole}
                        </Badge>
                        <Button size="sm" variant="default">
                          Continuar
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links Section */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Accesos Rapidos</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <Link to="/history">
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-4 px-2">
                <History className="h-6 w-6 text-primary mb-1" />
                <span className="text-xs text-center">Historial</span>
              </CardContent>
            </Card>
          </Link>
          <Link to="/stats">
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-4 px-2">
                <BarChart3 className="h-6 w-6 text-primary mb-1" />
                <span className="text-xs text-center">Estadisticas</span>
              </CardContent>
            </Card>
          </Link>
          <Link to="/courses">
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-4 px-2">
                <MapPin className="h-6 w-6 text-primary mb-1" />
                <span className="text-xs text-center">Campos</span>
              </CardContent>
            </Card>
          </Link>
          <Link to="/players">
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-4 px-2">
                <Users className="h-6 w-6 text-primary mb-1" />
                <span className="text-xs text-center">Jugadores</span>
              </CardContent>
            </Card>
          </Link>
          <Link to="/templates">
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-4 px-2">
                <Zap className="h-6 w-6 text-yellow-500 mb-1" />
                <span className="text-xs text-center">Plantillas</span>
              </CardContent>
            </Card>
          </Link>
          <Card
            className="hover:bg-accent transition-colors cursor-pointer h-full border-dashed"
            onClick={() => setJoinDialogOpen(true)}
          >
            <CardContent className="flex flex-col items-center justify-center py-4 px-2">
              <UserPlus className="h-6 w-6 text-green-600 mb-1" />
              <span className="text-xs text-center">Unirse</span>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Rounds Section */}
      {recentRounds.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Partidas Recientes</h2>
            <Link to="/history">
              <Button variant="ghost" size="sm" className="text-xs">
                Ver todas
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="py-2 px-0">
              {recentRounds.map((round, index) => (
                <Link key={round.id} to={`/round/card?id=${round.id}`}>
                  <div
                    className={`flex items-center justify-between px-4 py-2 hover:bg-accent transition-colors ${
                      index < recentRounds.length - 1 ? "border-b" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium">
                        {round.courseName.length > 25
                          ? round.courseName.substring(0, 25) + "..."
                          : round.courseName}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatRoundDate(round.roundDate)}</span>
                      <span>{calculateTotalStrokes(round)} golpes</span>
                      <Badge variant="outline" className="text-xs">
                        {round.gameMode}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state */}
      {!roundsLoading && (!rounds || rounds.length === 0) && (
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

      {/* Join Round Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unirse a una partida</DialogTitle>
            <DialogDescription>
              Introduce el codigo de 6 caracteres que te ha compartido otro jugador
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Ej: ABC123"
              value={shareCode}
              onChange={(e) => setShareCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="text-center text-2xl font-mono tracking-widest"
            />
            {joinError && (
              <p className="text-sm text-red-500 text-center">{joinError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleJoinRound} disabled={joinLoading || shareCode.length !== 6}>
              {joinLoading ? "Uniendo..." : "Unirse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Onboarding Dialog */}
      <OnboardingDialog
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
      />
    </div>
  );
}
