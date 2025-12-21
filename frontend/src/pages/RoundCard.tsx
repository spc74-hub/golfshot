import { useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useRound } from "@/hooks/useRounds";
import { useCourse } from "@/hooks/useCourses";
import {
  calculateStablefordPoints,
  calculateSindicatoPoints,
  calculateStrokesReceived,
  getHolesForCourseLength,
  getScoreResultVsPar,
  calculateMatchPlayScore,
  formatMatchPlayScore,
  formatMatchPlayFinalResult,
  getMatchPlayHolesRemaining,
  calculatePlayingHandicap,
} from "@/lib/calculations";
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

  // Helper to recalculate HDJ if stored as 0 (legacy rounds)
  const recalculateHDJ = (player: Player): number => {
    if (!course || player.playingHandicap !== 0) return player.playingHandicap;
    // Find the tee slope for this player
    const tee = course.tees?.find((t: { name: string; slope: number }) => t.name === player.teeBox);
    if (!tee) return player.playingHandicap;
    // Recalculate using the stored handicap index and tee slope
    return calculatePlayingHandicap(player.odHandicapIndex, tee.slope, round?.handicapPercentage || 100);
  };

  // Get the effective handicap for a player (when useHandicap is false, all use first player's handicap)
  const getEffectiveHandicap = (player: Player): number => {
    if (!round) return player.playingHandicap;
    // When useHandicap is false, everyone uses the first player's handicap
    if (!round.useHandicap) {
      const firstPlayer = round.players[0];
      if (!firstPlayer) return 0;
      // Recalculate if stored as 0 (legacy rounds created before fix)
      return recalculateHDJ(firstPlayer);
    }
    return recalculateHDJ(player);
  };

  // Calculate points for a specific hole
  const getHolePoints = (player: Player, holeNum: number): number | null => {
    if (!course) return null;
    const score = player.scores[holeNum];
    if (!score) return null;

    const holeData = course.holesData.find((h: HoleData) => h.number === holeNum);
    if (!holeData) return null;

    const effectiveHandicap = getEffectiveHandicap(player);

    if (round?.gameMode === "sindicato") {
      // For Sindicato mode, we need to pass modified players with effective handicaps
      const playersWithEffectiveHcp = round.players.map((p: Player) => ({
        ...p,
        playingHandicap: getEffectiveHandicap(p),
      }));
      const sindicatoPoints = calculateSindicatoPoints(
        playersWithEffectiveHcp,
        holeNum,
        course.holesData,
        round.sindicatoPoints || [4, 2, 1, 0]
      );
      return sindicatoPoints.get(player.id) || 0;
    }

    return calculateStablefordPoints(
      score.strokes,
      holeData.par,
      effectiveHandicap,
      holeData.handicap
    );
  };

  // Calculate Stableford points for a specific hole (always, regardless of game mode)
  const getStablefordPoints = (player: Player, holeNum: number): number | null => {
    if (!course) return null;
    const score = player.scores[holeNum];
    if (!score) return null;

    const holeData = course.holesData.find((h: HoleData) => h.number === holeNum);
    if (!holeData) return null;

    const effectiveHandicap = getEffectiveHandicap(player);

    return calculateStablefordPoints(
      score.strokes,
      holeData.par,
      effectiveHandicap,
      holeData.handicap
    );
  };

  // Calculate totals for a set of holes
  const getHolesTotals = (player: Player, holeNumbers: number[]) => {
    let strokes = 0;
    let putts = 0;
    let points = 0;
    let stablefordPoints = 0;
    let holesPlayed = 0;
    let parPlayed = 0; // Par of holes actually played

    holeNumbers.forEach(holeNum => {
      const score = player.scores[holeNum];
      if (score) {
        strokes += score.strokes;
        putts += score.putts;
        const holePoints = getHolePoints(player, holeNum);
        if (holePoints !== null) points += holePoints;
        const stbfPoints = getStablefordPoints(player, holeNum);
        if (stbfPoints !== null) stablefordPoints += stbfPoints;
        holesPlayed++;
        // Add par of this hole
        const holeData = course?.holesData.find((h: HoleData) => h.number === holeNum);
        if (holeData) parPlayed += holeData.par;
      }
    });

    return { strokes, putts, points, stablefordPoints, holesPlayed, parPlayed };
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

  // Check if player receives stroke(s) on a hole
  const hasStrokeOnHole = (player: Player, holeNum: number): boolean => {
    if (!course) return false;
    const holeData = course.holesData.find((h: HoleData) => h.number === holeNum);
    if (!holeData) return false;
    const effectiveHcp = getEffectiveHandicap(player);
    return calculateStrokesReceived(effectiveHcp, holeData.handicap) > 0;
  };

  // Check if GIR (Green in Regulation) was achieved
  // GIR = reaching the green in (par - 2) strokes or less
  // Par 3: 1 stroke to green, Par 4: 2 strokes to green, Par 5: 3 strokes to green
  const isGIR = (player: Player, holeNum: number): boolean | null => {
    if (!course) return null;
    const score = player.scores[holeNum];
    if (!score || score.putts === undefined) return null;

    const holeData = course.holesData.find((h: HoleData) => h.number === holeNum);
    if (!holeData) return null;

    const strokesToGreen = score.strokes - score.putts;
    const targetStrokes = holeData.par - 2;

    return strokesToGreen <= targetStrokes;
  };

  // Calculate GIR count for a set of holes
  const getGIRCount = (player: Player, holeNumbers: number[]): { hit: number; total: number } => {
    let hit = 0;
    let total = 0;

    holeNumbers.forEach(holeNum => {
      const gir = isGIR(player, holeNum);
      if (gir !== null) {
        total++;
        if (gir) hit++;
      }
    });

    return { hit, total };
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
            {round.isFinished && round.virtualHandicap != null && (
              <Badge variant="outline" className="ml-2">
                HV: {round.virtualHandicap.toFixed(1)}
              </Badge>
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

      {/* Match Play Result */}
      {round.gameMode === "matchplay" && round.players.length === 2 && course && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-lg">Resultado Match Play</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              // Use effective handicaps for Match Play scoring
              const player1WithEffectiveHcp = {
                ...round.players[0],
                playingHandicap: getEffectiveHandicap(round.players[0]),
              };
              const player2WithEffectiveHcp = {
                ...round.players[1],
                playingHandicap: getEffectiveHandicap(round.players[1]),
              };
              const matchScore = calculateMatchPlayScore(
                player1WithEffectiveHcp,
                player2WithEffectiveHcp,
                round.completedHoles || [],
                course.holesData
              );
              const holesRemaining = getMatchPlayHolesRemaining(
                round.courseLength,
                round.completedHoles || []
              );
              const player1EffectiveHcp = getEffectiveHandicap(round.players[0]);
              const player2EffectiveHcp = getEffectiveHandicap(round.players[1]);
              const player1Stableford = holes.reduce((sum, h) => {
                const score = round.players[0].scores[h];
                const holeData = course.holesData.find((hd: HoleData) => hd.number === h);
                if (!score || !holeData) return sum;
                return sum + calculateStablefordPoints(score.strokes, holeData.par, player1EffectiveHcp, holeData.handicap);
              }, 0);
              const player2Stableford = holes.reduce((sum, h) => {
                const score = round.players[1].scores[h];
                const holeData = course.holesData.find((hd: HoleData) => hd.number === h);
                if (!score || !holeData) return sum;
                return sum + calculateStablefordPoints(score.strokes, holeData.par, player2EffectiveHcp, holeData.handicap);
              }, 0);

              // Determine colors: UP = blue, DN = red, AS = neutral
              const player1Result = round.isFinished
                ? formatMatchPlayFinalResult(matchScore, holesRemaining, 0)
                : formatMatchPlayScore(matchScore, 0);
              const player2Result = round.isFinished
                ? formatMatchPlayFinalResult(matchScore, holesRemaining, 1)
                : formatMatchPlayScore(matchScore, 1);
              const player1Color = player1Result.includes("UP") ? "text-blue-500" : player1Result.includes("DN") ? "text-red-500" : "text-primary";
              const player2Color = player2Result.includes("UP") ? "text-blue-500" : player2Result.includes("DN") ? "text-red-500" : "text-primary";

              // Calculate points diff vs objective (2 pts per hole)
              const holesCompleted = (round.completedHoles || []).length;
              const expectedPoints = holesCompleted * 2;
              const player1PointsDiff = player1Stableford - expectedPoints;
              const player2PointsDiff = player2Stableford - expectedPoints;

              return (
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <div className="font-semibold">{round.players[0].name}</div>
                    <div className={`text-3xl font-bold ${player1Color}`}>
                      {player1Result}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {player1Stableford} pts{" "}
                      <span className={player1PointsDiff < 0 ? "text-red-500" : ""}>
                        ({player1PointsDiff >= 0 ? "+" : ""}{player1PointsDiff})
                      </span>
                    </div>
                  </div>
                  <div className="text-center px-4">
                    <div className="text-sm text-muted-foreground">vs</div>
                    {!round.isFinished && (
                      <div className="text-xs font-medium">
                        {holesRemaining} hoyos restantes
                      </div>
                    )}
                  </div>
                  <div className="text-center flex-1">
                    <div className="font-semibold">{round.players[1].name}</div>
                    <div className={`text-3xl font-bold ${player2Color}`}>
                      {player2Result}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {player2Stableford} pts{" "}
                      <span className={player2PointsDiff < 0 ? "text-red-500" : ""}>
                        ({player2PointsDiff >= 0 ? "+" : ""}{player2PointsDiff})
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Scorecard for each player */}
      {round.players.map((player: Player) => {
        const front9Totals = getHolesTotals(player, front9);
        const back9Totals = getHolesTotals(player, back9);
        const totalTotals = {
          strokes: front9Totals.strokes + back9Totals.strokes,
          putts: front9Totals.putts + back9Totals.putts,
          points: front9Totals.points + back9Totals.points,
          stablefordPoints: front9Totals.stablefordPoints + back9Totals.stablefordPoints,
          holesPlayed: front9Totals.holesPlayed + back9Totals.holesPlayed,
          parPlayed: front9Totals.parPlayed + back9Totals.parPlayed,
        };

        // Calculate differences vs objectives (based on holes actually played, not total course)
        const strokesDiff = totalTotals.strokes - totalTotals.parPlayed;
        const puttsDiff = totalTotals.putts - (totalTotals.holesPlayed * 2);
        const expectedPoints = totalTotals.holesPlayed * 2;
        const pointsDiff = totalTotals.stablefordPoints - expectedPoints;

        return (
          <Card key={player.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{player.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    HDJ: {getEffectiveHandicap(player)}{!round.useHandicap && " (común)"} | Tee: {player.teeBox}
                  </p>
                </div>
                <div className="text-right">
                  {round.gameMode === "matchplay" ? (
                    <>
                      <div className="text-2xl font-bold text-primary">
                        {totalTotals.stablefordPoints} pts{" "}
                        <span className={`text-sm ${pointsDiff < 0 ? "text-red-500" : "text-foreground"}`}>
                          ({pointsDiff >= 0 ? "+" : ""}{pointsDiff})
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {totalTotals.strokes} golpes{" "}
                        <span className={strokesDiff > 0 ? "text-red-500" : ""}>
                          ({strokesDiff >= 0 ? "+" : ""}{strokesDiff})
                        </span>
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-primary">
                        {totalTotals.points} pts{" "}
                        <span className={`text-sm ${pointsDiff < 0 ? "text-red-500" : "text-foreground"}`}>
                          ({pointsDiff >= 0 ? "+" : ""}{pointsDiff})
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {totalTotals.strokes} golpes{" "}
                        <span className={strokesDiff > 0 ? "text-red-500" : ""}>
                          ({strokesDiff >= 0 ? "+" : ""}{strokesDiff})
                        </span>
                      </p>
                      {round.gameMode === "sindicato" && (
                        <p className="text-xs text-muted-foreground">
                          Stableford: {totalTotals.stablefordPoints} pts
                        </p>
                      )}
                    </>
                  )}
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
                            const hasStroke = hasStrokeOnHole(player, h);
                            return (
                              <td
                                key={h}
                                className={`p-1 text-center font-medium ${
                                  colorClass ? colorClass + " rounded" : (isCompleted ? "text-foreground" : "text-muted-foreground/50")
                                }`}
                              >
                                {score?.strokes || "-"}{hasStroke && <span className="text-[8px] align-super">*</span>}
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
                        {/* GIR row */}
                        <tr className="border-b">
                          <td className="p-1 font-medium">GIR</td>
                          {front9.map(h => {
                            const gir = isGIR(player, h);
                            const isCompleted = round.completedHoles?.includes(h);
                            return (
                              <td
                                key={h}
                                className={`p-1 text-center ${
                                  !isCompleted ? "text-muted-foreground/50" :
                                  gir === true ? "text-green-600" :
                                  gir === false ? "text-red-500" : ""
                                }`}
                              >
                                {gir === null ? "-" : gir ? "●" : "○"}
                              </td>
                            );
                          })}
                          <td className="p-1 text-center bg-muted/50 text-xs">
                            {(() => {
                              const girStats = getGIRCount(player, front9);
                              return girStats.total > 0 ? `${girStats.hit}/${girStats.total}` : "-";
                            })()}
                          </td>
                        </tr>
                        {/* Points row */}
                        {(round.gameMode === "stableford" || round.gameMode === "matchplay") && (
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
                            const hasStroke = hasStrokeOnHole(player, h);
                            return (
                              <td
                                key={h}
                                className={`p-1 text-center font-medium ${
                                  colorClass ? colorClass + " rounded" : (isCompleted ? "text-foreground" : "text-muted-foreground/50")
                                }`}
                              >
                                {score?.strokes || "-"}{hasStroke && <span className="text-[8px] align-super">*</span>}
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
                        {/* GIR row */}
                        <tr className="border-b">
                          <td className="p-1 font-medium">GIR</td>
                          {back9.map(h => {
                            const gir = isGIR(player, h);
                            const isCompleted = round.completedHoles?.includes(h);
                            return (
                              <td
                                key={h}
                                className={`p-1 text-center ${
                                  !isCompleted ? "text-muted-foreground/50" :
                                  gir === true ? "text-green-600" :
                                  gir === false ? "text-red-500" : ""
                                }`}
                              >
                                {gir === null ? "-" : gir ? "●" : "○"}
                              </td>
                            );
                          })}
                          <td className="p-1 text-center bg-muted/50 text-xs">
                            {(() => {
                              const girStats = getGIRCount(player, back9);
                              return girStats.total > 0 ? `${girStats.hit}/${girStats.total}` : "-";
                            })()}
                          </td>
                          <td className="p-1 text-center bg-primary/10 text-xs">
                            {(() => {
                              const girStats = getGIRCount(player, holes);
                              return girStats.total > 0 ? `${girStats.hit}/${girStats.total}` : "-";
                            })()}
                          </td>
                        </tr>
                        {/* Points row */}
                        {(round.gameMode === "stableford" || round.gameMode === "matchplay") && (
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
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-muted rounded">
                  <div className="text-lg font-bold">
                    {totalTotals.strokes}{" "}
                    <span className={`text-sm ${strokesDiff > 0 ? "text-red-500" : "text-green-600"}`}>
                      ({strokesDiff >= 0 ? "+" : ""}{strokesDiff})
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">Golpes</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-lg font-bold">
                    {totalTotals.putts}{" "}
                    <span className={`text-sm ${puttsDiff > 0 ? "text-red-500" : "text-green-600"}`}>
                      ({puttsDiff >= 0 ? "+" : ""}{puttsDiff})
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">Putts</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  {(() => {
                    const girStats = getGIRCount(player, holes);
                    const girPercent = girStats.total > 0 ? Math.round((girStats.hit / girStats.total) * 100) : 0;
                    return (
                      <>
                        <div className="text-lg font-bold">
                          {girStats.hit}/{girStats.total}{" "}
                          <span className={`text-sm ${girPercent >= 50 ? "text-green-600" : "text-red-500"}`}>
                            ({girPercent}%)
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">GIR</div>
                      </>
                    );
                  })()}
                </div>
                {(round.gameMode === "stableford" || round.gameMode === "matchplay") && (
                  <div className="p-2 bg-primary/10 rounded">
                    <div className="text-lg font-bold text-primary">
                      {totalTotals.points}{" "}
                      <span className={`text-sm ${pointsDiff < 0 ? "text-red-500" : "text-green-600"}`}>
                        ({pointsDiff >= 0 ? "+" : ""}{pointsDiff})
                      </span>
                    </div>
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
