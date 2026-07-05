import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationsTable1784000000003 implements MigrationInterface {
    name = 'CreateNotificationsTable1784000000003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "notifications" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "branch_id" uuid NOT NULL,
                "type" varchar(30) NOT NULL,
                "title" varchar(200) NOT NULL,
                "message" text NOT NULL,
                "data" jsonb,
                "is_read" boolean NOT NULL DEFAULT false,
                "created_at" timestamptz NOT NULL DEFAULT NOW(),
                CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_notifications_branch_id" ON "notifications" ("branch_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_notifications_branch_read" ON "notifications" ("branch_id", "is_read")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_notifications_branch_read"`);
        await queryRunner.query(`DROP INDEX "IDX_notifications_branch_id"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
    }
}
