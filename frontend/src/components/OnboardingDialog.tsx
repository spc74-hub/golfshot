import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { playersApi, usersApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface OnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.displayName || "");
  const [handicapIndex, setHandicapIndex] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    const handicap = handicapIndex ? parseFloat(handicapIndex.replace(",", ".")) : 0;
    if (handicapIndex && (isNaN(handicap) || handicap < 0 || handicap > 54)) {
      setError("El handicap debe estar entre 0 y 54");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Update user profile with display name
      await usersApi.updateMyProfile({ displayName: name.trim() });

      // 2. Create saved player
      const newPlayer = await playersApi.create({
        name: name.trim(),
        handicapIndex: handicap,
        preferredTee: "Amarillas",
      });

      // 3. Link player to user
      await usersApi.updateMyProfile({ linkedPlayerId: newPlayer.id });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["players"] });

      onComplete();
    } catch (err) {
      console.error("Onboarding error:", err);
      setError("Error al guardar. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Bienvenido a Golfshot</DialogTitle>
          <DialogDescription>
            Completa tu perfil para empezar a registrar tus partidas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tu nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="handicap">Handicap Index (opcional)</Label>
            <Input
              id="handicap"
              type="text"
              inputMode="decimal"
              value={handicapIndex}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
                  setHandicapIndex(value);
                }
              }}
              placeholder="Ej: 18,5"
            />
            <p className="text-xs text-muted-foreground">
              Si no tienes handicap oficial, déjalo vacío o pon 0
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading || !name.trim()}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Empezar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
