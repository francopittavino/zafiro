import { cn } from "@/lib/utils";

const COLORES: Record<string, string> = {
  soja: "bg-[#e3f0e1] text-[#2f5a2a]",
  girasol: "bg-[#fbf1c7] text-[#6b5207]",
  sorgo: "bg-[#f6e3d6] text-[#7a3e14]",
  trigo: "bg-[#efe9da] text-[#5c4a1a]",
  maiz: "bg-[#fdf3c4] text-[#6b5a07]",
};

/** Chip con el cultivo. "Trigo/Soja" (doble cultivo de la planilla) se muestra como dos chips. */
export function ChipCultivo({ cultivo }: { cultivo: string }) {
  return (
    <span className="flex gap-1">
      {cultivo.split("/").map((c) => (
        <span
          key={c}
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-bold",
            COLORES[c.trim().toLowerCase()] ?? "bg-muted text-muted-foreground",
          )}
        >
          {c.trim()}
        </span>
      ))}
    </span>
  );
}
