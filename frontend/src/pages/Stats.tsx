import { useUserStats } from "@/hooks/useStats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Target,
  Award,
  BarChart3,
  Flag,
  Calendar,
  MapPin,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return format(date, "PPP", { locale: es });
  } catch {
    return dateStr;
  }
}

export function Stats() {
  const { data: stats, isLoading, error } = useUserStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando estadisticas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-destructive">Error al cargar las estadisticas</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats || stats.totalRounds === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center">
          <CardContent className="pt-12 pb-12">
            <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin estadisticas aun</h3>
            <p className="text-muted-foreground mb-4">
              Completa algunas rondas para ver tus estadisticas
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Estadisticas</h1>
        <p className="text-muted-foreground">
          Analiza tu rendimiento en el campo
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Rounds */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Rondas
            </CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRounds}</div>
            <p className="text-xs text-muted-foreground">
              Rondas completadas
            </p>
          </CardContent>
        </Card>

        {/* Virtual Handicap */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Handicap Virtual
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.virtualHandicap !== null ? (
                <>{stats.virtualHandicap.toFixed(1)}</>
              ) : (
                <span className="text-muted-foreground text-base">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.virtualHandicap !== null
                ? "Basado en mejores 8 de 20"
                : "Necesitas al menos 3 rondas de 18 hoyos"}
            </p>
          </CardContent>
        </Card>

        {/* Average Stableford */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Promedio Stableford
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgStablefordPoints !== null ? (
                <>{stats.avgStablefordPoints.toFixed(1)}</>
              ) : (
                <span className="text-muted-foreground text-base">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Puntos por ronda
            </p>
          </CardContent>
        </Card>

        {/* Best Round */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Mejor Ronda
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.bestRoundScore !== null ? (
                <>{stats.bestRoundScore}</>
              ) : (
                <span className="text-muted-foreground text-base">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Golpes totales
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Best Round Details */}
      {stats.bestRoundScore !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Tu Mejor Ronda
            </CardTitle>
            <CardDescription>
              Detalles de tu mejor rendimiento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {stats.bestRoundScore} golpes
              </Badge>
            </div>
            {stats.bestRoundCourse && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{stats.bestRoundCourse}</span>
              </div>
            )}
            {stats.bestRoundDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{formatDate(stats.bestRoundDate)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Average Scores by Hole Type */}
      <Card>
        <CardHeader>
          <CardTitle>Promedios por Tipo de Hoyo</CardTitle>
          <CardDescription>
            Golpes promedio segun el par del hoyo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Par 3 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-16 text-sm font-medium">Par 3</div>
                <div className="flex-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden max-w-xs">
                    {stats.avgStrokesPar3 !== null && (
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{
                          width: `${Math.min(
                            (stats.avgStrokesPar3 / 6) * 100,
                            100
                          )}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold min-w-[4rem] text-right">
                {stats.avgStrokesPar3 !== null ? (
                  stats.avgStrokesPar3.toFixed(2)
                ) : (
                  <span className="text-muted-foreground text-base">N/A</span>
                )}
              </div>
            </div>

            {/* Par 4 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-16 text-sm font-medium">Par 4</div>
                <div className="flex-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden max-w-xs">
                    {stats.avgStrokesPar4 !== null && (
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{
                          width: `${Math.min(
                            (stats.avgStrokesPar4 / 8) * 100,
                            100
                          )}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold min-w-[4rem] text-right">
                {stats.avgStrokesPar4 !== null ? (
                  stats.avgStrokesPar4.toFixed(2)
                ) : (
                  <span className="text-muted-foreground text-base">N/A</span>
                )}
              </div>
            </div>

            {/* Par 5 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-16 text-sm font-medium">Par 5</div>
                <div className="flex-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden max-w-xs">
                    {stats.avgStrokesPar5 !== null && (
                      <div
                        className="h-full bg-orange-500 transition-all"
                        style={{
                          width: `${Math.min(
                            (stats.avgStrokesPar5 / 10) * 100,
                            100
                          )}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold min-w-[4rem] text-right">
                {stats.avgStrokesPar5 !== null ? (
                  stats.avgStrokesPar5.toFixed(2)
                ) : (
                  <span className="text-muted-foreground text-base">N/A</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Average Scores by Round Length */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 9 Holes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rondas de 9 Hoyos</CardTitle>
            <CardDescription>Promedio de golpes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.avgStrokes9holes !== null ? (
                stats.avgStrokes9holes.toFixed(1)
              ) : (
                <span className="text-muted-foreground text-xl">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.avgStrokes9holes !== null
                ? "Golpes totales promedio"
                : "No hay rondas de 9 hoyos"}
            </p>
          </CardContent>
        </Card>

        {/* 18 Holes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rondas de 18 Hoyos</CardTitle>
            <CardDescription>Promedio de golpes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.avgStrokes18holes !== null ? (
                stats.avgStrokes18holes.toFixed(1)
              ) : (
                <span className="text-muted-foreground text-xl">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.avgStrokes18holes !== null
                ? "Golpes totales promedio"
                : "No hay rondas de 18 hoyos"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Putting Average */}
      <Card>
        <CardHeader>
          <CardTitle>Promedio de Putts</CardTitle>
          <CardDescription>
            Putts promedio por ronda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {stats.avgPuttsPerRound !== null ? (
              stats.avgPuttsPerRound.toFixed(1)
            ) : (
              <span className="text-muted-foreground text-xl">N/A</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.avgPuttsPerRound !== null
              ? "Putts totales por ronda"
              : "No hay datos de putts disponibles"}
          </p>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <BarChart3 className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                Las estadisticas se calculan a partir de tus rondas completadas.
              </p>
              <p>
                El handicap virtual se basa en la formula oficial: promedio de
                los mejores 8 diferenciales de tus ultimas 20 rondas de 18
                hoyos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
