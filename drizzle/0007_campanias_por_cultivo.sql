CREATE TYPE "public"."estado_ciclo" AS ENUM('en_curso', 'cerrado');--> statement-breakpoint
ALTER TABLE "ciclos" ADD COLUMN "estado" "estado_ciclo" DEFAULT 'en_curso' NOT NULL;--> statement-breakpoint
ALTER TABLE "ciclos" ADD COLUMN "fecha_cierre" date;--> statement-breakpoint
ALTER TABLE "recetas" ADD COLUMN "archivo_oficial" text;--> statement-breakpoint
-- Si un lote tenía dos cultivos en la misma campaña (fina y gruesa), queda en curso el último
-- y los anteriores se dan por cerrados: tiene que haber uno solo en curso por lote.
UPDATE "ciclos" SET "estado" = 'cerrado', "fecha_cierre" = COALESCE("fecha_cosecha", CURRENT_DATE)
WHERE "id" NOT IN (SELECT max("id") FROM "ciclos" GROUP BY "lote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ciclos_un_cultivo_en_curso" ON "ciclos" USING btree ("lote_id") WHERE "ciclos"."estado" = 'en_curso';--> statement-breakpoint
-- Bucket privado para documentos (PDF de la receta oficial de la provincia, hasta 10 MB).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documentos', 'documentos', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
