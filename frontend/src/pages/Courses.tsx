import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCourses, useDeleteCourse, useUpdateCourse } from "@/hooks/useCourses";
import { coursesApi } from "@/lib/api";
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
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Trash2,
  MapPin,
  ChevronDown,
  ChevronUp,
  Star,
  Edit,
  Calendar,
  Ruler,
  Flag,
  Target,
  AlertTriangle,
  History,
  ExternalLink,
} from "lucide-react";
import type { Course, HoleData, Tee } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type CourseRound = {
  id: string;
  round_date: string;
  players: Array<{ name: string; scores: Record<string, { strokes: number }> }>;
  is_finished: boolean;
  course_length: string;
  game_mode: string;
};

export function Courses() {
  const navigate = useNavigate();
  const { data: courses, isLoading } = useCourses();
  const deleteCourse = useDeleteCourse();
  const updateCourse = useUpdateCourse();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteRoundsCount, setDeleteRoundsCount] = useState<number>(0);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    tees: Tee[];
  }>({ name: "", tees: [] });
  const [courseRounds, setCourseRounds] = useState<Record<string, CourseRound[]>>({});
  const [loadingRounds, setLoadingRounds] = useState<string | null>(null);

  // When delete dialog opens, fetch rounds count
  useEffect(() => {
    if (deleteId) {
      coursesApi.getRoundsCount(deleteId).then(setDeleteRoundsCount).catch(() => setDeleteRoundsCount(0));
    }
  }, [deleteId]);

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCourse.mutateAsync(deleteId);
      setDeleteId(null);
      setDeleteRoundsCount(0);
    }
  };

  const toggleExpand = async (courseId: string) => {
    if (expandedCourse === courseId) {
      setExpandedCourse(null);
    } else {
      setExpandedCourse(courseId);
      // Load rounds if not already loaded
      if (!courseRounds[courseId]) {
        setLoadingRounds(courseId);
        try {
          const rounds = await coursesApi.getRounds(courseId);
          setCourseRounds(prev => ({ ...prev, [courseId]: rounds }));
        } catch (error) {
          console.error("Error loading rounds:", error);
        } finally {
          setLoadingRounds(null);
        }
      }
    }
  };

  const toggleFavorite = async (course: Course) => {
    await updateCourse.mutateAsync({
      id: course.id,
      data: { is_favorite: !course.isFavorite },
    });
  };

  const openEditSheet = (course: Course) => {
    setEditingCourse(course);
    setEditForm({
      name: course.name,
      tees: [...course.tees],
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCourse) return;

    await updateCourse.mutateAsync({
      id: editingCourse.id,
      data: {
        name: editForm.name,
        tees: editForm.tees,
      },
    });
    setEditingCourse(null);
  };

  const updateTee = (index: number, field: keyof Tee, value: string | number) => {
    const newTees = [...editForm.tees];
    newTees[index] = { ...newTees[index], [field]: value };
    setEditForm({ ...editForm, tees: newTees });
  };

  const addTee = () => {
    setEditForm({
      ...editForm,
      tees: [...editForm.tees, { name: "Nuevo Tee", slope: 113, rating: 72.0 }],
    });
  };

  const removeTee = (index: number) => {
    const newTees = editForm.tees.filter((_, i) => i !== index);
    setEditForm({ ...editForm, tees: newTees });
  };

  // Filter and sort courses - favorites first, then alphabetically
  const filteredCourses = courses
    ?.filter((course: Course) =>
      course.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a: Course, b: Course) => {
      // Favorites first
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      // Then alphabetically
      return a.name.localeCompare(b.name);
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Campos de Golf</h1>
        <p className="text-muted-foreground">
          Gestiona los campos guardados en tu cuenta
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar campo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Stats summary */}
      {courses && courses.length > 0 && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{courses.length} campos</span>
          <span>•</span>
          <span>{courses.filter((c: Course) => c.isFavorite).length} favoritos</span>
        </div>
      )}

      {filteredCourses && filteredCourses.length > 0 ? (
        <div className="grid gap-4">
          {filteredCourses.map((course: Course) => (
            <Card key={course.id} className={course.isFavorite ? "border-yellow-400/50" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{course.name}</CardTitle>
                      {course.isFavorite && (
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      )}
                    </div>
                    <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="outline">{course.holes} hoyos</Badge>
                      <Badge variant="outline">Par {course.par}</Badge>
                      <span className="text-xs">
                        {course.tees.length} tee{course.tees.length > 1 ? "s" : ""}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFavorite(course)}
                      title={course.isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          course.isFavorite
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditSheet(course)}
                      title="Editar campo"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleExpand(course.id)}
                      title="Ver detalles"
                    >
                      {expandedCourse === course.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(course.id)}
                      title="Eliminar campo"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Expanded details */}
              {expandedCourse === course.id && (
                <CardContent className="space-y-4">
                  {/* Course info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-muted-foreground">Hoyos</div>
                        <div className="font-medium">{course.holes}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-muted-foreground">Par</div>
                        <div className="font-medium">{course.par}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-muted-foreground">Distancia</div>
                        <div className="font-medium">
                          {course.holesData.reduce((sum: number, h: HoleData) => sum + h.distance, 0)}m
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-muted-foreground">Añadido</div>
                        <div className="font-medium">
                          {format(new Date(course.createdAt), "dd MMM yyyy", { locale: es })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Tees info */}
                  <div>
                    <h4 className="font-medium mb-2">Tees disponibles</h4>
                    <div className="flex flex-wrap gap-2">
                      {course.tees.map((tee, i) => (
                        <div
                          key={i}
                          className="px-3 py-2 rounded-lg bg-muted text-sm"
                        >
                          <div className="font-medium">{tee.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Slope: {tee.slope} • Rating: {tee.rating}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Rounds played */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Rondas jugadas
                    </h4>
                    {loadingRounds === course.id ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      </div>
                    ) : courseRounds[course.id]?.length > 0 ? (
                      <div className="border rounded-lg divide-y">
                        {courseRounds[course.id].map((round) => {
                          const player = round.players[0];
                          const totalStrokes = player?.scores
                            ? Object.values(player.scores).reduce((sum, s) => sum + s.strokes, 0)
                            : 0;
                          return (
                            <div
                              key={round.id}
                              className="p-3 flex items-center justify-between hover:bg-muted/50 cursor-pointer"
                              onClick={() => navigate(`/round/${round.id}`)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {format(new Date(round.round_date), "dd MMM yyyy", { locale: es })}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {round.game_mode === "stableford" ? "Stableford" :
                                     round.game_mode === "stroke" ? "Stroke Play" :
                                     round.game_mode === "sindicato" ? "Sindicato" :
                                     round.game_mode === "matchplay" ? "Match Play" : round.game_mode}
                                    {round.course_length !== "18" && ` • ${round.course_length === "front9" ? "1-9" : "10-18"}`}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {totalStrokes > 0 && (
                                  <Badge variant="outline">{totalStrokes} golpes</Badge>
                                )}
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">
                        No hay rondas jugadas en este campo
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Holes table */}
                  <div>
                    <h4 className="font-medium mb-2">Datos de hoyos</h4>
                    <div className="border rounded-lg overflow-x-auto">
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
                          {course.holesData
                            .slice()
                            .sort((a: HoleData, b: HoleData) => a.number - b.number)
                            .map((hole: HoleData) => (
                              <tr key={hole.number} className="border-t">
                                <td className="p-2 font-medium">{hole.number}</td>
                                <td className="p-2 text-center">
                                  <Badge
                                    variant={
                                      hole.par === 3
                                        ? "secondary"
                                        : hole.par === 5
                                        ? "default"
                                        : "outline"
                                    }
                                  >
                                    {hole.par}
                                  </Badge>
                                </td>
                                <td className="p-2 text-center">{hole.handicap}</td>
                                <td className="p-2 text-center">{hole.distance}</td>
                              </tr>
                            ))}
                          <tr className="border-t bg-muted font-semibold">
                            <td className="p-2">Total</td>
                            <td className="p-2 text-center">{course.par}</td>
                            <td className="p-2 text-center">-</td>
                            <td className="p-2 text-center">
                              {course.holesData.reduce(
                                (sum: number, h: HoleData) => sum + h.distance,
                                0
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? "No se encontraron campos" : "Sin campos guardados"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? "Prueba con otro termino de busqueda"
                : "Puedes importar campos desde una imagen de tarjeta en Nueva Partida"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar campo</DialogTitle>
            <DialogDescription>
              {deleteRoundsCount > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Atencion</span>
                  </div>
                  <p>
                    Este campo tiene <strong>{deleteRoundsCount} ronda{deleteRoundsCount > 1 ? "s" : ""}</strong> asociada{deleteRoundsCount > 1 ? "s" : ""}.
                    Si lo eliminas, las rondas quedaran huerfanas.
                  </p>
                </div>
              ) : (
                <p>¿Estas seguro que deseas eliminar este campo? Esta accion no se puede deshacer.</p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteCourse.isPending}
            >
              {deleteCourse.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit course sheet */}
      <Sheet open={!!editingCourse} onOpenChange={(open: boolean) => !open && setEditingCourse(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar Campo</SheetTitle>
            <SheetDescription>
              Modifica los datos del campo
            </SheetDescription>
          </SheetHeader>

          {editingCourse && (
            <div className="space-y-6 mt-6">
              {/* Name */}
              <div className="space-y-2">
                <Label>Nombre del campo</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <Separator />

              {/* Tees */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Tees</Label>
                  <Button variant="outline" size="sm" onClick={addTee}>
                    + Añadir Tee
                  </Button>
                </div>

                {editForm.tees.map((tee, index) => (
                  <div key={index} className="space-y-2 p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Tee {index + 1}</Label>
                      {editForm.tees.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeTee(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="Nombre (ej: Blancas)"
                      value={tee.name}
                      onChange={(e) => updateTee(index, "name", e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Slope</Label>
                        <Input
                          type="number"
                          min={55}
                          max={155}
                          value={tee.slope}
                          onChange={(e) => updateTee(index, "slope", parseInt(e.target.value) || 113)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Rating</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={tee.rating}
                          onChange={(e) => updateTee(index, "rating", parseFloat(e.target.value) || 72)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Course stats (read-only) */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Informacion del campo</Label>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Hoyos:</span>{" "}
                    <span className="font-medium">{editingCourse.holes}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Par:</span>{" "}
                    <span className="font-medium">{editingCourse.par}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Distancia:</span>{" "}
                    <span className="font-medium">
                      {editingCourse.holesData.reduce((sum, h) => sum + h.distance, 0)}m
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Creado:</span>{" "}
                    <span className="font-medium">
                      {format(new Date(editingCourse.createdAt), "dd/MM/yyyy", { locale: es })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Save button */}
              <Button
                className="w-full"
                onClick={handleSaveEdit}
                disabled={updateCourse.isPending}
              >
                {updateCourse.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
