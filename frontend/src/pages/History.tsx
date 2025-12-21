import { Link } from "react-router-dom";
import { useRounds, useDeleteRound } from "@/hooks/useRounds";
import { useCourses } from "@/hooks/useCourses";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Play, Trash2, Eye, Edit, Flag, Upload, ChevronDown, ChevronRight, TrendingUp, Target, Circle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo } from "react";
import type { Round, HoleData, Course } from "@/types";

// Calculate Stableford points for a hole
function calculateStablefordPoints(
  strokes: number,
  par: number,
  playingHandicap: number,
  holeHandicap: number
): number {
  if (strokes <= 0) return 0;

  // Calculate strokes received on this hole
  let strokesReceived = 0;
  if (playingHandicap > 0) {
    const baseStrokes = Math.floor(playingHandicap / 18);
    const remainder = playingHandicap % 18;
    strokesReceived = baseStrokes + (holeHandicap <= remainder ? 1 : 0);
  }

  const netScore = strokes - strokesReceived;
  const diff = netScore - par;

  if (diff <= -3) return 5; // Albatross or better
  if (diff === -2) return 4; // Eagle
  if (diff === -1) return 3; // Birdie
  if (diff === 0) return 2; // Par
  if (diff === 1) return 1; // Bogey
  return 0; // Double bogey or worse
}

interface MonthStats {
  roundsPlayed: number;
  hvpAvg: number | null;
  avgStrokes9: number | null;
  avgStrokes18: number | null;
  avgStrokesPar3: number | null;
  avgStrokesPar4: number | null;
  avgStrokesPar5: number | null;
  avgPutts: number | null;
  girPct: number | null;
  scoreDistribution: {
    eaglesOrBetter: number;
    birdies: number;
    pars: number;
    bogeys: number;
    doubleBogeys: number;
    tripleOrWorse: number;
    total: number;
  };
}

interface MonthGroup {
  key: string;
  label: string;
  rounds: Round[];
  stats: MonthStats;
}

function calculateMonthStats(rounds: Round[], courses: Course[]): MonthStats {
  const coursesMap = new Map(courses.map(c => [c.id, c]));

  let hvpValues: number[] = [];
  let strokes9Values: number[] = [];
  let strokes18Values: number[] = [];
  let par3Strokes: number[] = [];
  let par4Strokes: number[] = [];
  let par5Strokes: number[] = [];
  let puttsValues: number[] = [];
  let girHit = 0;
  let girTotal = 0;
  let eagles = 0, birdies = 0, pars = 0, bogeys = 0, doubleBogeys = 0, tripleOrWorse = 0, totalHoles = 0;

  for (const round of rounds) {
    if (!round.isFinished) continue;

    const course = coursesMap.get(round.courseId);
    if (!course) continue;

    const holesMap = new Map<number, HoleData>(
      course.holesData.map((h: HoleData) => [h.number, h])
    );

    // Get which holes to count based on course length
    let holesToCount: number[];
    if (round.courseLength === "front9") {
      holesToCount = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    } else if (round.courseLength === "back9") {
      holesToCount = [10, 11, 12, 13, 14, 15, 16, 17, 18];
    } else {
      holesToCount = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    }

    const player = round.players[0];
    if (!player) continue;

    let roundStrokes = 0;
    let roundPutts = 0;
    let roundStableford = 0;
    let holesPlayed = 0;

    for (const holeNum of holesToCount) {
      const score = player.scores[holeNum];
      const holeData = holesMap.get(holeNum);
      if (!score || !holeData) continue;

      const strokes = score.strokes;
      const putts = score.putts ?? 0;
      const par = holeData.par;
      const hcpIndex = holeData.handicap;

      if (strokes <= 0) continue;

      holesPlayed++;
      roundStrokes += strokes;
      roundPutts += putts;

      // Track by par type
      if (par === 3) par3Strokes.push(strokes);
      else if (par === 4) par4Strokes.push(strokes);
      else if (par === 5) par5Strokes.push(strokes);

      // Score distribution (gross)
      const grossDiff = strokes - par;
      totalHoles++;
      if (grossDiff <= -2) eagles++;
      else if (grossDiff === -1) birdies++;
      else if (grossDiff === 0) pars++;
      else if (grossDiff === 1) bogeys++;
      else if (grossDiff === 2) doubleBogeys++;
      else tripleOrWorse++;

      // GIR
      if (putts > 0) {
        const strokesToGreen = strokes - putts;
        const targetStrokes = par - 2;
        girTotal++;
        if (strokesToGreen <= targetStrokes) girHit++;
      }

      // Stableford
      const points = calculateStablefordPoints(strokes, par, player.playingHandicap, hcpIndex);
      roundStableford += points;
    }

    if (holesPlayed > 0) {
      // Separate strokes by round type
      const is9Hole = round.courseLength !== "18";
      if (is9Hole) {
        strokes9Values.push(roundStrokes);
      } else {
        strokes18Values.push(roundStrokes);
      }
      if (roundPutts > 0) puttsValues.push(roundPutts);
    }

    // HVP
    if (round.virtualHandicap != null) {
      hvpValues.push(round.virtualHandicap);
    } else if (roundStableford > 0 && player.odHandicapIndex) {
      // Fallback calculation
      const is9Hole = round.courseLength !== "18";
      const normalizedStableford = is9Hole ? roundStableford * 2 : roundStableford;
      const hv = player.odHandicapIndex - (normalizedStableford - 36);
      hvpValues.push(hv);
    }
  }

  const finishedRounds = rounds.filter(r => r.isFinished).length;

  return {
    roundsPlayed: finishedRounds,
    hvpAvg: hvpValues.length > 0 ? hvpValues.reduce((a, b) => a + b, 0) / hvpValues.length : null,
    avgStrokes9: strokes9Values.length > 0 ? strokes9Values.reduce((a, b) => a + b, 0) / strokes9Values.length : null,
    avgStrokes18: strokes18Values.length > 0 ? strokes18Values.reduce((a, b) => a + b, 0) / strokes18Values.length : null,
    avgStrokesPar3: par3Strokes.length > 0 ? par3Strokes.reduce((a, b) => a + b, 0) / par3Strokes.length : null,
    avgStrokesPar4: par4Strokes.length > 0 ? par4Strokes.reduce((a, b) => a + b, 0) / par4Strokes.length : null,
    avgStrokesPar5: par5Strokes.length > 0 ? par5Strokes.reduce((a, b) => a + b, 0) / par5Strokes.length : null,
    avgPutts: puttsValues.length > 0 ? puttsValues.reduce((a, b) => a + b, 0) / puttsValues.length : null,
    girPct: girTotal > 0 ? (girHit / girTotal) * 100 : null,
    scoreDistribution: {
      eaglesOrBetter: eagles,
      birdies,
      pars,
      bogeys,
      doubleBogeys,
      tripleOrWorse,
      total: totalHoles,
    },
  };
}

function getScoreDistributionPct(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0;
}

export function History() {
  const { data: rounds, isLoading } = useRounds();
  const { data: courses } = useCourses();
  const deleteRound = useDeleteRound();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // Group rounds by month
  const monthGroups = useMemo(() => {
    if (!rounds || rounds.length === 0 || !courses) return [];

    const groups = new Map<string, Round[]>();

    // Sort rounds by date descending
    const sortedRounds = [...rounds].sort((a, b) =>
      new Date(b.roundDate).getTime() - new Date(a.roundDate).getTime()
    );

    for (const round of sortedRounds) {
      const date = parseISO(round.roundDate);
      const key = format(date, "yyyy-MM");

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(round);
    }

    // Convert to array with stats
    const result: MonthGroup[] = [];
    for (const [key, monthRounds] of groups) {
      const date = parseISO(`${key}-01`);
      result.push({
        key,
        label: format(date, "MMMM yyyy", { locale: es }),
        rounds: monthRounds,
        stats: calculateMonthStats(monthRounds, courses),
      });
    }

    // Auto-expand the first month
    if (result.length > 0 && expandedMonths.size === 0) {
      setExpandedMonths(new Set([result[0].key]));
    }

    return result;
  }, [rounds, courses]);

  const handleDelete = async () => {
    if (deleteId) {
      await deleteRound.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
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

      {monthGroups.length > 0 ? (
        <div className="space-y-4">
          {monthGroups.map((group) => (
            <Collapsible
              key={group.key}
              open={expandedMonths.has(group.key)}
              onOpenChange={() => toggleMonth(group.key)}
            >
              {/* Month Header with Stats */}
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedMonths.has(group.key) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <CardTitle className="text-lg capitalize">{group.label}</CardTitle>
                          <CardDescription>
                            {group.stats.roundsPlayed} partida{group.stats.roundsPlayed !== 1 ? "s" : ""} jugada{group.stats.roundsPlayed !== 1 ? "s" : ""}
                          </CardDescription>
                        </div>
                      </div>
                      {group.stats.roundsPlayed > 0 && (
                        <div className="flex items-center gap-4 text-sm">
                          {group.stats.hvpAvg !== null && (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">HVP: {group.stats.hvpAvg.toFixed(1)}</span>
                            </div>
                          )}
                          {(group.stats.avgStrokes18 !== null || group.stats.avgStrokes9 !== null) && (
                            <div className="hidden sm:flex items-center gap-2">
                              <Flag className="h-4 w-4 text-muted-foreground" />
                              {group.stats.avgStrokes18 !== null && (
                                <span>{group.stats.avgStrokes18.toFixed(0)} (18h)</span>
                              )}
                              {group.stats.avgStrokes9 !== null && (
                                <span>{group.stats.avgStrokes9.toFixed(0)} (9h)</span>
                              )}
                            </div>
                          )}
                          {group.stats.girPct !== null && (
                            <div className="hidden md:flex items-center gap-1">
                              <Target className="h-4 w-4 text-muted-foreground" />
                              <span>GIR: {group.stats.girPct.toFixed(0)}%</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {/* Monthly Stats Summary */}
                  {group.stats.roundsPlayed > 0 && (
                    <CardContent className="pt-0 pb-4 border-b">
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        {/* HVP */}
                        <div className="text-center p-2 bg-muted/50 rounded-lg">
                          <div className="text-lg font-bold text-primary">
                            {group.stats.hvpAvg?.toFixed(1) ?? "N/A"}
                          </div>
                          <div className="text-xs text-muted-foreground">HVP</div>
                        </div>
                        {/* Avg Strokes 18h */}
                        <div className="text-center p-2 bg-muted/50 rounded-lg">
                          <div className="text-lg font-bold">
                            {group.stats.avgStrokes18?.toFixed(0) ?? "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">Golpes 18h</div>
                        </div>
                        {/* Avg Strokes 9h */}
                        <div className="text-center p-2 bg-muted/50 rounded-lg">
                          <div className="text-lg font-bold">
                            {group.stats.avgStrokes9?.toFixed(0) ?? "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">Golpes 9h</div>
                        </div>
                        {/* Par 3 */}
                        <div className="text-center p-2 bg-muted/50 rounded-lg">
                          <div className="text-lg font-bold">
                            {group.stats.avgStrokesPar3?.toFixed(1) ?? "N/A"}
                          </div>
                          <div className="text-xs text-muted-foreground">Par 3</div>
                        </div>
                        {/* Par 4 */}
                        <div className="text-center p-2 bg-muted/50 rounded-lg">
                          <div className="text-lg font-bold">
                            {group.stats.avgStrokesPar4?.toFixed(1) ?? "N/A"}
                          </div>
                          <div className="text-xs text-muted-foreground">Par 4</div>
                        </div>
                        {/* Par 5 */}
                        <div className="text-center p-2 bg-muted/50 rounded-lg">
                          <div className="text-lg font-bold">
                            {group.stats.avgStrokesPar5?.toFixed(1) ?? "N/A"}
                          </div>
                          <div className="text-xs text-muted-foreground">Par 5</div>
                        </div>
                        {/* GIR */}
                        <div className="text-center p-2 bg-muted/50 rounded-lg">
                          <div className="text-lg font-bold">
                            {group.stats.girPct?.toFixed(0) ?? "N/A"}%
                          </div>
                          <div className="text-xs text-muted-foreground">GIR</div>
                        </div>
                      </div>

                      {/* Score Distribution */}
                      {group.stats.scoreDistribution.total > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs text-muted-foreground mb-2">Distribucion de resultados</div>
                          <div className="flex gap-1 items-center flex-wrap">
                            <div className="flex items-center gap-1 text-xs">
                              <Circle className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                              <span>{getScoreDistributionPct(group.stats.scoreDistribution.eaglesOrBetter, group.stats.scoreDistribution.total).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
                              <span>{getScoreDistributionPct(group.stats.scoreDistribution.birdies, group.stats.scoreDistribution.total).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <Circle className="h-2.5 w-2.5 fill-blue-500 text-blue-500" />
                              <span>{getScoreDistributionPct(group.stats.scoreDistribution.pars, group.stats.scoreDistribution.total).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <Circle className="h-2.5 w-2.5 fill-orange-500 text-orange-500" />
                              <span>{getScoreDistributionPct(group.stats.scoreDistribution.bogeys, group.stats.scoreDistribution.total).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500" />
                              <span>{getScoreDistributionPct(group.stats.scoreDistribution.doubleBogeys, group.stats.scoreDistribution.total).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <Circle className="h-2.5 w-2.5 fill-red-800 text-red-800" />
                              <span>{getScoreDistributionPct(group.stats.scoreDistribution.tripleOrWorse, group.stats.scoreDistribution.total).toFixed(0)}%</span>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Eagle+ / Birdie / Par / Bogey / Doble / Triple+
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}

                  {/* Individual Rounds */}
                  <CardContent className="pt-4 space-y-3">
                    {group.rounds.map((round) => (
                      <div
                        key={round.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{round.courseName}</span>
                            {round.isImported && (
                              <Badge variant="outline" className="text-xs">
                                <Upload className="h-3 w-3 mr-1" />
                                Importada
                              </Badge>
                            )}
                            {round.isFinished ? (
                              <>
                                <Badge className="text-xs">Finalizada</Badge>
                                {round.virtualHandicap != null && (
                                  <Badge variant="outline" className="text-xs">
                                    HV: {round.virtualHandicap.toFixed(1)}
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                <Play className="h-3 w-3 mr-1" />
                                Hoyo {round.currentHole}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {format(new Date(round.roundDate), "d 'de' MMMM", { locale: es })} - {" "}
                            <span className="capitalize">{round.gameMode}</span> - {" "}
                            {round.courseLength === "18"
                              ? "18 hoyos"
                              : round.courseLength === "front9"
                              ? "Front 9"
                              : "Back 9"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {round.isFinished ? (
                            <>
                              <Link to={`/round/card?id=${round.id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Link to={`/round/play?id=${round.id}`}>
                                <Button variant="outline" size="sm">
                                  <Edit className="h-4 w-4" />
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
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
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
