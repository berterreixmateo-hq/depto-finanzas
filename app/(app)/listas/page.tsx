import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShoppingList } from "@/components/listas/shopping-list";
import { CotoLink } from "@/components/listas/coto-link";

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
          <ShoppingList
            listType="faltantes"
            emptyTitle="Nada anotado todavía"
            emptyDescription="Lo que va haciendo falta en la casa, compartido entre los dos."
            placeholder="Ej: lamparita del baño"
          />
        </TabsContent>

        <TabsContent value="super" className="flex flex-col gap-4 pt-4">
          <CotoLink />
          <ShoppingList
            listType="super"
            emptyTitle="Lista de súper vacía"
            emptyDescription="Se actualiza al toque entre los dos mientras están comprando."
            placeholder="Ej: leche"
            conPrecios
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
