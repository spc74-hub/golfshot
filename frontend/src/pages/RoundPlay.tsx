import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useRound, useUpdateRound, useFinishRound, useDeleteRound } from "@/hooks/useRounds";
import { useCourse } from "@/hooks/useCourses";
import {
  calculateStablefordPoints,
  getScoreResultVsPar,
  getHolesForCourseLength,
} from "@/lib/calculations";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogOut, Trash2, Save, ClipboardList } from "lucide-react";
import type { Player, HoleData, Score } from "@/types";
import { SCORE_COLORS, DEFAULT_PUTTS } from "@/types";

export function RoundPlay() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roundId = searchParams.get("id");

  const { data: round, isLoading: roundLoading } = useRound(roundId || undefined);
  const { data: course } = useCourse(round?.courseId);
  const updateRound = useUpdateRound();
  const finishRound = useFinishRound();
  const deleteRound = useDeleteRound();

  const [currentHole, setCurrentHole] = useState(1);
  const [playerScores, setPlayerScores] = useState<Record<string, Score>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  // Get holes for this round
  const holes = useMemo(() => {
    if (!round) return [];
    return getHolesForCourseLength(round.courseLength);
  }, [round]);

  // Current hole data
  const currentHoleData = useMemo(() => {
    if (!course) return null;
    return course.holesData.find((h: HoleData) => h.number === currentHole) || null;
  }, [course, currentHole]);

  // Initialize scores from round data
  useEffect(() => {
    if (round) {
      setCurrentHole(round.currentHole);
      // Initialize player scores for current hole
      const scores: Record<string, Score> = {};
      round.players.forEach((player: Player) => {
        if (player.scores[currentHole]) {
          scores[player.id] = player.scores[currentHole];
        } else {
          scores[player.id] = { strokes: currentHoleData?.par || 4, putts: DEFAULT_PUTTS };
        }
      });
      setPlayerScores(scores);
    }
  }, [round, currentHole, currentHoleData?.par]);

  // Update strokes for a player
  const updateStrokes = (playerId: string, strokes: number) => {
    setPlayerScores((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], strokes: Math.max(1, strokes) },
    }));
  };

  // Update putts for a player
  const updatePutts = (playerId: string, putts: number) => {
    setPlayerScores((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], putts: Math.max(0, putts) },
    }));
  };

  // Save current hole and go to next
  const saveAndNext = async () => {
    if (!round || !roundId) return;

    setIsSaving(true);
    try {
      // Build updated players with new scores
      const updatedPlayers = round.players.map((player: Player) => ({
        ...player,
        scores: {
          ...player.scores,
          [currentHole]: playerScores[player.id],
        },
      }));

      const completedHoles = [...(round.completedHoles || [])];
      if (!completedHoles.includes(currentHole)) {
        completedHoles.push(currentHole);
      }

      const nextHoleIndex = holes.indexOf(currentHole) + 1;
      const nextHole = nextHoleIndex < holes.length ? holes[nextHoleIndex] : currentHole;

      await updateRound.mutateAsync({
        id: roundId,
        data: {
          currentHole: nextHole,
          completedHoles: completedHoles,
          players: updatedPlayers,
        },
      });

      if (nextHoleIndex < holes.length) {
        setCurrentHole(nextHole);
      }
    } catch (error) {
      console.error("Error saving scores:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Save and go to previous hole
  const saveAndPrev = async () => {
    if (!round || !roundId) return;

    setIsSaving(true);
    try {
      const updatedPlayers = round.players.map((player: Player) => ({
        ...player,
        scores: {
          ...player.scores,
          [currentHole]: playerScores[player.id],
        },
      }));

      const completedHoles = [...(round.completedHoles || [])];
      if (!completedHoles.includes(currentHole)) {
        completedHoles.push(currentHole);
      }

      const prevHoleIndex = holes.indexOf(currentHole) - 1;
      const prevHole = prevHoleIndex >= 0 ? holes[prevHoleIndex] : currentHole;

      await updateRound.mutateAsync({
        id: roundId,
        data: {
          currentHole: prevHole,
          completedHoles: completedHoles,
          players: updatedPlayers,
        },
      });

      if (prevHoleIndex >= 0) {
        setCurrentHole(prevHole);
      }
    } catch (error) {
      console.error("Error saving scores:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Finish round
  const handleFinish = async () => {
    if (!round || !roundId) return;

    // First save current hole
    setIsSaving(true);
    try {
      const updatedPlayers = round.players.map((player: Player) => ({
        ...player,
        scores: {
          ...player.scores,
          [currentHole]: playerScores[player.id],
        },
      }));

      const completedHoles = [...(round.completedHoles || [])];
      if (!completedHoles.includes(currentHole)) {
        completedHoles.push(currentHole);
      }

      await updateRound.mutateAsync({
        id: roundId,
        data: {
          completedHoles: completedHoles,
          players: updatedPlayers,
        },
      });

      await finishRound.mutateAsync(roundId);
      navigate(`/round/card?id=${roundId}`);
    } catch (error) {
      console.error("Error finishing round:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate total points for a player (only completed holes)
  const getTotalPoints = (player: Player): number => {
    if (!course || !round?.useHandicap) return 0;

    let total = 0;
    const completedHoles = round.completedHoles || [];

    completedHoles.forEach((holeNum) => {
      const score = player.scores[holeNum];
      const holeData = course.holesData.find((h: HoleData) => h.number === holeNum);
      if (score && holeData) {
        total += calculateStablefordPoints(
          score.strokes,
          holeData.par,
          player.playingHandicap,
          holeData.handicap
        );
      }
    });
    return total;
  };

  // Get Stableford points for current hole
  const getHolePoints = (player: Player): number => {
    if (!currentHoleData || !round?.useHandicap) return 0;
    const score = playerScores[player.id];
    if (!score) return 0;

    return calculateStablefordPoints(
      score.strokes,
      currentHoleData.par,
      player.playingHandicap,
      currentHoleData.handicap
    );
  };

  // Get score color class (based on gross strokes vs par, not handicap)
  const getScoreColor = (player: Player): string => {
    if (!currentHoleData) return "";
    const score = playerScores[player.id];
    if (!score) return "";

    // Use gross score vs par for colors (like standard golf apps)
    const result = getScoreResultVsPar(score.strokes, currentHoleData.par);
    return SCORE_COLORS[result] || "";
  };

  // Navigate to a specific hole (save current first)
  const goToHole = async (targetHole: number) => {
    if (!round || !roundId || targetHole === currentHole) return;

    setIsSaving(true);
    try {
      const updatedPlayers = round.players.map((player: Player) => ({
        ...player,
        scores: {
          ...player.scores,
          [currentHole]: playerScores[player.id],
        },
      }));

      const completedHoles = [...(round.completedHoles || [])];
      if (!completedHoles.includes(currentHole) && playerScores[round.players[0]?.id]?.strokes) {
        completedHoles.push(currentHole);
      }

      await updateRound.mutateAsync({
        id: roundId,
        data: {
          currentHole: targetHole,
          completedHoles: completedHoles,
          players: updatedPlayers,
        },
      });

      setCurrentHole(targetHole);
    } catch (error) {
      console.error("Error navigating to hole:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Save current progress and exit to home
  const handleSaveAndExit = async () => {
    if (!round || !roundId) return;

    setIsSaving(true);
    try {
      const updatedPlayers = round.players.map((player: Player) => ({
        ...player,
        scores: {
          ...player.scores,
          [currentHole]: playerScores[player.id],
        },
      }));

      const completedHoles = [...(round.completedHoles || [])];
      if (!completedHoles.includes(currentHole) && playerScores[round.players[0]?.id]?.strokes) {
        completedHoles.push(currentHole);
      }

      await updateRound.mutateAsync({
        id: roundId,
        data: {
          currentHole: currentHole,
          completedHoles: completedHoles,
          players: updatedPlayers,
        },
      });

      setShowExitDialog(false);
      navigate("/");
    } catch (error) {
      console.error("Error saving round:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Abandon round (delete it)
  const handleAbandonRound = async () => {
    if (!roundId) return;

    setIsSaving(true);
    try {
      await deleteRound.mutateAsync(roundId);
      setShowExitDialog(false);
      navigate("/");
    } catch (error) {
      console.error("Error deleting round:", error);
    } finally {
      setIsSaving(false);
    }
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

  const isFirstHole = holes.indexOf(currentHole) === 0;
  const isLastHole = holes.indexOf(currentHole) === holes.length - 1;

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowExitDialog(true)}
          className="text-muted-foreground"
        >
          <LogOut className="h-4 w-4 mr-1" />
          Salir
        </Button>
        <div className="text-center flex-1">
          <h1 className="text-xl font-bold">{round.courseName}</h1>
          <p className="text-sm text-muted-foreground">
            {round.gameMode === "stableford" && "Stableford"}
            {round.gameMode === "stroke" && "Stroke Play"}
            {round.gameMode === "sindicato" && "Sindicato"}
            {round.gameMode === "team" && "Equipos"}
          </p>
        </div>
        <Link to={`/round/card?id=${roundId}`}>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ClipboardList className="h-4 w-4 mr-1" />
            Tarjeta
          </Button>
        </Link>
      </div>

      {/* Exit Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salir de la partida</DialogTitle>
            <DialogDescription>
              ¿Qué quieres hacer con esta partida?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleSaveAndExit}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar y salir (continuar después)
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={handleAbandonRound}
              disabled={isSaving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Abandonar partida (borrar)
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowExitDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hole Info */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-3xl">Hoyo {currentHole}</CardTitle>
            <div className="text-right">
              <div className="text-2xl font-bold">Par {currentHoleData?.par}</div>
              <div className="text-xs text-muted-foreground">
                HCP {currentHoleData?.handicap} · {currentHoleData?.distance}m
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Player Scores */}
      {round.players.map((player: Player) => (
        <Card key={player.id}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold">{player.name}</div>
                <div className="text-xs text-muted-foreground">
                  HDJ: {player.playingHandicap}
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-lg">
                  {getTotalPoints(player)} pts
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Strokes */}
              <div className="space-y-1">
                <Label className="text-xs">Golpes</Label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-10"
                    onClick={() =>
                      updateStrokes(player.id, (playerScores[player.id]?.strokes || 4) - 1)
                    }
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    value={playerScores[player.id]?.strokes || currentHoleData?.par || 4}
                    onChange={(e) =>
                      updateStrokes(player.id, parseInt(e.target.value) || 1)
                    }
                    className={`h-10 w-14 text-center text-lg font-bold ${getScoreColor(player)}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-10"
                    onClick={() =>
                      updateStrokes(player.id, (playerScores[player.id]?.strokes || 4) + 1)
                    }
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Putts */}
              <div className="space-y-1">
                <Label className="text-xs">Putts</Label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-10"
                    onClick={() =>
                      updatePutts(player.id, (playerScores[player.id]?.putts || 2) - 1)
                    }
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    value={playerScores[player.id]?.putts || DEFAULT_PUTTS}
                    onChange={(e) =>
                      updatePutts(player.id, parseInt(e.target.value) || 0)
                    }
                    className="h-10 w-14 text-center text-lg font-bold"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-10"
                    onClick={() =>
                      updatePutts(player.id, (playerScores[player.id]?.putts || 2) + 1)
                    }
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Points */}
              {round.useHandicap && round.gameMode === "stableford" && (
                <div className="space-y-1">
                  <Label className="text-xs">Puntos</Label>
                  <div className="h-10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">
                      {getHolePoints(player)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="max-w-lg mx-auto flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={isFirstHole || isSaving}
            onClick={saveAndPrev}
          >
            ← Anterior
          </Button>

          {isLastHole ? (
            <Button
              className="flex-1"
              disabled={isSaving}
              onClick={handleFinish}
            >
              {isSaving ? "Guardando..." : "Finalizar"}
            </Button>
          ) : (
            <Button
              className="flex-1"
              disabled={isSaving}
              onClick={saveAndNext}
            >
              {isSaving ? "Guardando..." : "Siguiente →"}
            </Button>
          )}
        </div>

        {/* Hole indicators */}
        <div className="flex justify-center gap-1 mt-2">
          {holes.map((hole) => (
            <button
              key={hole}
              onClick={() => goToHole(hole)}
              disabled={isSaving}
              className={`w-6 h-6 text-xs rounded-full transition-colors ${
                hole === currentHole
                  ? "bg-primary text-primary-foreground"
                  : round.completedHoles?.includes(hole)
                  ? "bg-green-500 text-white"
                  : "bg-muted hover:bg-muted/80"
              } ${isSaving ? "opacity-50" : ""}`}
            >
              {hole}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
