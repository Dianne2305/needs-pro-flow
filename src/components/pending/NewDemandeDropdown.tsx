/**
 * NewDemandeDropdown.tsx
 * Dropdown 'Nouvelle demande' (Particulier / Entreprise) sur la page Pending.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import { TYPES_PRESTATION_PARTICULIER, TYPES_PRESTATION_ENTREPRISE } from "@/lib/constants";

interface Props {
  onSelect: (segment: "SPP" | "SPE", typePrestation: string) => void;
}

export function NewDemandeDropdown({ onSelect }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Nouveau</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Particulier</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {TYPES_PRESTATION_PARTICULIER.map((t) => (
              <DropdownMenuItem key={t} onClick={() => onSelect("SPP", t)}>
                {t}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Entreprise</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {TYPES_PRESTATION_ENTREPRISE.map((t) => (
              <DropdownMenuItem key={t} onClick={() => onSelect("SPE", t)}>
                {t}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
