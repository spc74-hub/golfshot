import { useState, useMemo } from "react";
import { useUserStats, useUserStatsFiltered, useStatsComparison } from "@/hooks/useStats";
import { useRounds } from "@/hooks/useRounds";
import {
  useHandicapHistory,
  useCreateHandicapHistory,
  useUpdateHandicapHistory,
  useDeleteHandicapHistory,
} from "@/hooks/useHandicapHistory";
import type { StatsPeriod, StatsFilters } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  TrendingUp,
  Award,
  BarChart3,
  Flag,
  Calendar,
  MapPin,
  User,
  Plus,
  Pencil,
  Trash2,
  History,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
} from "lucide-react";
import { format, parseISO, subMonths, subYears, isAfter } from "date-fns";
import type { HandicapHistory } from "@/types";
import { es } from "date-fns/locale";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from "recharts";

type TimeRange = "3m" | "6m" | "1y" | "all";

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

type HolesFilter = "all" | "9" | "18";

// Get current year and previous years for year filter
const currentYear = new Date().getFullYear();
const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

export function Stats() {
  const { data: rounds } = useRounds();
  const { data: handicapHistory, isLoading: hiLoading } = useHandicapHistory();
  const createHI = useCreateHandicapHistory();
  const updateHI = useUpdateHandicapHistory();
  const deleteHI = useDeleteHandicapHistory();

  // Global filter state
  const [globalPeriod, setGlobalPeriod] = useState<StatsPeriod | "year">("all");
  const [globalYear, setGlobalYear] = useState<number | undefined>(undefined);
  const [showComparison, setShowComparison] = useState(false);
  const [comparePeriod, setComparePeriod] = useState<StatsPeriod>("1y");

  // Build filters object
  const filters: StatsFilters = useMemo(() => {
    if (globalPeriod === "year" && globalYear) {
      return { year: globalYear };
    }
    if (globalPeriod !== "all" && globalPeriod !== "year") {
      return { period: globalPeriod };
    }
    return {};
  }, [globalPeriod, globalYear]);

  // Use filtered stats when filters are active
  const hasFilters = globalPeriod !== "all";
  const { data: baseStats, isLoading: baseLoading, error: baseError } = useUserStats();
  const { data: filteredStats, isLoading: filteredLoading, error: filteredError } = useUserStatsFiltered(
    hasFilters ? filters : undefined
  );

  // Use comparison when enabled
  const { data: comparison } = useStatsComparison(
    {
      period1: globalPeriod === "year" ? "all" : (globalPeriod === "all" ? "3m" : globalPeriod),
      period2: comparePeriod,
      year1: globalPeriod === "year" ? globalYear : undefined,
    },
    showComparison
  );

  const stats = hasFilters ? filteredStats : baseStats;
  const isLoading = hasFilters ? filteredLoading : baseLoading;
  const error = hasFilters ? filteredError : baseError;

  const [timeRange, setTimeRange] = useState<TimeRange>("1y");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [holesFilter, setHolesFilter] = useState<HolesFilter>("all");

  // Handicap history dialog state
  const [hiDialogOpen, setHiDialogOpen] = useState(false);
  const [editingHI, setEditingHI] = useState<HandicapHistory | null>(null);
  const [hiForm, setHiForm] = useState({
    handicapIndex: "",
    effectiveDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  const handleHiSubmit = async () => {
    const handicapIndex = parseFloat(hiForm.handicapIndex);
    if (isNaN(handicapIndex) || handicapIndex < -10 || handicapIndex > 54) {
      return;
    }

    try {
      if (editingHI) {
        await updateHI.mutateAsync({
          id: editingHI.id,
          input: {
            handicapIndex,
            effectiveDate: hiForm.effectiveDate,
            notes: hiForm.notes || undefined,
          },
        });
      } else {
        await createHI.mutateAsync({
          handicapIndex,
          effectiveDate: hiForm.effectiveDate,
          notes: hiForm.notes || undefined,
        });
      }
      setHiDialogOpen(false);
      setEditingHI(null);
      setHiForm({
        handicapIndex: "",
        effectiveDate: format(new Date(), "yyyy-MM-dd"),
        notes: "",
      });
    } catch (e) {
      console.error("Error saving HI:", e);
    }
  };

  const handleEditHI = (entry: HandicapHistory) => {
    setEditingHI(entry);
    setHiForm({
      handicapIndex: entry.handicapIndex.toString(),
      effectiveDate: entry.effectiveDate,
      notes: entry.notes || "",
    });
    setHiDialogOpen(true);
  };

  const handleDeleteHI = async (id: string) => {
    if (confirm("¿Eliminar este registro de handicap?")) {
      try {
        await deleteHI.mutateAsync(id);
      } catch (e) {
        console.error("Error deleting HI:", e);
      }
    }
  };

  const handleNewHI = () => {
    setEditingHI(null);
    setHiForm({
      handicapIndex: "",
      effectiveDate: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    });
    setHiDialogOpen(true);
  };

  // Get unique courses for filter dropdown
  const availableCourses = useMemo(() => {
    if (!rounds) return [];
    const courses = new Set<string>();
    rounds.forEach((r) => {
      if (r.isFinished && r.virtualHandicap != null) {
        courses.add(r.courseName);
      }
    });
    return Array.from(courses).sort();
  }, [rounds]);

  // Prepare chart data from finished rounds with virtual handicap
  const chartData = useMemo(() => {
    if (!rounds) return [];

    const today = new Date();
    let cutoffDate: Date | null = null;

    switch (timeRange) {
      case "3m":
        cutoffDate = subMonths(today, 3);
        break;
      case "6m":
        cutoffDate = subMonths(today, 6);
        break;
      case "1y":
        cutoffDate = subYears(today, 1);
        break;
      case "all":
        cutoffDate = null;
        break;
    }

    const filteredRounds = rounds
      .filter((r) => {
        if (!r.isFinished || r.virtualHandicap == null) return false;
        // Time filter
        if (cutoffDate) {
          try {
            const roundDate = parseISO(r.roundDate);
            if (!isAfter(roundDate, cutoffDate)) return false;
          } catch {
            return false;
          }
        }
        // Course filter
        if (courseFilter !== "all" && r.courseName !== courseFilter) return false;
        // Holes filter
        if (holesFilter === "18" && r.courseLength !== "18") return false;
        if (holesFilter === "9" && r.courseLength === "18") return false;
        return true;
      })
      .map((r) => {
        const date = parseISO(r.roundDate);
        // Calculate total strokes from first player's scores
        const scores = r.players[0]?.scores || {};
        const totalStrokes = Object.values(scores).reduce((sum, s) => sum + (s.strokes || 0), 0);
        return {
          date: r.roundDate,
          dateLabel: format(date, "d MMM", { locale: es }),
          hv: r.virtualHandicap as number,
          course: r.courseName,
          strokes: totalStrokes,
          holes: r.courseLength === "18" ? 18 : 9,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return filteredRounds;
  }, [rounds, timeRange, courseFilter, holesFilter]);

  // Calculate average HV from filtered chart data
  const avgHV = useMemo(() => {
    if (chartData.length === 0) return null;
    const sum = chartData.reduce((acc, d) => acc + d.hv, 0);
    return sum / chartData.length;
  }, [chartData]);

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

  // Helper to get period label
  const getPeriodLabel = () => {
    if (globalPeriod === "year" && globalYear) return `Ano ${globalYear}`;
    switch (globalPeriod) {
      case "1m": return "Ultimo mes";
      case "3m": return "Ultimos 3 meses";
      case "6m": return "Ultimos 6 meses";
      case "1y": return "Ultimo ano";
      default: return "Todo el tiempo";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mis Estadisticas</h1>
          <p className="text-muted-foreground">
            Analiza tu rendimiento en el campo
          </p>
        </div>

        {/* Global Period Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={globalPeriod}
            onValueChange={(val) => {
              setGlobalPeriod(val as StatsPeriod | "year");
              if (val !== "year") setGlobalYear(undefined);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo</SelectItem>
              <SelectItem value="1m">1 mes</SelectItem>
              <SelectItem value="3m">3 meses</SelectItem>
              <SelectItem value="6m">6 meses</SelectItem>
              <SelectItem value="1y">1 ano</SelectItem>
              <SelectItem value="year">Ano...</SelectItem>
            </SelectContent>
          </Select>

          {globalPeriod === "year" && (
            <Select
              value={globalYear?.toString() ?? ""}
              onValueChange={(val) => setGlobalYear(parseInt(val))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasFilters && (
            <Badge variant="secondary" className="text-xs">
              {getPeriodLabel()}
            </Badge>
          )}
        </div>
      </div>

      {/* Period Comparison Toggle */}
      {hasFilters && (
        <Card className="bg-muted/30">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showComparison"
                  checked={showComparison}
                  onChange={(e) => setShowComparison(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="showComparison" className="text-sm cursor-pointer">
                  Comparar con:
                </Label>
              </div>
              {showComparison && (
                <Select
                  value={comparePeriod}
                  onValueChange={(val) => setComparePeriod(val as StatsPeriod)}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3m">3 meses</SelectItem>
                    <SelectItem value="6m">6 meses</SelectItem>
                    <SelectItem value="1y">1 ano</SelectItem>
                    <SelectItem value="all">Todo</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {showComparison && comparison && (
                <div className="flex gap-4 text-sm">
                  {comparison.diffAvgStrokes18holes !== null && (
                    <span className={comparison.diffAvgStrokes18holes < 0 ? "text-green-600" : comparison.diffAvgStrokes18holes > 0 ? "text-red-500" : ""}>
                      {comparison.diffAvgStrokes18holes < 0 ? <ArrowDownRight className="inline h-4 w-4" /> : comparison.diffAvgStrokes18holes > 0 ? <ArrowUpRight className="inline h-4 w-4" /> : <Minus className="inline h-4 w-4" />}
                      {Math.abs(comparison.diffAvgStrokes18holes).toFixed(1)} golpes
                    </span>
                  )}
                  {comparison.diffHvpTotal !== null && (
                    <span className={comparison.diffHvpTotal < 0 ? "text-green-600" : comparison.diffHvpTotal > 0 ? "text-red-500" : ""}>
                      {comparison.diffHvpTotal < 0 ? <ArrowDownRight className="inline h-4 w-4" /> : comparison.diffHvpTotal > 0 ? <ArrowUpRight className="inline h-4 w-4" /> : <Minus className="inline h-4 w-4" />}
                      {Math.abs(comparison.diffHvpTotal).toFixed(1)} HVP
                    </span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Handicap Index History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de Handicap Index
              </CardTitle>
              <CardDescription>
                Registra los cambios en tu handicap oficial para comparaciones precisas
              </CardDescription>
            </div>
            <Dialog open={hiDialogOpen} onOpenChange={setHiDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={handleNewHI}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingHI ? "Editar Handicap Index" : "Registrar Handicap Index"}
                  </DialogTitle>
                  <DialogDescription>
                    Introduce tu nuevo Handicap Index oficial y la fecha desde la que es vigente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="handicapIndex">Handicap Index</Label>
                    <Input
                      id="handicapIndex"
                      type="number"
                      step="0.1"
                      min="-10"
                      max="54"
                      placeholder="Ej: 18.5"
                      value={hiForm.handicapIndex}
                      onChange={(e) =>
                        setHiForm({ ...hiForm, handicapIndex: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="effectiveDate">Fecha de vigencia</Label>
                    <Input
                      id="effectiveDate"
                      type="date"
                      value={hiForm.effectiveDate}
                      onChange={(e) =>
                        setHiForm({ ...hiForm, effectiveDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas (opcional)</Label>
                    <Input
                      id="notes"
                      placeholder="Ej: Actualizacion de la RFEG"
                      value={hiForm.notes}
                      onChange={(e) =>
                        setHiForm({ ...hiForm, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setHiDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleHiSubmit}
                    disabled={
                      createHI.isPending ||
                      updateHI.isPending ||
                      !hiForm.handicapIndex ||
                      !hiForm.effectiveDate
                    }
                  >
                    {createHI.isPending || updateHI.isPending
                      ? "Guardando..."
                      : "Guardar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {hiLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Cargando historial...
            </div>
          ) : !handicapHistory || handicapHistory.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay historial de handicap registrado</p>
              <p className="text-xs mt-1">
                Registra tu handicap para comparar tu rendimiento con precision
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {handicapHistory.slice(0, 5).map((entry, index) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    index === 0 ? "bg-primary/10" : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xl font-bold">
                        {entry.handicapIndex.toFixed(1)}
                      </span>
                      {index === 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Actual
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div>Desde {format(parseISO(entry.effectiveDate), "d MMM yyyy", { locale: es })}</div>
                      {entry.notes && (
                        <div className="text-xs">{entry.notes}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditHI(entry)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteHI(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {handicapHistory.length > 5 && (
                <p className="text-xs text-center text-muted-foreground pt-2">
                  Mostrando los 5 mas recientes de {handicapHistory.length} registros
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* HV Evolution Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Evolucion del HV
                </CardTitle>
                <CardDescription>
                  Handicap Virtual por ronda a lo largo del tiempo
                </CardDescription>
              </div>
              <div className="flex gap-1">
                <Button
                  variant={timeRange === "3m" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeRange("3m")}
                >
                  3M
                </Button>
                <Button
                  variant={timeRange === "6m" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeRange("6m")}
                >
                  6M
                </Button>
                <Button
                  variant={timeRange === "1y" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeRange("1y")}
                >
                  1A
                </Button>
                <Button
                  variant={timeRange === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeRange("all")}
                >
                  Todo
                </Button>
              </div>
            </div>
            {/* Filters row */}
            <div className="flex flex-wrap gap-3">
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue placeholder="Campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los campos</SelectItem>
                  {availableCourses.map((course) => (
                    <SelectItem key={course} value={course}>
                      {course}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={holesFilter} onValueChange={(v) => setHolesFilter(v as HolesFilter)}>
                <SelectTrigger className="w-[120px] h-8 text-sm">
                  <SelectValue placeholder="Hoyos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="18">18 hoyos</SelectItem>
                  <SelectItem value="9">9 hoyos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[(dataMin: number) => Math.floor(dataMin - 2), (dataMax: number) => Math.ceil(dataMax + 2)]}
                    tickFormatter={(value: number) => value.toFixed(0)}
                    reversed
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const hi = stats.userHandicapIndex;
                        const belowHI = hi !== null && data.hv < hi;
                        const aboveHI = hi !== null && data.hv > hi;
                        const color = belowHI ? "#22c55e" : aboveHI ? "#ef4444" : "#6b7280";
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-3">
                            <p className="font-medium">{data.course}</p>
                            <p className="text-sm text-muted-foreground">{data.dateLabel}</p>
                            <p className="text-lg font-bold" style={{ color }}>
                              HV: {data.hv?.toFixed(1)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {data.strokes} golpes ({data.holes}h)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {stats.userHandicapIndex !== null && (
                    <ReferenceLine
                      y={stats.userHandicapIndex}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      label={{
                        value: `HI: ${stats.userHandicapIndex.toFixed(1)}`,
                        position: "right",
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      }}
                    />
                  )}
                  {avgHV !== null && (
                    <ReferenceLine
                      y={avgHV}
                      stroke="#3b82f6"
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                      label={{
                        value: `Media: ${avgHV.toFixed(1)}`,
                        position: "left",
                        fill: "#3b82f6",
                        fontSize: 11,
                      }}
                    />
                  )}
                  {/* Base gray line */}
                  <Line
                    type="monotone"
                    dataKey="hv"
                    stroke="#d1d5db"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {/* Colored dots based on HI comparison */}
                  <Line
                    type="monotone"
                    dataKey="hv"
                    stroke="transparent"
                    strokeWidth={0}
                    dot={(props: { cx?: number; cy?: number; payload?: { hv: number; strokes: number; holes: number } }) => {
                      const { cx, cy, payload } = props;
                      if (cx === undefined || cy === undefined || !payload) return null;
                      const hi = stats.userHandicapIndex;
                      const belowHI = hi !== null && payload.hv < hi;
                      const aboveHI = hi !== null && payload.hv > hi;
                      const color = belowHI ? "#22c55e" : aboveHI ? "#ef4444" : "#6b7280";
                      return (
                        <circle
                          key={`dot-${cx}-${cy}`}
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill={color}
                          stroke="white"
                          strokeWidth={2}
                        />
                      );
                    }}
                    activeDot={{ r: 8, strokeWidth: 2, stroke: "white" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground mt-3">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                Mejor que HI
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
                Peor que HI
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-6 border-t-2 border-dashed border-muted-foreground"></span>
                HI
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-6 border-t-2 border-dashed border-blue-500"></span>
                Media
              </span>
            </div>
          </CardContent>
        </Card>
      )}

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
