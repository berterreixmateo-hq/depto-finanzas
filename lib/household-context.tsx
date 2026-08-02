"use client";

import { createContext, useContext } from "react";

export interface HouseholdCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface HouseholdContextValue {
  userId: string;
  email: string;
  displayName: string;
  householdId: string;
  householdName: string;
  inviteCode: string;
  partnerId: string | null;
  partnerName: string | null;
  categories: HouseholdCategory[];
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({
  value,
  children,
}: {
  value: HouseholdContextValue;
  children: React.ReactNode;
}) {
  return (
    <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) {
    throw new Error("useHousehold debe usarse dentro de HouseholdProvider");
  }
  return ctx;
}
