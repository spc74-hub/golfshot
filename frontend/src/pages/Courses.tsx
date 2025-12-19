import { useState } from "react";
import { useCourses, useDeleteCourse } from "@/hooks/useCourses";
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
import { Input } from "@/components/ui/input";
import { Trash2, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import type { Course, HoleData } from "@/types";

export function Courses() {
  const { data: courses, isLoading } = useCourses();
  const deleteCourse = useDeleteCourse();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCourse.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const toggleExpand = (courseId: string) => {
    setExpandedCourse(expandedCourse === courseId ? null : courseId);
  };

  // Filter courses by search term
  const filteredCourses = courses?.filter((course: Course) =>
    course.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      {filteredCourses && filteredCourses.length > 0 ? (
        <div className="grid gap-4">
          {filteredCourses.map((course: Course) => (
            <Card key={course.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{course.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{course.holes} hoyos</Badge>
                      <Badge variant="outline">Par {course.par}</Badge>
                      {course.tees.map((tee, i) => (
                        <Badge key={i} variant="secondary">
                          {tee.name} (S:{tee.slope} R:{tee.rating})
                        </Badge>
                      ))}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(course.id)}
                    >
                      {expandedCourse === course.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Dialog
                      open={deleteId === course.id}
                      onOpenChange={(open) => !open && setDeleteId(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(course.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Eliminar campo</DialogTitle>
                          <DialogDescription>
                            ¿Estas seguro que deseas eliminar "{course.name}"?
                            Esta accion no se puede deshacer.
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
                  </div>
                </div>
              </CardHeader>

              {/* Expanded details */}
              {expandedCourse === course.id && (
                <CardContent>
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
                        {course.holesData.map((hole: HoleData) => (
                          <tr key={hole.number} className="border-t">
                            <td className="p-2 font-medium">{hole.number}</td>
                            <td className="p-2 text-center">{hole.par}</td>
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
    </div>
  );
}
