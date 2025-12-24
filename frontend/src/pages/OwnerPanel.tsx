import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { ownerApi, playersApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Crown,
  Users,
  FileText,
  BarChart3,
  Shield,
  Link2,
  UserCircle,
  Check,
  X,
  Ban,
  Trash2,
  RefreshCw,
} from "lucide-react";
import type { UserWithStats, OwnerStats, Permission, SavedPlayer, Round } from "@/types";
import { Navigate } from "react-router-dom";

const ALL_PERMISSIONS: { value: Permission; label: string }[] = [
  { value: "rounds.create", label: "Crear partidas" },
  { value: "rounds.import", label: "Importar partidas" },
  { value: "courses.create", label: "Crear campos" },
  { value: "courses.edit", label: "Editar campos" },
  { value: "players.manage", label: "Gestionar jugadores" },
];

export function OwnerPanel() {
  const { isOwner, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("stats");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [rounds, setRounds] = useState<(Round & { userDisplayName: string })[]>([]);
  const [players, setPlayers] = useState<SavedPlayer[]>([]);
  const [roundsTotal, setRoundsTotal] = useState(0);

  // Permission dialog
  const [permissionDialog, setPermissionDialog] = useState<UserWithStats | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);

  // Link player dialog
  const [linkDialog, setLinkDialog] = useState<UserWithStats | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");

  // Backfill state
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ message: string; updated: number; skipped: number } | null>(null);

  // Block/Delete dialog state
  const [blockDialog, setBlockDialog] = useState<UserWithStats | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<UserWithStats | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (isOwner) {
      loadData();
    }
  }, [isOwner]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, roundsData, playersData] = await Promise.all([
        ownerApi.getStats(),
        ownerApi.listUsers(),
        ownerApi.listRounds(50, 0),
        playersApi.list(),
      ]);
      setStats(statsData);
      setUsers(usersData);
      setRounds(roundsData.rounds);
      setRoundsTotal(roundsData.total);
      setPlayers(playersData);
    } catch (error) {
      console.error("Error loading owner data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openPermissionDialog = (user: UserWithStats) => {
    setPermissionDialog(user);
    setSelectedPermissions([...user.permissions] as Permission[]);
  };

  const handleSavePermissions = async () => {
    if (!permissionDialog) return;
    try {
      await ownerApi.updatePermissions(permissionDialog.id, selectedPermissions);
      // Update local state
      setUsers(users.map(u =>
        u.id === permissionDialog.id
          ? { ...u, permissions: selectedPermissions }
          : u
      ));
      setPermissionDialog(null);
    } catch (error) {
      console.error("Error updating permissions:", error);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "user" | "admin") => {
    try {
      await ownerApi.updateRole(userId, newRole);
      setUsers(users.map(u =>
        u.id === userId ? { ...u, role: newRole } : u
      ));
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  const openLinkDialog = (user: UserWithStats) => {
    setLinkDialog(user);
    setSelectedPlayerId(user.linkedPlayerId || "none");
  };

  const handleLinkPlayer = async () => {
    if (!linkDialog) return;
    try {
      const playerIdToLink = selectedPlayerId === "none" ? null : selectedPlayerId;
      await ownerApi.linkPlayer(linkDialog.id, playerIdToLink);
      const linkedPlayer = playerIdToLink ? players.find(p => p.id === playerIdToLink) : null;
      setUsers(users.map(u =>
        u.id === linkDialog.id
          ? {
              ...u,
              linkedPlayerId: playerIdToLink,
              linkedPlayerName: linkedPlayer?.name || null,
            }
          : u
      ));
      setLinkDialog(null);
    } catch (error) {
      console.error("Error linking player:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleBackfillVH = async () => {
    setBackfillLoading(true);
    setBackfillResult(null);
    try {
      const result = await ownerApi.backfillVirtualHandicap();
      setBackfillResult(result);
    } catch (error) {
      console.error("Error backfilling VH:", error);
      setBackfillResult({ message: "Error", updated: 0, skipped: 0 });
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleBlockUser = async () => {
    if (!blockDialog) return;
    setActionLoading(true);
    try {
      const result = await ownerApi.toggleBlockUser(blockDialog.id);
      setUsers(users.map(u =>
        u.id === blockDialog.id
          ? { ...u, status: result.status as "active" | "blocked" }
          : u
      ));
      setBlockDialog(null);
    } catch (error) {
      console.error("Error blocking user:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog) return;
    setActionLoading(true);
    try {
      await ownerApi.deleteUser(deleteDialog.id);
      setUsers(users.filter(u => u.id !== deleteDialog.id));
      setDeleteDialog(null);
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isOwner) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-8 w-8 text-yellow-500" />
        <div>
          <h1 className="text-2xl font-bold">Panel de Propietario</h1>
          <p className="text-muted-foreground">
            Gestiona usuarios, permisos y ve estadisticas globales
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Estadisticas
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="rounds" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Partidas
          </TabsTrigger>
        </TabsList>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          {stats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Usuarios totales</CardDescription>
                  <CardTitle className="text-3xl">{stats.totalUsers}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {stats.usersByRole.owner} owner, {stats.usersByRole.admin} admin, {stats.usersByRole.user} user
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Partidas totales</CardDescription>
                  <CardTitle className="text-3xl">{stats.totalRounds}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {stats.finishedRounds} finalizadas
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Este mes</CardDescription>
                  <CardTitle className="text-3xl">{stats.roundsThisMonth}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    partidas jugadas
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Campos / Jugadores</CardDescription>
                  <CardTitle className="text-3xl">{stats.totalCourses} / {stats.totalPlayers}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    registrados
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Maintenance Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mantenimiento</CardTitle>
              <CardDescription>Acciones de administracion del sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Recalcular Handicap Virtual</p>
                  <p className="text-sm text-muted-foreground">
                    Calcula el HV para todas las partidas historicas que no lo tienen
                  </p>
                </div>
                <Button
                  onClick={handleBackfillVH}
                  disabled={backfillLoading}
                  variant="outline"
                >
                  {backfillLoading ? "Procesando..." : "Ejecutar"}
                </Button>
              </div>
              {backfillResult && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p><strong>Resultado:</strong> {backfillResult.message}</p>
                  <p>Actualizadas: {backfillResult.updated} | Omitidas: {backfillResult.skipped}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usuarios registrados</CardTitle>
              <CardDescription>
                Gestiona roles, permisos y enlaces de jugadores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Jugador vinculado</TableHead>
                    <TableHead>Partidas</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {user.displayName || "Sin nombre"}
                            {user.status === "blocked" && (
                              <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.role === "owner" ? (
                          <Badge className="bg-yellow-500">Owner</Badge>
                        ) : (
                          <Select
                            value={user.role}
                            onValueChange={(value: "user" | "admin") =>
                              handleRoleChange(user.id, value)
                            }
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.linkedPlayerName ? (
                          <div className="flex items-center gap-2">
                            <UserCircle className="h-4 w-4" />
                            {user.linkedPlayerName}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{user.totalRounds}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPermissionDialog(user)}
                            disabled={user.role === "owner"}
                            title="Permisos"
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openLinkDialog(user)}
                            title="Vincular jugador"
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={user.status === "blocked" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBlockDialog(user)}
                            disabled={user.role === "owner"}
                            title={user.status === "blocked" ? "Desbloquear" : "Bloquear"}
                            className={user.status === "blocked" ? "bg-orange-500 hover:bg-orange-600" : ""}
                          >
                            {user.status === "blocked" ? (
                              <RefreshCw className="h-4 w-4" />
                            ) : (
                              <Ban className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteDialog(user)}
                            disabled={user.role === "owner"}
                            title="Eliminar"
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rounds Tab */}
        <TabsContent value="rounds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Todas las partidas</CardTitle>
              <CardDescription>
                {roundsTotal} partidas en total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rounds.map((round) => (
                    <TableRow key={round.id}>
                      <TableCell>{formatDate(round.roundDate)}</TableCell>
                      <TableCell>{round.userDisplayName}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{round.courseName}</div>
                          <div className="text-sm text-muted-foreground">
                            {round.courseLength === "18"
                              ? "18 hoyos"
                              : round.courseLength === "front9"
                              ? "Primeros 9"
                              : "Ultimos 9"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{round.gameMode}</TableCell>
                      <TableCell>
                        <Badge variant={round.isFinished ? "default" : "secondary"}>
                          {round.isFinished ? "Finalizada" : "En curso"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Permission Dialog */}
      <Dialog open={!!permissionDialog} onOpenChange={() => setPermissionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar permisos</DialogTitle>
            <DialogDescription>
              Permisos para {permissionDialog?.displayName || permissionDialog?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {ALL_PERMISSIONS.map((perm) => {
              const isSelected = selectedPermissions.includes(perm.value);
              return (
                <Button
                  key={perm.value}
                  variant={isSelected ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedPermissions(selectedPermissions.filter(p => p !== perm.value));
                    } else {
                      setSelectedPermissions([...selectedPermissions, perm.value]);
                    }
                  }}
                >
                  {isSelected ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <X className="h-4 w-4 mr-2 opacity-30" />
                  )}
                  {perm.label}
                </Button>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePermissions}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Player Dialog */}
      <Dialog open={!!linkDialog} onOpenChange={() => setLinkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular jugador</DialogTitle>
            <DialogDescription>
              Vincula a {linkDialog?.displayName || linkDialog?.email} con un jugador guardado
            </DialogDescription>
          </DialogHeader>

          <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un jugador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin vincular</SelectItem>
              {players.map((player) => (
                <SelectItem key={player.id} value={player.id}>
                  {player.name} (HCP: {player.handicapIndex})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleLinkPlayer}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block User Dialog */}
      <Dialog open={!!blockDialog} onOpenChange={() => setBlockDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {blockDialog?.status === "blocked" ? "Desbloquear" : "Bloquear"} usuario
            </DialogTitle>
            <DialogDescription>
              {blockDialog?.status === "blocked"
                ? `¿Desbloquear a ${blockDialog?.displayName || blockDialog?.email}? El usuario podra volver a acceder a la aplicacion.`
                : `¿Bloquear a ${blockDialog?.displayName || blockDialog?.email}? El usuario no podra acceder a la aplicacion mientras este bloqueado.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialog(null)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleBlockUser}
              disabled={actionLoading}
              variant={blockDialog?.status === "blocked" ? "default" : "destructive"}
            >
              {actionLoading ? "Procesando..." : blockDialog?.status === "blocked" ? "Desbloquear" : "Bloquear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              ¿Eliminar definitivamente a {deleteDialog?.displayName || deleteDialog?.email}?
              Esta accion no se puede deshacer y eliminara todas sus partidas y datos.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteUser}
              disabled={actionLoading}
              variant="destructive"
            >
              {actionLoading ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
