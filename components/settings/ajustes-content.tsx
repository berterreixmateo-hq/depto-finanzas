"use client";

import { useRouter } from "next/navigation";
import { Copy, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useHousehold } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/settings/theme-toggle";
import { CategoriesSection } from "@/components/settings/categories-section";
import { BudgetsSection } from "@/components/settings/budgets-section";
import { IncomeSection } from "@/components/settings/income-section";

export function AjustesContent() {
  const router = useRouter();
  const supabase = createClient();
  const { displayName, email, householdName, inviteCode, partnerName } = useHousehold();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function copyInviteCode() {
    await navigator.clipboard.writeText(inviteCode);
    toast.success("Código copiado");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>

      <Card className="border-none shadow-sm">
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-11">
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{displayName}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{householdName}</p>
              <p className="text-sm text-muted-foreground">
                {partnerName ? `Compartido con ${partnerName}` : "Esperando a tu pareja"}
              </p>
            </div>
            {!partnerName && (
              <Button variant="outline" size="sm" onClick={copyInviteCode}>
                <Copy className="size-3.5" />
                {inviteCode}
              </Button>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Modo oscuro</p>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">Categorías</p>
        <CategoriesSection />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">Ingresos del mes</p>
        <IncomeSection />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">Presupuestos</p>
        <BudgetsSection />
      </div>

      <Button variant="outline" onClick={handleLogout} className="mt-2">
        <LogOut className="size-4" />
        Cerrar sesión
      </Button>
    </div>
  );
}
