CREATE INDEX "stores_statut_validation_idx" ON "stores" USING btree ("statut_validation");--> statement-breakpoint
CREATE INDEX "products_store_idx" ON "products" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "products_categorie_idx" ON "products" USING btree ("categorie_id");--> statement-breakpoint
CREATE INDEX "products_disponible_prix_idx" ON "products" USING btree ("disponible","prix");--> statement-breakpoint
CREATE INDEX "deliverers_statut_disponible_idx" ON "deliverers" USING btree ("statut_validation","disponible");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "deliveries_deliverer_status_idx" ON "deliveries" USING btree ("deliverer_id","statut");--> statement-breakpoint
CREATE INDEX "locations_entite_idx" ON "locations" USING btree ("entite_type","entite_id");