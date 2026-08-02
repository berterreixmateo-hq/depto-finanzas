import { Home, ShoppingCart } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ComingSoonButton } from "@/components/shared/coming-soon-button";

export default function ListasPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Listas</h1>

      <Tabs defaultValue="faltantes">
        <TabsList className="w-full">
          <TabsTrigger value="faltantes" className="flex-1">
            Faltantes de la casa
          </TabsTrigger>
          <TabsTrigger value="super" className="flex-1">
            Súper
          </TabsTrigger>
        </TabsList>

        <TabsContent value="faltantes" className="pt-4">
          <EmptyState
            icon={Home}
            title="Nada anotado todavía"
            description="Lo que va haciendo falta en la casa, compartido entre los dos."
            action={<ComingSoonButton phase="Fase 6">Agregar algo</ComingSoonButton>}
          />
        </TabsContent>

        <TabsContent value="super" className="pt-4">
          <EmptyState
            icon={ShoppingCart}
            title="Lista de súper vacía"
            description="Se actualiza al toque entre los dos mientras están comprando."
            action={<ComingSoonButton phase="Fase 6">Agregar producto</ComingSoonButton>}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
