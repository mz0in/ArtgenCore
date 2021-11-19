import { EventEmitter2 } from 'eventemitter2';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ModelDefined } from 'sequelize';
import { ILogger, Inject, Logger, Service } from '../../../app/container';
import { ROOT_DIR } from '../../../app/globals';
import { ILink } from '../../database/interface';
import { LinkService } from '../../database/service/link.service';
import { ISchema } from '../interface/schema.interface';
import { SchemaMigrationService } from './schema-migration.service';

@Service()
export class SchemaService {
  /**
   * In memory cache to access schemas.
   */
  registry: ISchema[] = [];

  constructor(
    @Logger()
    readonly logger: ILogger,
    @Inject(LinkService)
    readonly linkService: LinkService,
    @Inject(EventEmitter2)
    readonly event: EventEmitter2,
    @Inject(SchemaMigrationService)
    readonly migrator: SchemaMigrationService,
  ) {}

  /**
   * Synchronize the offline system schemas into the database, this allows the user
   * to extend on the system's behavior, the synchronizer will only ensure the
   * existence of the schema and does not overide it if its present.
   */
  async synchronize(link: ILink) {
    // Get the schema repository.
    const model = this.model<ISchema>('system', 'Schema');

    for (const schema of link.getSchemas()) {
      // Upsert the schema based on the database and reference unique.
      await model.upsert(schema, {
        fields: ['database', 'reference'],
      });

      // Check if it exists in the local cache.
      const idx = this.registry.findIndex(
        s => s.database === schema.database && s.reference === schema.reference,
      );

      if (idx !== -1) {
        this.registry.splice(idx, 1, schema);
      } else {
        this.registry.push(schema);
      }
    }
  }

  /**
   * Responsible to load system schemas from JSON format.
   * Isolated without any database dependency so, it
   * can be used at bootstrap to load the system
   * schemas from local disk.
   */
  getSystem(): ISchema[] {
    return (
      JSON.parse(
        readFileSync(
          join(ROOT_DIR, 'storage/seed/schema/system.database.json'),
        ).toString(),
      ) as ISchema[]
    ).map(s => this.migrator.migrate(s));
  }

  /**
   * Fetch the newest schemas from the database, and use this opportunity to
   * ensure the local cache is up to date.
   */
  async findAll(): Promise<ISchema[]> {
    const schemas = await this.model<ISchema>('system', 'Schema').findAll();

    // Update the schemas, in case the database schema is not migrated.
    this.registry = schemas.map(s =>
      this.migrator.migrate(
        s.get({
          plain: true,
        }),
      ),
    );

    return this.registry;
  }

  /**
   * Get the repository for the given database and schema.
   */
  model<T = Record<string, unknown>>(
    database: string,
    schema: string,
  ): ModelDefined<T, T> {
    return this.linkService.findByName(database).model(schema);
  }

  findByDatabase(database: string) {
    return this.registry.filter(s => s.database === database);
  }

  findOne(database: string, reference: string): ISchema {
    return this.registry.find(
      s => s.database === database && s.reference === reference,
    );
  }

  async create(schema: ISchema) {
    const model = this.model<ISchema>('system', 'Schema');
    await model.create(schema);

    this.registry.push(schema);
    this.event.emit('schema.created', schema);

    return schema;
  }

  async update(update: ISchema) {
    const model = this.model<ISchema>('system', 'Schema');
    const record = await model.findOne({
      where: {
        database: update.database,
        reference: update.reference,
      },
    });

    record.setAttributes(update);
    await record.save();

    this.registry.splice(
      this.registry.findIndex(
        s => s.database === update.database && s.reference === update.reference,
      ),
      1,
      record.get({ plain: true }),
    );

    this.event.emit('schema.updated', record);

    return record;
  }
}