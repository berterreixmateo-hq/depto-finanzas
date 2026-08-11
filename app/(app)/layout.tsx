import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HouseholdProvider } from "@/lib/household-context";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { FabAddExpense } from "@/components/nav/fab-add-expense";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: member } = await supabase
    .from("household_members")
    .select("household_id, display_name, households(name, invite_code)")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    redirect("/onboarding");
  }

  const { data: partner } = await supabase
    .from("household_members")
    .select("user_id, display_name")
    .eq("household_id", member.household_id)
    .neq("user_id", user.id)
    .maybeSingle();

  let { data: categories } = await supabase
    .from("categories")
    .select("id, name, color, icon")
    .eq("household_id", member.household_id)
    .order("name");

  // Seed perezoso: un hogar sin categorías deja la carga de gastos inutilizable
  // (el select abre vacío). Pasa si el insert del onboarding falló. Mismo criterio
  // que las instancias de gastos fijos: se completa al entrar, sin cron.
  if (!categories?.length) {
    const { data: seeded } = await supabase
      .from("categories")
      .insert(
        DEFAULT_CATEGORIES.map((category) => ({
          household_id: member.household_id,
          name: category.name,
          color: category.color,
          icon: category.icon,
        })),
      )
      .select("id, name, color, icon")
      .order("name");

    categories = seeded ?? categories;
  }

  const household = Array.isArray(member.households)
    ? member.households[0]
    : member.households;

  return (
    <HouseholdProvider
      value={{
        userId: user.id,
        email: user.email ?? "",
        displayName: member.display_name,
        householdId: member.household_id,
        householdName: household?.name ?? "",
        inviteCode: household?.invite_code ?? "",
        partnerId: partner?.user_id ?? null,
        partnerName: partner?.display_name ?? null,
        categories: categories ?? [],
      }}
    >
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-10">
            {children}
          </main>
        </div>
        <BottomNav />
        <FabAddExpense />
      </div>
    </HouseholdProvider>
  );
}
