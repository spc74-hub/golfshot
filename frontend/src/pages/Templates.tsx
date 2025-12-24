import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useToggleTemplateFavorite,
} from "@/hooks/useTemplates";
import { useCourses } from "@/hooks/useCourses";
import { usePlayers } from "@/hooks/usePlayers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  Play,
  Zap,
  Users,
  MapPin,
} from "lucide-react";
import type {
  RoundTemplate,
  CreateRoundTemplateInput,
  GameMode,
  CourseLength,
  TeamMode,
} from "@/types";

const GAME_MODE_LABELS: Record<GameMode, string> = {
  stableford: "Stableford",
  stroke: "Stroke Play",
  sindicato: "Sindicato",
  team: "Equipos",
  matchplay: "Match Play",
};

const COURSE_LENGTH_LABELS: Record<CourseLength, string> = {
  "18": "18 hoyos",
  front9: "Primeros 9",
  back9: "Ultimos 9",
};

interface TemplateFormData {
  name: string;
  courseId: string;
  courseName: string;
  courseLength: CourseLength | "";
  gameMode: GameMode;
  useHandicap: boolean;
  handicapPercentage: 100 | 75;
  teamMode: TeamMode | "";
  playerIds: string[];
  defaultTee: string;
}

const INITIAL_FORM: TemplateFormData = {
  name: "",
  courseId: "",
  courseName: "",
  courseLength: "",
  gameMode: "stableford",
  useHandicap: true,
  handicapPercentage: 100,
  teamMode: "",
  playerIds: [],
  defaultTee: "",
};

export function Templates() {
  const navigate = useNavigate();
  const { data: templates, isLoading } = useTemplates();
  const { data: courses } = useCourses();
  const { data: players } = usePlayers();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const toggleFavorite = useToggleTemplateFavorite();

  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RoundTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(INITIAL_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormData(INITIAL_FORM);
    setShowDialog(true);
  };

  const openEditDialog = (template: RoundTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      courseId: template.courseId || "",
      courseName: template.courseName || "",
      courseLength: template.courseLength || "",
      gameMode: template.gameMode,
      useHandicap: template.useHandicap,
      handicapPercentage: template.handicapPercentage,
      teamMode: template.teamMode || "",
      playerIds: template.playerIds || [],
      defaultTee: template.defaultTee || "",
    });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    const selectedCourse = courses?.find((c) => c.id === formData.courseId);

    const templateData: CreateRoundTemplateInput = {
      name: formData.name.trim(),
      courseId: formData.courseId || undefined,
      courseName: selectedCourse?.name || formData.courseName || undefined,
      courseLength: formData.courseLength || undefined,
      gameMode: formData.gameMode,
      useHandicap: formData.useHandicap,
      handicapPercentage: formData.handicapPercentage,
      teamMode: formData.teamMode || undefined,
      playerIds: formData.playerIds,
      defaultTee: formData.defaultTee || undefined,
    };

    if (editingTemplate) {
      await updateTemplate.mutateAsync({
        id: editingTemplate.id,
        template: templateData,
      });
    } else {
      await createTemplate.mutateAsync(templateData);
    }

    setShowDialog(false);
    setFormData(INITIAL_FORM);
    setEditingTemplate(null);
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const handleUseTemplate = (template: RoundTemplate) => {
    // Navigate to RoundSetup with template data as query params
    const params = new URLSearchParams();
    params.set("templateId", template.id);
    navigate(`/round/setup?${params.toString()}`);
  };

  const isFormValid = formData.name.trim().length > 0;

  const selectedCourse = courses?.find((c) => c.id === formData.courseId);

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
          <h1 className="text-2xl font-bold">Plantillas de Partida</h1>
          <p className="text-muted-foreground">
            Crea accesos rapidos con tu configuracion favorita
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Plantilla
        </Button>
      </div>

      {templates && templates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="relative">
              {template.isFavorite && (
                <Star className="absolute top-3 right-3 h-5 w-5 text-yellow-500 fill-yellow-500" />
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  {template.name}
                </CardTitle>
                <CardDescription>
                  {GAME_MODE_LABELS[template.gameMode]}
                  {template.courseLength && ` • ${COURSE_LENGTH_LABELS[template.courseLength]}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {template.courseName && (
                    <Badge variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      {template.courseName}
                    </Badge>
                  )}
                  {template.playerIds.length > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      {template.playerIds.length} jugadores
                    </Badge>
                  )}
                  {!template.useHandicap && (
                    <Badge variant="secondary">Sin HDJ</Badge>
                  )}
                  {template.handicapPercentage === 75 && (
                    <Badge variant="secondary">75% HDJ</Badge>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleUseTemplate(template)}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Usar
                  </Button>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFavorite.mutate(template.id)}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          template.isFavorite
                            ? "text-yellow-500 fill-yellow-500"
                            : "text-muted-foreground"
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirm(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin plantillas</h3>
            <p className="text-muted-foreground mb-4">
              Crea una plantilla para iniciar partidas rapidamente con tu configuracion favorita
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primera plantilla
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Modifica la configuracion de la plantilla"
                : "Configura los valores predeterminados para tus partidas"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la plantilla *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Partida con amigos"
              />
            </div>

            <div className="space-y-2">
              <Label>Campo (opcional)</Label>
              <Select
                value={formData.courseId || "__none__"}
                onValueChange={(value) =>
                  setFormData({ ...formData, courseId: value === "__none__" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin campo predefinido</SelectItem>
                  {courses?.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Hoyos</Label>
              <Select
                value={formData.courseLength || "__none__"}
                onValueChange={(value) =>
                  setFormData({ ...formData, courseLength: value === "__none__" ? "" : value as CourseLength })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin definir</SelectItem>
                  <SelectItem value="18">18 hoyos</SelectItem>
                  <SelectItem value="front9">Primeros 9</SelectItem>
                  <SelectItem value="back9">Ultimos 9</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Modo de juego *</Label>
              <Select
                value={formData.gameMode}
                onValueChange={(value) =>
                  setFormData({ ...formData, gameMode: value as GameMode })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stableford">Stableford</SelectItem>
                  <SelectItem value="stroke">Stroke Play</SelectItem>
                  <SelectItem value="sindicato">Sindicato</SelectItem>
                  <SelectItem value="team">Equipos</SelectItem>
                  <SelectItem value="matchplay">Match Play</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.gameMode === "team" && (
              <div className="space-y-2">
                <Label>Tipo de equipo</Label>
                <Select
                  value={formData.teamMode}
                  onValueChange={(value) =>
                    setFormData({ ...formData, teamMode: value as TeamMode | "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bestBall">Best Ball</SelectItem>
                    <SelectItem value="goodBadBall">Good/Bad Ball</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="useHandicap">Usar Handicap</Label>
              <Switch
                id="useHandicap"
                checked={formData.useHandicap}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, useHandicap: checked })
                }
              />
            </div>

            {formData.useHandicap && (
              <div className="space-y-2">
                <Label>Porcentaje de Handicap</Label>
                <Select
                  value={String(formData.handicapPercentage)}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      handicapPercentage: parseInt(value) as 100 | 75,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100%</SelectItem>
                    <SelectItem value="75">75%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {players && players.length > 0 && (
              <div className="space-y-2">
                <Label>Jugadores predefinidos</Label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px]">
                  {players.map((player) => {
                    const isSelected = formData.playerIds.includes(player.id);
                    return (
                      <Badge
                        key={player.id}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            playerIds: isSelected
                              ? formData.playerIds.filter((id) => id !== player.id)
                              : [...formData.playerIds, player.id],
                          });
                        }}
                      >
                        {player.name}
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Haz clic para seleccionar/deseleccionar jugadores
                </p>
              </div>
            )}

            {selectedCourse && selectedCourse.tees.length > 0 && (
              <div className="space-y-2">
                <Label>Tee predeterminado</Label>
                <Select
                  value={formData.defaultTee || "__none__"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, defaultTee: value === "__none__" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin definir</SelectItem>
                    {selectedCourse.tees.map((tee) => (
                      <SelectItem key={tee.name} value={tee.name}>
                        {tee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || createTemplate.isPending || updateTemplate.isPending}
            >
              {createTemplate.isPending || updateTemplate.isPending
                ? "Guardando..."
                : editingTemplate
                ? "Guardar cambios"
                : "Crear plantilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar plantilla</DialogTitle>
            <DialogDescription>
              ¿Estas seguro que deseas eliminar esta plantilla? Esta accion no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deleteTemplate.isPending}
            >
              {deleteTemplate.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
