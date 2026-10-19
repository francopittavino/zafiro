import type { EstadoOrden } from "@/lib/ordenes";

export const ESTADOS_ORDEN: Record<EstadoOrden, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "bg-sol/30 text-primary" },
  enviada: { texto: "Enviada", clase: "bg-zafiro-suave text-primary" },
  realizada: { texto: "Realizada", clase: "bg-positivo/10 text-positivo" },
  anulada: { texto: "Anulada", clase: "bg-destructive/10 text-destructive line-through" },
};
