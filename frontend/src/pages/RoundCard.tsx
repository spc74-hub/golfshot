import { useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useRound } from "@/hooks/useRounds";
import { useCourse } from "@/hooks/useCourses";
import { calculateStablefordPoints, calculateSindicatoPoints, getHolesForCourseLength, getScoreResultVsPar } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Flag } from "lucide-react";
import type { Player, HoleData } from "@/types";
import { SCORE_COLORS } from "@/types";

export function RoundCard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roundId = searchParams.get("id");

  const { data: round, isLoading: roundLoading } = useRound(roundId || undefined);
  const { data: course } = useCourse(round?.courseId);

  // Get holes for this round
  const holes = useMemo(() => {
    if (!round) return [];
    return getHolesForCourseLength(round.courseLength);
  }, [round]);

  // Split holes into front 9 and back 9
  const front9 = useMemo(() => holes.filter(h => h <= 9), [holes]);
  const back9 = useMemo(() => holes.filter(h => h > 9), [holes]);

  // Calculate points for a specific hole
  const getHolePoints = (player: Player, holeNum: number): number | null => {
    if (!course || !round?.useHandicap) return null;
    const score = player.scores[holeNum];
    if (!score) return null;

    const holeData = course.holesData.find((h: HoleData) => h.number === holeNum);
    if (!holeData) return null;

    if (round.gameMode === "sindicato") {
      // For Sindicato mode, calculate points based on position
      const sindicatoPoints = calculateSindicatoPoints(
        round.players,
        holeNum,
        course.holesData,
        round.sindicatoPoints || [4, 2, 1, 0]
      );
      return sindicatoPoints.get(player.id) || 0;
    }

    return calculateStablefordPoints(
      score.strokes,
      holeData.par,
      player.playingHandicap,
      holeData.handicap
    );
  };

  // Calculate totals for a set of holes
  const getHolesTotals = (player: Player, holeNumbers: number[]) => {
    let strokes = 0;
    let putts = 0;
    let points = 0;
    let holesPlayed = 0;

    holeNumbers.forEach(holeNum => {
      const score = player.scores[holeNum];
      if (score) {
        strokes += score.strokes;
        putts += score.putts;
        const holePoints = getHolePoints(player, holeNum);
        if (holePoints !== null) points += holePoints;
        holesPlayed++;
      }
    });

    return { strokes, putts, points, holesPlayed };
  };

  // Get par for a set of holes
  const getParTotal = (holeNumbers: number[]): number => {
    if (!course) return 0;
    return holeNumbers.reduce((sum, holeNum) => {
      const holeData = course.holesData.find((h: HoleData) => h.number === holeNum);
      return sum + (holeData?.par || 0);
    }, 0);
  };

  // Get score color class for a hole
  const getScoreColor = (player: Player, holeNum: number): string => {
    if (!course) return "";
    const score = player.scores[holeNum];
    if (!score) return "";
    const isCompleted = round?.completedHoles?.includes(holeNum);
    if (!isCompleted) return "";

    const holeData = course.holesData.find((h: HoleData) => h.number === holeNum);
    if (!holeData) return "";

    const result = getScoreResultVsPar(score.strokes, holeData.par);
    return SCORE_COLORS[result] || "";
  };

  if (roundLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Partida no encontrada</h1>
        <Button onClick={() => navigate("/")}>Volver al inicio</Button>
      </div>
    );
  }

  const front9Par = getParTotal(front9);
  const back9Par = getParTotal(back9);
  const totalPar = front9Par + back9Par;

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <div className="text-center flex-1">
          <h1 className="text-xl font-bold">{round.courseName}</h1>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="capitalize">{round.gameMode}</span>
            {round.isFinished ? (
              <Badge>Finalizada</Badge>
            ) : (
              <Badge variant="secondary">En curso - Hoyo {round.currentHole}</Badge>
            )}
          </div>
        </div>
        {!round.isFinished && (
          <Link to={`/round/play?id=${round.id}`}>
            <Button size="sm">
              <Play className="h-4 w-4 mr-1" />
              Jugar
            </Button>
          </Link>
        )}
      </div>

      {/* Scorecard for each player */}
      {round.players.map((player: Player) => {
        const front9Totals = getHolesTotals(player, front9);
        const back9Totals = getHolesTotals(player, back9);
        const totalTotals = {
          strokes: front9Totals.strokes + back9Totals.strokes,
          putts: front9Totals.putts + back9Totals.putts,
          points: front9Totals.points + back9Totals.points,
          holesPlayed: front9Totals.holesPlayed + back9Totals.holesPlayed,
        };

        return (
          <Card key={player.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{player.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    HDJ: {player.playingHandicap} | Tee: {player.teeBox}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {totalTotals.points} pts
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {totalTotals.strokes} golpes ({totalTotals.strokes - totalPar >= 0 ? "+" : ""}{totalTotals.strokes - totalPar})
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  {/* Front 9 */}
                  {front9.length > 0 && (
                    <>
                      <thead>
                        <tr className="bg-muted">
                          <th className="p-1 text-left font-medium">Hoyo</th>
                          {front9.map(h => (
                            <th key={h} className="p-1 text-center font-medium w-8">{h}</th>
                          ))}
                          <th className="p-1 text-center font-medium bg-muted/80 w-12">IDA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Par row */}
                        <tr className="border-b">
                          <td className="p-1 font-medium">Par</td>
                          {front9.map(h => {
                            const holeData = course?.holesData.find((hd: HoleData) => hd.number === h);
                            return (
                              <td key={h} className="p-1 text-center text-muted-foreground">
                                {holeData?.par}
                              </td>
                            );
                          })}
                          <td className="p-1 text-center font-medium bg-muted/50">{front9Par}</td>
                        </tr>
                        {/* HCP row */}
                        <tr className="border-b">
                          <td className="p-1 font-medium">HCP</td>
                          {front9.map(h => {
                            const holeData = course?.holesData.find((hd: HoleData) => hd.number === h);
                            return (
                              <td key={h} className="p-1 text-center text-muted-foreground text-[10px]">
                                {holeData?.handicap}
                              </td>
                            );
                          })}
                          <td className="p-1 text-center bg-muted/50">-</td>
                        </tr>
                        {/* Strokes row */}
                        <tr className="border-b">
                          <td className="p-1 font-medium">Golpes</td>
                          {front9.map(h => {
                            const score = player.scores[h];
                            const isCompleted = round.completedHoles?.includes(h);
                            const colorClass = getScoreColor(player, h);
                            return (
                              <td
                                key={h}
                                className={`p-1 text-center font-medium ${
                                  colorClass ? colorClass + " rounded" : (isCompleted ? "text-foreground" : "text-muted-foreground/50")
                                }`}
                              >
                                {score?.strokes || "-"}
                              </td>
                            );
                          })}
                          <td className="p-1 text-center font-bold bg-muted/50">
                            {front9Totals.strokes || "-"}
                          </td>
                        </tr>
                        {/* Putts row */}
                        <tr className="border-b">
                          <td className="p-1 font-medium">Putts</td>
                          {front9.map(h => {
                            const score = player.scores[h];
                            const isCompleted = round.completedHoles?.includes(h);
                            return (
                              <td
                                key={h}
                                className={`p-1 text-center ${
                                  isCompleted ? "text-foreground" : "text-muted-foreground/50"
                                }`}
                              >
                                {score?.putts ?? "-"}
                              </td>
                            );
                          })}
                          <td className="p-1 text-center bg-muted/50">
                            {front9Totals.putts || "-"}
                          </td>
                        </tr>
                        {/* Points row */}
                        {round.useHandicap && round.gameMode === "stableford" && (
                          <tr className="border-b bg-primary/5">
                            <td className="p-1 font-medium text-primary">Puntos</td>
                            {front9.map(h => {
                              const pts = getHolePoints(player, h);
                              const isCompleted = round.completedHoles?.includes(h);
                              return (
                                <td
                                  key={h}
                                  className={`p-1 text-center font-medium ${
                                    isCompleted ? "text-primary" : "text-muted-foreground/50"
                                  }`}
                                >
                                  {pts ?? "-"}
                                </td>
                              );
                            })}
                            <td className="p-1 text-center font-bold text-primary bg-primary/10">
                              {front9Totals.points || "-"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </>
                  )}

                  {/* Back 9 */}
                  {back9.length > 0 && (
                    <>
                      <thead>
                        <tr className="bg-muted border-t-2">
                          <th className="p-1 text-left font-medium">Hoyo</th>
                          {back9.map(h => (
                            <th key={h} className="p-1 text-center font-medium w-8">{h}</th>
                          ))}
                          <th className="p-1 text-center font-medium bg-muted/80 w-12">VTA</th>
                          <th className="p-1 text-center font-medium bg-primary/20 w-12">TOT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Par row */}
                        <tr className="border-b">
                          <td className="p-1 font-medium">Par</td>
                          {back9.map(h => {
                            const holeData = course?.holesData.find((hd: HoleData) => hd.number === h);
                            return (
                              <td key={h} className="p-1 text-center text-muted-foreground">
                                {holeData?.par}
                              </td>
                            );
                          })}
                          <td className="p-1 text-center font-medium bg-muted/50">{back9Par}</td>
                          <td className="p-1 text-center font-medium bg-primary/10">{totalPar}</td>
                        </tr>
                        {/* HCP row */}
                        <tr className="border-b">
                          <td className="p-1 font-medium">HCP</td>
                          {back9.map(h => {
                            const holeData = course?.holesData.find((hd: HoleData) => hd.number === h);
                            return (
                              <td key={h} className="p-1 text-center text-muted-foreground text-[10px]">
                                {holeData?.handicap}
                              </td>
                            );
                          })}
                          <td className="p-1 text-center bg-muted/50">-</td>
                          <td className="p-1 text-center bg-primary/10">-</td>
                        </tr>
                        {/* Strokes row */}
                        <tr className="border-b">
                          <td className="p-1 font-medium">Golpes</td>
                          {back9.map(h => {
                            const score = player.scores[h];
                            const isCompleted = round.completedHoles?.includes(h);
                            const colorClass = getScoreColor(player, h);
                            return (
                              <td
                                key={h}
                                className={`p-1 text-center font-medium ${
                                  colorClass ? colorClass + " rounded" : (isCompleted ? "text-foreground" : "text-muted-foreground/50")
                                }`}
                              >
                                {score?.strokes || "-"}
                              </td>
                            );
                          })}
                          <td className="p-1 text-center font-bold bg-muted/50">
                            {back9Totals.strokes || "-"}
                          </td>
                          <td className="p-1 text-center font-bold bg-primary/10">
                            {totalTotals.strokes || "-"}
                          </td>
                        </tr>
                        {/* Putts row */}
                        <tr className="border-b">
                          <td className="p-1 font-medium">Putts</td>
                          {back9.map(h => {
                            const score = player.scores[h];
                            const isCompleted = round.completedHoles?.includes(h);
                            return (
                              <td
                                key={h}
                                className={`p-1 text-center ${
                                  isCompleted ? "text-foreground" : "text-muted-foreground/50"
                                }`}
                              >
                                {score?.putts ?? "-"}
                              </td>
                            );
                          })}
                          <td className="p-1 text-center bg-muted/50">
                            {back9Totals.putts || "-"}
                          </td>
                          <td className="p-1 text-center bg-primary/10">
                            {totalTotals.putts || "-"}
                          </td>
                        </tr>
                        {/* Points row */}
                        {round.useHandicap && round.gameMode === "stableford" && (
                          <tr className="border-b bg-primary/5">
                            <td className="p-1 font-medium text-primary">Puntos</td>
                            {back9.map(h => {
                              const pts = getHolePoints(player, h);
                              const isCompleted = round.completedHoles?.includes(h);
                              return (
                                <td
                                  key={h}
                                  className={`p-1 text-center font-medium ${
                                    isCompleted ? "text-primary" : "text-muted-foreground/50"
                                  }`}
                                >
                                  {pts ?? "-"}
                                </td>
                              );
                            })}
                            <td className="p-1 text-center font-bold text-primary bg-primary/10">
                              {back9Totals.points || "-"}
                            </td>
                            <td className="p-1 text-center font-bold text-primary bg-primary/20">
                              {totalTotals.points || "-"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </>
                  )}

                  {/* Only Front 9 or Back 9 - show total row */}
                  {(front9.length > 0 && back9.length === 0) && (
                    <tfoot>
                      <tr className="bg-primary/10 font-bold">
                        <td className="p-1">TOTAL</td>
                        <td colSpan={front9.length} className="p-1 text-center">
                          {totalTotals.holesPlayed} hoyos jugados
                        </td>
                        <td className="p-1 text-center">{totalTotals.strokes}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Summary */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-muted rounded">
                  <div className="text-lg font-bold">{totalTotals.strokes}</div>
                  <div className="text-xs text-muted-foreground">Golpes</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-lg font-bold">{totalTotals.putts}</div>
                  <div className="text-xs text-muted-foreground">Putts</div>
                </div>
                {round.useHandicap && round.gameMode === "stableford" && (
                  <div className="p-2 bg-primary/10 rounded">
                    <div className="text-lg font-bold text-primary">{totalTotals.points}</div>
                    <div className="text-xs text-muted-foreground">Puntos</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Legend */}
      <div className="text-xs text-muted-foreground text-center">
        <Flag className="inline h-3 w-3 mr-1" />
        Los hoyos sin completar aparecen en gris
      </div>
    </div>
  );
}
