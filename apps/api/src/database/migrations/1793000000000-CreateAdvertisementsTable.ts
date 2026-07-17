import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAdvertisementsTable1793000000000 implements MigrationInterface {
    name = 'CreateAdvertisementsTable1793000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "advertisements" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "branch_id" uuid NOT NULL,
                "image_url" text NOT NULL,
                "link_url" varchar(200),
                "title" varchar(100),
                "is_active" boolean NOT NULL DEFAULT true,
                "sort_order" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_advertisements" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_advertisements_branch_id" ON "advertisements" ("branch_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_advertisements_branch_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "advertisements"`);
    }
}
