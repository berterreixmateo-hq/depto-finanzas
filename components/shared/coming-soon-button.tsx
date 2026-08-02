"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ComingSoonButton({
  children,
  phase,
}: {
  children: React.ReactNode;
  phase: string;
}) {
  return (
    <Button onClick={() => toast.info(`Esto se habilita en la ${phase}`)}>
      {children}
    </Button>
  );
}
