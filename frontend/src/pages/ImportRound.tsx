import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { roundsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, ImageIcon, Check, X, ArrowLeft, Loader2, Clipboard } from "lucide-react";
import type { ImportedRoundData } from "@/types";

export function ImportRound() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedData, setExtractedData] = useState<ImportedRoundData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setExtractedData(null);
      setError(null);
    }
  };

  const handlePaste = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "pasted-image.png", { type: imageType });
          setSelectedFile(file);
          setPreviewUrl(URL.createObjectURL(blob));
          setExtractedData(null);
          setError(null);
          return;
        }
      }
      setError("No hay imagen en el portapapeles");
    } catch (err) {
      setError("No se pudo acceder al portapapeles. Intenta con Ctrl+V o Cmd+V");
    }
  };

  // Handle paste event on the page
  useEffect(() => {
    const handlePasteEvent = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            const file = new File([blob], "pasted-image.png", { type: item.type });
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(blob));
            setExtractedData(null);
            setError(null);
          }
          return;
        }
      }
    };

    document.addEventListener("paste", handlePasteEvent);
    return () => document.removeEventListener("paste", handlePasteEvent);
  }, []);

  const handleExtract = async () => {
    if (!selectedFile) return;

    setIsExtracting(true);
    setError(null);

    try {
      const result = await roundsApi.extractFromImage(selectedFile);
      setExtractedData(result.round_data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al extraer datos de la imagen");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extractedData) return;

    setIsSaving(true);
    setError(null);

    try {
      await roundsApi.saveImported(extractedData);
      navigate("/history");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la ronda");
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate("/history");
  };

  const updateExtractedData = (field: string, value: string | number) => {
    if (!extractedData) return;

    const updated = { ...extractedData };
    const keys = field.split(".");

    if (keys[0] === "course" && keys[1]) {
      if (keys[1] === "tee_played" && keys[2]) {
        updated.course = {
          ...updated.course,
          tee_played: {
            ...updated.course.tee_played,
            [keys[2]]: value,
          },
        };
      } else {
        updated.course = { ...updated.course, [keys[1]]: value };
      }
    } else if (keys[0] === "round" && keys[1]) {
      updated.round = { ...updated.round, [keys[1]]: value };
    }

    setExtractedData(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Importar Ronda</h1>
          <p className="text-muted-foreground">
            Sube una imagen de tu tarjeta de puntuacion
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-destructive">
              <X className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Seleccionar Imagen</CardTitle>
          <CardDescription>
            Sube o pega una captura de pantalla de tu tarjeta de puntuacion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <div className="space-y-4">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-64 mx-auto rounded-lg"
                />
                <p className="text-sm text-muted-foreground">
                  Click para cambiar imagen
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  Click para seleccionar o usa Ctrl+V / Cmd+V para pegar
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG o WEBP
                </p>
              </div>
            )}
          </div>
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePaste}
              className="flex-1"
            >
              <Clipboard className="h-4 w-4 mr-2" />
              Pegar del portapapeles
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Seleccionar archivo
            </Button>
          </div>

          {selectedFile && !extractedData && (
            <Button
              onClick={handleExtract}
              disabled={isExtracting}
              className="w-full"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analizando imagen...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Extraer datos
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Extracted Data Preview */}
      {extractedData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Revisar Datos</CardTitle>
              <CardDescription>
                Verifica y edita los datos extraidos antes de guardar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Course Info */}
              <div className="space-y-4">
                <h3 className="font-semibold">Campo</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      value={extractedData.course.name}
                      onChange={(e) => updateExtractedData("course.name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ubicacion</Label>
                    <Input
                      value={extractedData.course.location}
                      onChange={(e) => updateExtractedData("course.location", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tee</Label>
                    <Input
                      value={extractedData.course.tee_played.name}
                      onChange={(e) => updateExtractedData("course.tee_played.name", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Slope</Label>
                      <Input
                        type="number"
                        value={extractedData.course.tee_played.slope}
                        onChange={(e) => updateExtractedData("course.tee_played.slope", parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rating</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={extractedData.course.tee_played.rating}
                        onChange={(e) => updateExtractedData("course.tee_played.rating", parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Round Info */}
              <div className="space-y-4">
                <h3 className="font-semibold">Ronda</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={extractedData.round.date}
                      onChange={(e) => updateExtractedData("round.date", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Jugador</Label>
                    <Input
                      value={extractedData.round.player_name}
                      onChange={(e) => updateExtractedData("round.player_name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Handicap</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={extractedData.round.handicap_index}
                      onChange={(e) => updateExtractedData("round.handicap_index", parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-lg px-4 py-2">
                  Golpes: {extractedData.totals.strokes}
                </Badge>
                <Badge variant="outline" className="text-lg px-4 py-2">
                  Par: {extractedData.totals.par}
                </Badge>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  {extractedData.totals.strokes > extractedData.totals.par
                    ? `+${extractedData.totals.strokes - extractedData.totals.par}`
                    : extractedData.totals.strokes - extractedData.totals.par}
                </Badge>
              </div>

              {/* Holes Data */}
              <div className="space-y-4">
                <h3 className="font-semibold">Puntuacion por Hoyo</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Hoyo</TableHead>
                        <TableHead className="w-16">Par</TableHead>
                        <TableHead className="w-16">Hcp</TableHead>
                        <TableHead className="w-20">Golpes</TableHead>
                        <TableHead className="w-16">+/-</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extractedData.holes_data.map((hole) => {
                        const diff = hole.strokes - hole.par;
                        return (
                          <TableRow key={hole.number}>
                            <TableCell className="font-medium">{hole.number}</TableCell>
                            <TableCell>{hole.par}</TableCell>
                            <TableCell>{hole.handicap}</TableCell>
                            <TableCell className="font-bold">{hole.strokes}</TableCell>
                            <TableCell>
                              <span
                                className={
                                  diff < 0
                                    ? "text-red-500 font-bold"
                                    : diff === 0
                                    ? "text-blue-500"
                                    : diff === 1
                                    ? "text-green-500"
                                    : "text-gray-500"
                                }
                              >
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Guardar Ronda
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
