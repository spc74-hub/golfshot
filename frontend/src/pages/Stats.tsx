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
  Award,
  BarChart3,
  Flag,
  Calendar,
  MapPin,
  User,
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

// Helper to format deviation from target
// For strokes/putts: lower is better (negative deviation = green)
// For stableford points: higher is better (positive deviation = green)
function formatDeviation(
  value: number | null,
  target: number,
  higherIsBetter: boolean = false
): React.ReactNode {
  if (value === null) return null;

  const diff = value - target;
  if (diff === 0) return null;

  const isPositive = diff > 0;
  const isGood = higherIsBetter ? isPositive : !isPositive;
  const sign = isPositive ? "+" : "";
  const colorClass = isGood ? "text-green-600" : "text-red-500";

  return (
    <span className={`text-sm font-normal ${colorClass}`}>
      ({sign}{diff.toFixed(1)})
    </span>
  );
}

// Helper to format HVP deviation compared to user's real handicap
// HVP is already expressed as "virtual handicap" (like 15.2)
// User handicap is their official index (like 14.2)
// Deviation = HVP - userHandicap
// Negative means playing BETTER than handicap (green) - lower HVP is better
// Positive means playing WORSE than handicap (red) - higher HVP is worse
function formatHvpVsHandicap(
  hvp: number | null,
  userHandicap: number | null
): React.ReactNode {
  if (hvp === null || userHandicap === null) return null;

  const diff = hvp - userHandicap;

  if (Math.abs(diff) < 0.1) return null; // Essentially equal

  const sign = diff > 0 ? "+" : "";
  // If diff is positive, HVP > handicap = playing worse (red)
  // If diff is negative, HVP < handicap = playing better (green)
  const colorClass = diff < 0 ? "text-green-600" : "text-red-500";

  return (
    <span className={`text-sm font-normal ${colorClass}`}>
      ({sign}{diff.toFixed(1)})
    </span>
  );
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

        {/* User Handicap */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Mi Handicap
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.userHandicapIndex !== null ? (
                stats.userHandicapIndex.toFixed(1)
              ) : (
                <span className="text-muted-foreground text-base">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Handicap Index oficial
            </p>
          </CardContent>
        </Card>

        {/* HVP Total */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              HVP Total
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.hvpTotal !== null ? (
                <>{stats.hvpTotal.toFixed(1)} {formatHvpVsHandicap(stats.hvpTotal, stats.userHandicapIndex)}</>
              ) : (
                <span className="text-muted-foreground text-base">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Handicap Virtual Promedio
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
              Golpes totales (18 hoyos)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* HVP by Period */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            HVP por Periodo
          </CardTitle>
          <CardDescription>
            Handicap Virtual Promedio - Comparado con tu handicap oficial ({stats.userHandicapIndex?.toFixed(1) ?? "N/A"})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total */}
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {stats.hvpTotal !== null ? (
                  <>{stats.hvpTotal.toFixed(1)} {formatHvpVsHandicap(stats.hvpTotal, stats.userHandicapIndex)}</>
                ) : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total</p>
            </div>
            {/* Year */}
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {stats.hvpYear !== null ? (
                  <>{stats.hvpYear.toFixed(1)} {formatHvpVsHandicap(stats.hvpYear, stats.userHandicapIndex)}</>
                ) : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Este Ano</p>
            </div>
            {/* Quarter */}
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {stats.hvpQuarter !== null ? (
                  <>{stats.hvpQuarter.toFixed(1)} {formatHvpVsHandicap(stats.hvpQuarter, stats.userHandicapIndex)}</>
                ) : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Trimestre</p>
            </div>
            {/* Month */}
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {stats.hvpMonth !== null ? (
                  <>{stats.hvpMonth.toFixed(1)} {formatHvpVsHandicap(stats.hvpMonth, stats.userHandicapIndex)}</>
                ) : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Este Mes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Round Details - Grid for 18 and 9 holes */}
      {(stats.bestRoundScore !== null || stats.bestRound9Score !== null) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Best 18-hole Round */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Tu Mejor Ronda (18 Hoyos)
              </CardTitle>
              <CardDescription>
                Detalles de tu mejor rendimiento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.bestRoundScore !== null ? (
                <>
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
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay rondas de 18 hoyos completadas
                </p>
              )}
            </CardContent>
          </Card>

          {/* Best 9-hole Round */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Tu Mejor Ronda (9 Hoyos)
              </CardTitle>
              <CardDescription>
                Detalles de tu mejor rendimiento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.bestRound9Score !== null ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {stats.bestRound9Score} golpes
                    </Badge>
                  </div>
                  {stats.bestRound9Course && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{stats.bestRound9Course}</span>
                    </div>
                  )}
                  {stats.bestRound9Date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDate(stats.bestRound9Date)}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay rondas de 9 hoyos completadas
                </p>
              )}
            </CardContent>
          </Card>
        </div>
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
              <div className="text-2xl font-bold min-w-[6rem] text-right">
                {stats.avgStrokesPar3 !== null ? (
                  <>{stats.avgStrokesPar3.toFixed(2)} {formatDeviation(stats.avgStrokesPar3, 3)}</>
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
              <div className="text-2xl font-bold min-w-[6rem] text-right">
                {stats.avgStrokesPar4 !== null ? (
                  <>{stats.avgStrokesPar4.toFixed(2)} {formatDeviation(stats.avgStrokesPar4, 4)}</>
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
              <div className="text-2xl font-bold min-w-[6rem] text-right">
                {stats.avgStrokesPar5 !== null ? (
                  <>{stats.avgStrokesPar5.toFixed(2)} {formatDeviation(stats.avgStrokesPar5, 5)}</>
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
                <>{stats.avgStrokes9holes.toFixed(1)} {formatDeviation(stats.avgStrokes9holes, 36)}</>
              ) : (
                <span className="text-muted-foreground text-xl">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.avgStrokes9holes !== null
                ? "Golpes totales promedio (par 36)"
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
                <>{stats.avgStrokes18holes.toFixed(1)} {formatDeviation(stats.avgStrokes18holes, 72)}</>
              ) : (
                <span className="text-muted-foreground text-xl">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.avgStrokes18holes !== null
                ? "Golpes totales promedio (par 72)"
                : "No hay rondas de 18 hoyos"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Score Distribution & GIR */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribucion de Resultados</CardTitle>
            <CardDescription>Porcentaje de cada tipo de resultado</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.parsPct !== null ? (
              <div className="space-y-2">
                {/* Eagles or better */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-sm">Eagle o mejor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500"
                        style={{ width: `${stats.eaglesOrBetterPct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {stats.eaglesOrBetterPct?.toFixed(1) ?? "0"}%
                    </span>
                  </div>
                </div>
                {/* Birdies */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm">Birdie</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${stats.birdiesPct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {stats.birdiesPct?.toFixed(1) ?? "0"}%
                    </span>
                  </div>
                </div>
                {/* Pars */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm">Par</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${stats.parsPct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {stats.parsPct?.toFixed(1) ?? "0"}%
                    </span>
                  </div>
                </div>
                {/* Bogeys */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-sm">Bogey</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500"
                        style={{ width: `${stats.bogeysPct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {stats.bogeysPct?.toFixed(1) ?? "0"}%
                    </span>
                  </div>
                </div>
                {/* Double Bogeys */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm">Doble Bogey</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500"
                        style={{ width: `${stats.doubleBogeysPct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {stats.doubleBogeysPct?.toFixed(1) ?? "0"}%
                    </span>
                  </div>
                </div>
                {/* Triple or worse */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-800" />
                    <span className="text-sm">Triple+ Bogey</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-800"
                        style={{ width: `${stats.tripleOrWorsePct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {stats.tripleOrWorsePct?.toFixed(1) ?? "0"}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
            )}
          </CardContent>
        </Card>

        {/* GIR */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GIR (Green in Regulation)</CardTitle>
            <CardDescription>Llegar al green en regulacion</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.girPct !== null ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">
                    {stats.girPct.toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    de los hoyos en regulacion
                  </p>
                </div>
                <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${stats.girPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  GIR = llegar al green en Par-2 golpes o menos
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Putting Averages by Round Length */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 9 Holes Putts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Putts en 9 Hoyos</CardTitle>
            <CardDescription>Promedio por ronda</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.avgPutts9holes !== null ? (
                <>{stats.avgPutts9holes.toFixed(1)} {formatDeviation(stats.avgPutts9holes, 18)}</>
              ) : (
                <span className="text-muted-foreground text-xl">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.avgPutts9holes !== null
                ? "Putts totales promedio (objetivo 18)"
                : "No hay rondas de 9 hoyos"}
            </p>
          </CardContent>
        </Card>

        {/* 18 Holes Putts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Putts en 18 Hoyos</CardTitle>
            <CardDescription>Promedio por ronda</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.avgPutts18holes !== null ? (
                <>{stats.avgPutts18holes.toFixed(1)} {formatDeviation(stats.avgPutts18holes, 36)}</>
              ) : (
                <span className="text-muted-foreground text-xl">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.avgPutts18holes !== null
                ? "Putts totales promedio (objetivo 36)"
                : "No hay rondas de 18 hoyos"}
            </p>
          </CardContent>
        </Card>
      </div>

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
                El <strong>HVP</strong> (Handicap Virtual Promedio) indica el handicap al que
                estas jugando realmente. Se calcula a partir de tus puntos Stableford.
                Las rondas de 9 hoyos se duplican para equipararlas a 18 hoyos.
              </p>
              <p>
                La desviacion entre parentesis compara tu HVP con tu handicap oficial.
                <span className="text-green-600"> Verde</span> = juegas mejor que tu handicap,
                <span className="text-red-500"> rojo</span> = juegas peor.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
