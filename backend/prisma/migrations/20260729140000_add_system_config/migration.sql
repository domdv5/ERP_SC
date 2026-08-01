-- CreateTable
CREATE TABLE "system_config" (
    "id" UUID NOT NULL,
    "read_only_mode" BOOLEAN NOT NULL DEFAULT false,
    "activated_by_id" UUID,
    "activated_at" TIMESTAMPTZ,
    "deactivated_by_id" UUID,
    "deactivated_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_activated_by_id_fkey" FOREIGN KEY ("activated_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_deactivated_by_id_fkey" FOREIGN KEY ("deactivated_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
