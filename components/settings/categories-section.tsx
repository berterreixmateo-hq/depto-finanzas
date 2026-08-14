"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold, type HouseholdCategory } from "@/lib/household-context";
import { CATEGORY_COLORS, CATEGORY_ICONS, iconoDeCategoria } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function CategoryForm({
  category,
  usados,
  onSaved,
  onCancel,
}: {
  category?: HouseholdCategory;
  usados: string[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const { householdId } = useHousehold();

  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0].hex);
  const [icon, setIcon] = useState(category?.icon ?? "MoreHorizontal");
  const [saving, setSaving] = useState(false);

  const repetido = usados.includes(color) && color !== category?.color;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Ponele un nombre");
      return;
    }

    setSaving(true);
    const payload = { name: name.trim(), color, icon };
    const { error } = category
      ? await supabase.from("categories").update(payload).eq("id", category.id)
      : await supabase.from("categories").insert({ ...payload, household_id: householdId });
    setSaving(false);

    if (error) {
      toast.error("No pudimos guardar la categoría", { description: error.message });
      return;
    }
    toast.success(category ? "Categoría actualizada" : "Categoría creada");
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="cat-name">Nombre</Label>
        <Input
          id="cat-name"
          placeholder="Ej: Mascotas"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setColor(c.hex)}
              aria-label={c.nombre}
              aria-pressed={color === c.hex}
              className="flex size-9 items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{ backgroundColor: c.hex }}
            >
              {color === c.hex && <Check className="size-4 text-white" />}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Son ocho y no hay selector libre: están elegidos para distinguirse entre
          sí, también con daltonismo. Un color a ojo puede volver dos categorías
          iguales en los gráficos.
        </p>
        {repetido && (
          <p className="text-xs text-warning">
            Ese color ya lo usa otra categoría. Van a verse iguales en los gráficos.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Ícono</Label>
        <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
          {Object.entries(CATEGORY_ICONS).map(([nombre, Icono]) => (
            <button
              key={nombre}
              type="button"
              onClick={() => setIcon(nombre)}
              aria-label={nombre}
              aria-pressed={icon === nombre}
              className={`flex size-9 items-center justify-center rounded-lg transition-colors ${
                icon === nombre ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <Icono className="size-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? "Guardando…" : category ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  );
}

export function CategoriesSection() {
  const supabase = createClient();
  const router = useRouter();
  const { categories } = useHousehold();

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HouseholdCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HouseholdCategory | null>(null);

  // Las categorías viven en el contexto, que se arma en el layout del servidor.
  // Refrescar la ruta es lo que hace que un alta o un cambio se vea en toda la app.
  const refrescar = () => {
    setAddOpen(false);
    setEditTarget(null);
    router.refresh();
  };

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("categories").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);

    if (error) {
      // `expenses` y `recurring_expenses` la referencian con on delete restrict:
      // borrar una categoría con historial rompería gastos ya cargados.
      toast.error("No se puede borrar", {
        description: "Ya tiene gastos o servicios asociados. Renombrala en vez de borrarla.",
      });
      return;
    }
    toast.success("Categoría borrada");
    router.refresh();
  }

  const usados = categories.map((c) => c.color);

  return (
    <div className="flex flex-col gap-2">
      {categories.map((category) => {
        const Icono = iconoDeCategoria(category.icon);
        return (
          <div
            key={category.id}
            className="flex items-center gap-3 rounded-xl bg-card px-4 py-2.5 shadow-sm"
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${category.color}26`, color: category.color }}
            >
              <Icono className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label={`Editar ${category.name}`}
              onClick={() => setEditTarget(category)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-danger"
              aria-label={`Borrar ${category.name}`}
              onClick={() => setDeleteTarget(category)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        );
      })}

      <Button variant="outline" size="sm" className="mt-1" onClick={() => setAddOpen(true)}>
        <Plus className="size-4" />
        Agregar categoría
      </Button>

      {categories.length >= CATEGORY_COLORS.length && (
        <p className="px-1 text-xs text-muted-foreground">
          Ya usás los ocho colores. Una categoría más va a repetir uno.
        </p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva categoría</DialogTitle>
          </DialogHeader>
          <CategoryForm
            usados={usados}
            onSaved={refrescar}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar categoría</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <CategoryForm
              category={editTarget}
              usados={usados}
              onSaved={refrescar}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede si no tiene ningún gasto ni servicio asociado. Si ya la
              usaste, renombrala en lugar de borrarla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
