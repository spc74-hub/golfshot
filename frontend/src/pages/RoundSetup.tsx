import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCourses } from "@/hooks/useCourses";
import { useCreateRound } from "@/hooks/useRounds";
import { usePlayers, useCreatePlayer } from "@/hooks/usePlayers";
import { useAuth } from "@/context/AuthContext";
import { calculatePlayingHandicap } from "@/lib/calculations";
import { coursesApi } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Upload, ClipboardPaste, Image, Check, X, UserPlus, Save } from "lucide-react";
import type {
  Course,
  GameMode,
  CourseLength,
  TeamMode,
  CreatePlayerInput,
  CreateCourseInput,
  HoleData,
  Tee,
} from "@/types";
import {
  DEFAULT_HANDICAP_INDEX,
  DEFAULT_SINDICATO_POINTS,
} from "@/types";

interface PlayerForm extends CreatePlayerInput {
  tempId: string;
  playingHandicap: number;
}

const GAME_MODES: { value: GameMode; label: string; description: string }[] = [
  {
    value: "stableford",
    label: "Stableford",
    description: "Puntos Stableford individual",
  },
  {
    value: "stroke",
    label: "Stroke Play",
    description: "Golpes totales",
  },
  {
    value: "sindicato",
    label: "Sindicato",
    description: "Puntos por posicion en cada hoyo",
  },
  {
    value: "team",
    label: "Equipos",
    description: "Best Ball o Good/Bad Ball",
  },
  {
    value: "matchplay",
    label: "Match Play",
    description: "1 vs 1, punto por hoyo ganado",
  },
];

const COURSE_LENGTHS: { value: CourseLength; label: string }[] = [
  { value: "18", label: "18 hoyos" },
  { value: "front9", label: "Primeros 9 (1-9)" },
  { value: "back9", label: "Ultimos 9 (10-18)" },
];

export function RoundSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: courses, isLoading: coursesLoading, refetch: refetchCourses } = useCourses();
  const { data: savedPlayers } = usePlayers();
  const createRound = useCreateRound();
  const createPlayer = useCreatePlayer();

  // Form state
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [gameMode, setGameMode] = useState<GameMode>("stableford");
  const [courseLength, setCourseLength] = useState<CourseLength>("18");
  const [useHandicap, setUseHandicap] = useState(true);
  const [handicapPercentage, setHandicapPercentage] = useState<100 | 75>(100);
  const [teamMode, setTeamMode] = useState<TeamMode>("bestBall");
  const [bestBallPoints, setBestBallPoints] = useState(1);
  const [worstBallPoints, setWorstBallPoints] = useState(1);
  const [sindicatoPoints, setSindicatoPoints] = useState<number[]>(
    DEFAULT_SINDICATO_POINTS
  );
  const [players, setPlayers] = useState<PlayerForm[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Image upload state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [extractedCourse, setExtractedCourse] = useState<CreateCourseInput | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [selectedTeeIndex, setSelectedTeeIndex] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Selected course
  const selectedCourse = useMemo(
    () => courses?.find((c: Course) => c.id === selectedCourseId),
    [courses, selectedCourseId]
  );

  // Calculate initial HDJ for a player (always calculate, even if useHandicap is false)
  const calculateInitialHDJ = (handicapIndex: number, teeName: string): number => {
    if (!selectedCourse) return 0;
    const tee = selectedCourse.tees.find((t) => t.name === teeName);
    if (!tee) return 0;
    // Always calculate the real HDJ - the useHandicap flag determines how it's used during play
    return calculatePlayingHandicap(handicapIndex, tee.slope, handicapPercentage);
  };

  // Handle paste from clipboard
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await handleImageFile(file);
          }
          break;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  // Handle image file (from upload, paste, or drag)
  const handleImageFile = async (file: File) => {
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Extract data
    setIsExtracting(true);
    setExtractError(null);
    setExtractedCourse(null);

    try {
      const response = await coursesApi.extractFromImage(file);
      // Transform snake_case from API to camelCase for frontend
      const courseData = response.course_data as unknown as Record<string, unknown>;
      const holesCount = courseData.holes as number;
      const transformedData: CreateCourseInput = {
        name: courseData.name as string,
        holes: (holesCount === 9 ? 9 : 18) as 9 | 18,
        par: courseData.par as number,
        tees: courseData.tees as Tee[],
        holesData: (courseData.holes_data || courseData.holesData) as HoleData[],
      };
      setExtractedCourse(transformedData);
      setShowReviewDialog(true);
    } catch (error) {
      console.error("Error extracting course data:", error);
      setExtractError(
        error instanceof Error ? error.message : "Error al procesar la imagen"
      );
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageFile(file);
    }
  };

  // Save extracted course with selected tee
  const handleSaveExtractedCourse = async () => {
    if (!extractedCourse) return;

    setIsSavingCourse(true);
    try {
      // Get selected tee for naming
      const selectedTee = extractedCourse.tees[selectedTeeIndex];
      const teeName = selectedTee?.name || "Standard";

      // Course name includes the tee name for differentiation
      const courseNameWithTee = `${extractedCourse.name} (${teeName})`;

      // Transform camelCase to snake_case for backend
      // Only save the selected tee
      const dataForBackend = {
        name: courseNameWithTee,
        holes: extractedCourse.holes,
        par: extractedCourse.par,
        tees: [selectedTee], // Only the selected tee
        holes_data: extractedCourse.holesData,
      };
      const savedCourse = await coursesApi.saveExtracted(dataForBackend as unknown as CreateCourseInput);
      await refetchCourses();
      setSelectedCourseId(savedCourse.id);
      setShowReviewDialog(false);
      setExtractedCourse(null);
      setPreviewImage(null);
      setSelectedTeeIndex(0);
    } catch (error) {
      console.error("Error saving course:", error);
      alert(error instanceof Error ? error.message : "Error al guardar el campo");
    } finally {
      setIsSavingCourse(false);
    }
  };

  // Update extracted course field
  const updateExtractedCourse = (field: keyof CreateCourseInput, value: unknown) => {
    if (!extractedCourse) return;
    setExtractedCourse({ ...extractedCourse, [field]: value });
  };

  // Update hole data
  const updateHoleData = (index: number, field: keyof HoleData, value: number) => {
    if (!extractedCourse) return;
    const newHolesData = [...extractedCourse.holesData];
    newHolesData[index] = { ...newHolesData[index], [field]: value };
    setExtractedCourse({ ...extractedCourse, holesData: newHolesData });
  };

  // Update tee data
  const updateTeeData = (index: number, field: keyof Tee, value: string | number) => {
    if (!extractedCourse) return;
    const newTees = [...extractedCourse.tees];
    newTees[index] = { ...newTees[index], [field]: value };
    setExtractedCourse({ ...extractedCourse, tees: newTees });
  };

  // Add current user as first player
  const addCurrentUser = () => {
    if (!user || !selectedCourse) return;

    const defaultTee = selectedCourse.tees[0]?.name || "Amarillas";
    const initialHDJ = calculateInitialHDJ(DEFAULT_HANDICAP_INDEX, defaultTee);

    setPlayers([
      {
        tempId: crypto.randomUUID(),
        name: user.displayName || user.email.split("@")[0],
        odHandicapIndex: DEFAULT_HANDICAP_INDEX,
        teeBox: defaultTee,
        team: gameMode === "team" ? "A" : undefined,
        playingHandicap: initialHDJ,
      },
    ]);
  };

  // Add new player
  const addPlayer = () => {
    if (!selectedCourse) return;

    const defaultTee = selectedCourse.tees[0]?.name || "Amarillas";
    const playerNumber = players.length + 1;
    const initialHDJ = calculateInitialHDJ(DEFAULT_HANDICAP_INDEX, defaultTee);

    setPlayers([
      ...players,
      {
        tempId: crypto.randomUUID(),
        name: `Jugador ${playerNumber}`,
        odHandicapIndex: DEFAULT_HANDICAP_INDEX,
        teeBox: defaultTee,
        team: gameMode === "team" ? (players.length % 2 === 0 ? "A" : "B") : undefined,
        playingHandicap: initialHDJ,
      },
    ]);
  };

  // Add saved player
  const addSavedPlayer = (savedPlayer: { name: string; handicapIndex: number; preferredTee?: string }) => {
    if (!selectedCourse) return;

    const preferredTee = savedPlayer.preferredTee;
    const defaultTee = selectedCourse.tees.find(t => t.name === preferredTee)?.name
      || selectedCourse.tees[0]?.name
      || "Amarillas";
    const initialHDJ = calculateInitialHDJ(savedPlayer.handicapIndex, defaultTee);

    setPlayers([
      ...players,
      {
        tempId: crypto.randomUUID(),
        name: savedPlayer.name,
        odHandicapIndex: savedPlayer.handicapIndex,
        teeBox: defaultTee,
        team: gameMode === "team" ? (players.length % 2 === 0 ? "A" : "B") : undefined,
        playingHandicap: initialHDJ,
      },
    ]);
  };

  // Check if a player is already saved
  const isPlayerSaved = (player: PlayerForm): boolean => {
    if (!savedPlayers || !player.name.trim()) return true;
    return savedPlayers.some(sp => sp.name.toLowerCase() === player.name.toLowerCase().trim());
  };

  // Save player to "Mis jugadores"
  const savePlayerToList = async (player: PlayerForm) => {
    if (!player.name.trim()) return;
    try {
      await createPlayer.mutateAsync({
        name: player.name.trim(),
        handicapIndex: player.odHandicapIndex,
        preferredTee: player.teeBox,
      });
    } catch (error) {
      console.error("Error saving player:", error);
    }
  };

  // Remove player
  const removePlayer = (tempId: string) => {
    setPlayers(players.filter((p) => p.tempId !== tempId));
  };

  // Update player field
  const updatePlayer = (
    tempId: string,
    field: keyof CreatePlayerInput | "playingHandicap",
    value: string | number
  ) => {
    setPlayers(
      players.map((p) => {
        if (p.tempId !== tempId) return p;

        const updated = { ...p, [field]: value };

        if (field === "odHandicapIndex" || field === "teeBox") {
          const newHDJ = calculateInitialHDJ(
            field === "odHandicapIndex" ? (value as number) : p.odHandicapIndex,
            field === "teeBox" ? (value as string) : p.teeBox
          );
          updated.playingHandicap = newHDJ;
        }

        return updated;
      })
    );
  };

  // Update HDJ directly (manual override)
  const updatePlayerHDJ = (tempId: string, hdj: number) => {
    setPlayers(
      players.map((p) =>
        p.tempId === tempId ? { ...p, playingHandicap: hdj } : p
      )
    );
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedCourse || players.length === 0) return;

    setIsSubmitting(true);

    try {
      const roundData = {
        course_id: selectedCourse.id,
        course_name: selectedCourse.name,
        round_date: new Date().toISOString().split("T")[0],
        course_length: courseLength,
        game_mode: gameMode,
        use_handicap: useHandicap,
        handicap_percentage: handicapPercentage,
        ...(gameMode === "sindicato" && { sindicato_points: sindicatoPoints }),
        ...(gameMode === "team" && {
          team_mode: teamMode,
          best_ball_points: bestBallPoints,
          worst_ball_points: teamMode === "goodBadBall" ? worstBallPoints : undefined,
        }),
        players: players.map(({ tempId, ...p }) => ({
          name: p.name,
          od_handicap_index: p.odHandicapIndex,
          tee_box: p.teeBox,
          team: p.team,
          playing_handicap: p.playingHandicap,
        })),
      };

      console.log("Creating round with data:", roundData);
      const newRound = await createRound.mutateAsync(roundData);
      navigate(`/round/play?id=${newRound.id}`);
    } catch (error) {
      console.error("Error creating round:", error);
      alert("Error al crear la partida. Revisa la consola para más detalles.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validation
  const canSubmit =
    selectedCourseId &&
    players.length > 0 &&
    players.every((p) => p.name.trim() !== "") &&
    (gameMode !== "team" || players.length >= 2) &&
    (gameMode !== "matchplay" || players.length === 2);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Nueva Partida</h1>
        <p className="text-muted-foreground">
          Configura tu partida de golf
        </p>
      </div>

      {/* Course Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Campo</CardTitle>
          <CardDescription>Selecciona un campo guardado o importa uno nuevo desde imagen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Saved courses selector */}
          <div className="space-y-2">
            <Label>Campos guardados</Label>
            <Select
              value={selectedCourseId}
              onValueChange={(value) => {
                setSelectedCourseId(value);
                setPlayers([]);
              }}
              disabled={coursesLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    coursesLoading ? "Cargando campos..." : "Selecciona un campo"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {courses
                  ?.slice()
                  .sort((a: Course, b: Course) => {
                    // Favorites first
                    if (a.isFavorite && !b.isFavorite) return -1;
                    if (!a.isFavorite && b.isFavorite) return 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map((course: Course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.isFavorite ? "★ " : ""}{course.name} ({course.holes}h, Par {course.par})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Image upload for new course */}
          <Separator />
          <div className="space-y-3">
            <Label>Importar campo desde tarjeta</Label>
            <p className="text-xs text-muted-foreground">
              Sube una foto de la tarjeta del campo o pegala con Ctrl+V
            </p>

            {/* Drop zone */}
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
                ${isExtracting ? "pointer-events-none opacity-50" : ""}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {isExtracting ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Analizando imagen con IA...</p>
                  <p className="text-xs text-muted-foreground">
                    Extrayendo datos de la tarjeta
                  </p>
                </div>
              ) : previewImage && !showReviewDialog ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="max-h-32 rounded-md object-contain"
                  />
                  <p className="text-xs text-muted-foreground">
                    Haz clic para subir otra imagen
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-4 text-muted-foreground">
                    <Upload className="h-8 w-8" />
                    <ClipboardPaste className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-medium">
                    Arrastra una imagen aqui o haz clic para subir
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tambien puedes pegar con Ctrl+V desde el portapapeles
                  </p>
                </div>
              )}
            </div>

            {/* Explicit action buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtracting}
              >
                <Upload className="h-4 w-4 mr-2" />
                Subir archivo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  try {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                      const imageType = item.types.find(type => type.startsWith("image/"));
                      if (imageType) {
                        const blob = await item.getType(imageType);
                        const file = new File([blob], "clipboard-image.png", { type: imageType });
                        await handleImageFile(file);
                        break;
                      }
                    }
                  } catch (error) {
                    console.error("Error reading clipboard:", error);
                    setExtractError("No se pudo leer la imagen del portapapeles. Prueba con Ctrl+V.");
                  }
                }}
                disabled={isExtracting}
              >
                <ClipboardPaste className="h-4 w-4 mr-2" />
                Pegar imagen
              </Button>
            </div>

            {extractError && (
              <p className="text-sm text-destructive">{extractError}</p>
            )}
          </div>

          {selectedCourse && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Recorrido</Label>
                <Select
                  value={courseLength}
                  onValueChange={(value) => setCourseLength(value as CourseLength)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COURSE_LENGTHS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedCourse.tees.map((tee) => (
                  <Badge key={tee.name} variant="outline">
                    {tee.name}: Slope {tee.slope}, Rating {tee.rating}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Game Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Modo de Juego</CardTitle>
          <CardDescription>Elige como quieres jugar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {GAME_MODES.map((mode) => (
              <Button
                key={mode.value}
                variant={gameMode === mode.value ? "default" : "outline"}
                className="h-auto py-3 flex flex-col items-start"
                onClick={() => setGameMode(mode.value)}
              >
                <span className="font-semibold">{mode.label}</span>
                <span className="text-xs opacity-80">{mode.description}</span>
              </Button>
            ))}
          </div>

          {/* Handicap settings */}
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Usar Handicap</Label>
              <p className="text-xs text-muted-foreground">
                Aplicar handicap a los resultados
              </p>
            </div>
            <Switch checked={useHandicap} onCheckedChange={setUseHandicap} />
          </div>

          {useHandicap && (
            <div className="space-y-2">
              <Label>Porcentaje de Handicap</Label>
              <div className="flex gap-2">
                <Button
                  variant={handicapPercentage === 100 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHandicapPercentage(100)}
                >
                  100%
                </Button>
                <Button
                  variant={handicapPercentage === 75 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHandicapPercentage(75)}
                >
                  75%
                </Button>
              </div>
            </div>
          )}

          {/* Sindicato settings */}
          {gameMode === "sindicato" && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Puntos por posicion</Label>
                <div className="grid grid-cols-4 gap-2">
                  {sindicatoPoints.map((points, index) => (
                    <div key={index} className="space-y-1">
                      <Label className="text-xs">{index + 1}o</Label>
                      <Input
                        type="number"
                        min={0}
                        value={points}
                        onChange={(e) => {
                          const newPoints = [...sindicatoPoints];
                          newPoints[index] = parseInt(e.target.value) || 0;
                          setSindicatoPoints(newPoints);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Team settings */}
          {gameMode === "team" && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Modo de Equipo</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={teamMode === "bestBall" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTeamMode("bestBall")}
                    >
                      Best Ball
                    </Button>
                    <Button
                      variant={teamMode === "goodBadBall" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTeamMode("goodBadBall")}
                    >
                      Good/Bad Ball
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Puntos Best Ball</Label>
                    <Input
                      type="number"
                      min={1}
                      value={bestBallPoints}
                      onChange={(e) =>
                        setBestBallPoints(parseInt(e.target.value) || 1)
                      }
                    />
                  </div>
                  {teamMode === "goodBadBall" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Puntos Worst Ball</Label>
                      <Input
                        type="number"
                        min={1}
                        value={worstBallPoints}
                        onChange={(e) =>
                          setWorstBallPoints(parseInt(e.target.value) || 1)
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Players */}
      <Card>
        <CardHeader>
          <CardTitle>Jugadores</CardTitle>
          <CardDescription>
            Añade los jugadores de la partida
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedCourse ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Selecciona un campo primero
            </p>
          ) : (
            <>
              {players.length === 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={addCurrentUser}
                >
                  + Añadirme como jugador
                </Button>
              )}

              {/* Saved players quick add */}
              {savedPlayers && savedPlayers.length > 0 && players.length < 4 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Añadir jugador guardado</Label>
                  <div className="flex flex-wrap gap-2">
                    {savedPlayers
                      .filter(sp => !players.some(p => p.name === sp.name))
                      .map(sp => (
                        <Button
                          key={sp.id}
                          variant="outline"
                          size="sm"
                          onClick={() => addSavedPlayer(sp)}
                          className="text-xs"
                        >
                          <UserPlus className="h-3 w-3 mr-1" />
                          {sp.name} ({sp.handicapIndex})
                        </Button>
                      ))}
                  </div>
                </div>
              )}

              {players.map((player, index) => (
                <div
                  key={player.tempId}
                  className="p-4 border rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Jugador {index + 1}</span>
                    {players.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePlayer(player.tempId)}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nombre</Label>
                      <Input
                        value={player.name}
                        onChange={(e) =>
                          updatePlayer(player.tempId, "name", e.target.value)
                        }
                        placeholder="Nombre del jugador"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Tee</Label>
                      <Select
                        value={player.teeBox}
                        onValueChange={(value) =>
                          updatePlayer(player.tempId, "teeBox", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedCourse.tees.map((tee) => (
                            <SelectItem key={tee.name} value={tee.name}>
                              {tee.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Handicap Index</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={player.odHandicapIndex === 0 ? "" : String(player.odHandicapIndex).replace(".", ",")}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          // Allow empty, digits, and one decimal separator
                          if (rawValue === "" || /^[0-9]*[.,]?[0-9]*$/.test(rawValue)) {
                            const normalized = rawValue.replace(",", ".");
                            if (normalized === "" || normalized === ".") {
                              updatePlayer(player.tempId, "odHandicapIndex", 0);
                            } else {
                              const num = parseFloat(normalized);
                              if (!isNaN(num) && num >= 0 && num <= 54) {
                                updatePlayer(player.tempId, "odHandicapIndex", num);
                              }
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.replace(",", ".");
                          if (value === "" || value === ".") {
                            updatePlayer(player.tempId, "odHandicapIndex", 0);
                          }
                        }}
                        placeholder="0,0"
                      />
                    </div>

                    {useHandicap && (
                      <div className="space-y-1">
                        <Label className="text-xs">HDJ (Handicap de Juego)</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={player.playingHandicap === 0 ? "" : String(player.playingHandicap)}
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            if (rawValue === "" || /^[0-9]*$/.test(rawValue)) {
                              const num = rawValue === "" ? 0 : parseInt(rawValue, 10);
                              if (!isNaN(num) && num >= 0 && num <= 54) {
                                updatePlayerHDJ(player.tempId, num);
                              }
                            }
                          }}
                          className="font-semibold"
                          placeholder="0"
                        />
                      </div>
                    )}

                    {gameMode === "team" && (
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Equipo</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={player.team === "A" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() =>
                              updatePlayer(player.tempId, "team", "A")
                            }
                          >
                            Equipo A
                          </Button>
                          <Button
                            type="button"
                            variant={player.team === "B" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() =>
                              updatePlayer(player.tempId, "team", "B")
                            }
                          >
                            Equipo B
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Save player button - only show if not already saved */}
                  {!isPlayerSaved(player) && player.name.trim() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => savePlayerToList(player)}
                      disabled={createPlayer.isPending}
                    >
                      {createPlayer.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Guardar en mis jugadores
                    </Button>
                  )}
                </div>
              ))}

              {players.length > 0 && players.length < 4 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={addPlayer}
                >
                  + Añadir jugador
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => navigate("/")}
        >
          Cancelar
        </Button>
        <Button
          className="flex-1"
          disabled={!canSubmit || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "Creando..." : "Empezar Partida"}
        </Button>
      </div>

      {/* Review Extracted Course Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Revisar datos extraidos
            </DialogTitle>
            <DialogDescription>
              Verifica y edita los datos extraidos de la tarjeta antes de guardar
            </DialogDescription>
          </DialogHeader>

          {extractedCourse && (
            <div className="space-y-6">
              {/* Course name */}
              <div className="space-y-2">
                <Label>Nombre del campo</Label>
                <Input
                  value={extractedCourse.name}
                  onChange={(e) => updateExtractedCourse("name", e.target.value)}
                />
              </div>

              {/* Basic info */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Hoyos</Label>
                  <Select
                    value={String(extractedCourse.holes)}
                    onValueChange={(v) => updateExtractedCourse("holes", parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9">9 hoyos</SelectItem>
                      <SelectItem value="18">18 hoyos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Par total</Label>
                  <Input
                    type="number"
                    value={extractedCourse.par}
                    onChange={(e) => updateExtractedCourse("par", parseInt(e.target.value) || 72)}
                  />
                </div>
              </div>

              {/* Tees - Select which one to use */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Barras de salida detectadas ({extractedCourse.tees.length})</Label>
                  {extractedCourse.tees.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      Selecciona la barra a guardar
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {extractedCourse.tees.map((tee, i) => (
                    <div
                      key={i}
                      className={`grid grid-cols-4 gap-2 p-2 rounded cursor-pointer border-2 transition-colors ${
                        selectedTeeIndex === i
                          ? "border-primary bg-primary/10"
                          : "border-transparent bg-muted/50 hover:bg-muted"
                      }`}
                      onClick={() => setSelectedTeeIndex(i)}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={selectedTeeIndex === i}
                          onChange={() => setSelectedTeeIndex(i)}
                          className="h-4 w-4"
                        />
                        <Input
                          placeholder="Nombre"
                          value={tee.name}
                          onChange={(e) => updateTeeData(i, "name", e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs w-12">Slope</Label>
                        <Input
                          type="number"
                          value={tee.slope}
                          onChange={(e) => updateTeeData(i, "slope", parseInt(e.target.value) || 113)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs w-12">Rating</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={tee.rating}
                          onChange={(e) => updateTeeData(i, "rating", parseFloat(e.target.value) || 72)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      {selectedTeeIndex === i && (
                        <Badge className="h-6 self-center">Seleccionada</Badge>
                      )}
                    </div>
                  ))}
                </div>
                {extractedCourse.tees.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    El campo se guardara como "{extractedCourse.name} ({extractedCourse.tees[selectedTeeIndex]?.name})"
                  </p>
                )}
              </div>

              {/* Holes data */}
              <div className="space-y-3">
                <Label>Datos por hoyo</Label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Hoyo</th>
                        <th className="p-2 text-center">Par</th>
                        <th className="p-2 text-center">HCP</th>
                        <th className="p-2 text-center">Dist (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedCourse.holesData.map((hole, i) => {
                        // Get distance for selected tee, fallback to default distance
                        const selectedTeeName = extractedCourse.tees[selectedTeeIndex]?.name;
                        let displayDistance = hole.distance;
                        if (hole.distances && selectedTeeName) {
                          // Try exact match first
                          if (hole.distances[selectedTeeName] !== undefined) {
                            displayDistance = hole.distances[selectedTeeName];
                          } else {
                            // Try case-insensitive match
                            const normalizedSelected = selectedTeeName.toLowerCase().trim();
                            const matchingKey = Object.keys(hole.distances).find(
                              key => key.toLowerCase().trim() === normalizedSelected
                            );
                            if (matchingKey) {
                              displayDistance = hole.distances[matchingKey];
                            }
                          }
                        }
                        return (
                          <tr key={i} className="border-t">
                            <td className="p-2 font-medium">{hole.number}</td>
                            <td className="p-1">
                              <Select
                                value={String(hole.par)}
                                onValueChange={(v) => updateHoleData(i, "par", parseInt(v) as 3 | 4 | 5)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="3">3</SelectItem>
                                  <SelectItem value="4">4</SelectItem>
                                  <SelectItem value="5">5</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                className="h-8 text-center"
                                value={hole.handicap}
                                onChange={(e) => updateHoleData(i, "handicap", parseInt(e.target.value) || 1)}
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                className="h-8 text-center bg-muted/50"
                                value={displayDistance}
                                readOnly
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowReviewDialog(false);
                setExtractedCourse(null);
                setPreviewImage(null);
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSaveExtractedCourse}
              disabled={isSavingCourse}
            >
              {isSavingCourse ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Guardar campo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
