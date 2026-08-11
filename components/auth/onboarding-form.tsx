"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { generateInviteCode } from "@/lib/utils/invite-code";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function OnboardingForm() {
  const router = useRouter();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreateHousehold(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Tu sesión expiró, iniciá sesión de nuevo");
      setLoading(false);
      router.push("/login");
      return;
    }

    const { data: household, error: householdError } = await supabase
      .from("households")
      .insert({ name: householdName, invite_code: generateInviteCode() })
      .select()
      .single();

    if (householdError || !household) {
      toast.error("No pudimos crear el hogar", {
        description: householdError?.message,
      });
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase.from("household_members").insert({
      household_id: household.id,
      user_id: user.id,
      display_name: displayName,
    });

    setLoading(false);

    if (memberError) {
      toast.error("No pudimos vincularte al hogar", {
        description: memberError.message,
      });
      return;
    }

    const { error: categoriesError } = await supabase.from("categories").insert(
      DEFAULT_CATEGORIES.map((category) => ({
        household_id: household.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
      })),
    );

    if (categoriesError) {
      toast.error("El hogar quedó creado, pero sin categorías", {
        description: categoriesError.message,
      });
    }

    toast.success(`Hogar creado. Código para tu pareja: ${household.invite_code}`);
    router.push("/");
    router.refresh();
  }

  async function handleJoinHousehold(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Tu sesión expiró, iniciá sesión de nuevo");
      setLoading(false);
      router.push("/login");
      return;
    }

    const { data: household, error: lookupError } = await supabase
      .from("households")
      .select()
      .eq("invite_code", inviteCode.trim().toUpperCase())
      .single();

    if (lookupError || !household) {
      toast.error("No encontramos ese código", {
        description: "Revisá que esté bien escrito",
      });
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase.from("household_members").insert({
      household_id: household.id,
      user_id: user.id,
      display_name: displayName,
    });

    setLoading(false);

    if (memberError) {
      toast.error("No pudimos unirte al hogar", {
        description: memberError.message,
      });
      return;
    }

    toast.success(`Te uniste a ${household.name}`);
    router.push("/");
    router.refresh();
  }

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Casi listo</CardTitle>
        <CardDescription>Creá tu hogar o unite con el código de tu pareja</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 mb-4">
          <Label htmlFor="display-name">Tu nombre</Label>
          <Input
            id="display-name"
            placeholder="Como querés que te vean"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <Tabs defaultValue="create">
          <TabsList className="w-full">
            <TabsTrigger value="create" className="flex-1">
              Crear hogar
            </TabsTrigger>
            <TabsTrigger value="join" className="flex-1">
              Unirme con código
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <form onSubmit={handleCreateHousehold} className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="household-name">Nombre del hogar</Label>
                <Input
                  id="household-name"
                  placeholder="Ej: Depto de Corrientes"
                  required
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading || !displayName} className="mt-2">
                {loading ? "Creando…" : "Crear hogar"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="join">
            <form onSubmit={handleJoinHousehold} className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-code">Código de invitación</Label>
                <Input
                  id="invite-code"
                  placeholder="Ej: 7K2M9P"
                  required
                  className="uppercase tracking-widest"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading || !displayName} className="mt-2">
                {loading ? "Uniendo…" : "Unirme"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
