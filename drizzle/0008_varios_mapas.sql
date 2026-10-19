ALTER TABLE "fotos" ADD COLUMN "es_mapa" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lotes" ADD COLUMN "mapa_id" integer;--> statement-breakpoint
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_mapa_id_fotos_id_fk" FOREIGN KEY ("mapa_id") REFERENCES "public"."fotos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- El mapa que tenía cada campo pasa a ser uno de sus mapas, y los lotes ya marcados quedan sobre él.
UPDATE "fotos" SET "es_mapa" = true WHERE "id" IN (SELECT "foto_mapa_id" FROM "campos" WHERE "foto_mapa_id" IS NOT NULL);--> statement-breakpoint
UPDATE "lotes" SET "mapa_id" = "campos"."foto_mapa_id" FROM "campos" WHERE "lotes"."campo_id" = "campos"."id" AND "lotes"."dibujo" IS NOT NULL AND "campos"."foto_mapa_id" IS NOT NULL;
