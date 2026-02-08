import { MigrationInterface, QueryRunner } from "typeorm";
import { addColumnIfMissing } from '../../utils/migration-helpers';

export class AddDomainColumns1770339063519 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await addColumnIfMissing(
            queryRunner,
            'http_services',
            `"allowedDomains" json`,
            'allowedDomains',
        );

        await addColumnIfMissing(
            queryRunner,
            'http_services',
            `"blockedDomains" json`,
            'blockedDomains',
        );

        await addColumnIfMissing(
            queryRunner,
            'tcp_services',
            `"allowedDomains" json`,
            'allowedDomains',
        );

        await addColumnIfMissing(
            queryRunner,
            'tcp_services',
            `"blockedDomains" json`,
            'blockedDomains',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "http_services" DROP COLUMN "allowedDomains";`);
        await queryRunner.query(`ALTER TABLE "http_services" DROP COLUMN "blockedDomains";`);
        await queryRunner.query(`ALTER TABLE "tcp_services" DROP COLUMN "allowedDomains";`);
        await queryRunner.query(`ALTER TABLE "tcp_services" DROP COLUMN "blockedDomains";`);
    }

}
