import { EventEmitter2 } from 'eventemitter2';
import { Model, ModelClass } from 'objection';
import { ILogger, Inject, Logger, Service } from '../../../app/container';
import { IExtension } from '../../blueprint/interface/extension.interface';
import { SystemExtensionProvider } from '../../blueprint/provider/system-extension.provider';
import { IConnection } from '../../database/interface';
import { ConnectionService } from '../../database/service/connection.service';
import { ICollection } from '../interface/schema.interface';
import { MigrationService } from './migration.service';

type CollectionModel = ICollection & Model;

@Service()
export class CollectionService {
  /**
   * In memory cache to access schemas.
   */
  registry: ICollection[] = [];

  constructor(
    @Logger()
    readonly logger: ILogger,
    @Inject(ConnectionService)
    readonly linkService: ConnectionService,
    @Inject(EventEmitter2)
    readonly event: EventEmitter2,
    @Inject(MigrationService)
    readonly migrator: MigrationService,
    @Inject(SystemExtensionProvider)
    readonly sysExt: IExtension,
  ) {}

  /**
   * Synchronize the offline system schemas into the database, this allows the user
   * to extend on the system's behavior, the synchronizer will only ensure the
   * existence of the schema and does not overide it if its present.
   */
  async synchronize(link: IConnection) {
    // Get the schema repository.
    const model = this.getModel<CollectionModel>('system', 'Schema');

    for (const schema of link.getSchemas()) {
      const exists = await model.query().findOne({
        database: schema.database,
        reference: schema.reference,
      });

      if (!exists) {
        await model.query().insert(schema);
      }

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
  getSystem(): ICollection[] {
    return this.sysExt.schemas.map(s => this.migrator.migrate(s));
  }

  /**
   * Fetch the newest schemas from the database, and use this opportunity to
   * ensure the local cache is up to date.
   */
  async findAll(): Promise<ICollection[]> {
    const schemas = await this.getModel<CollectionModel>(
      'system',
      'Schema',
    ).query();

    // Update the schemas, in case the database schema is not migrated.
    this.registry = schemas.map(s => this.migrator.migrate(s.$toJson()));

    return this.registry;
  }

  /**
   * Get the repository for the given database and schema.
   */
  getModel<T extends Model = Model>(
    database: string,
    schema: string,
  ): ModelClass<T> {
    return this.linkService.findOne(database).getModel<T>(schema);
  }

  findByDatabase(database: string) {
    return this.registry.filter(s => s.database === database);
  }

  findOne(database: string, reference: string): ICollection {
    return this.registry.find(
      s => s.database === database && s.reference === reference,
    );
  }

  async create(schema: ICollection) {
    const model = this.getModel<CollectionModel>('system', 'Schema');
    await model.query().insert(schema);

    this.registry.push(schema);
    this.event.emit('schema.created', schema);

    return schema;
  }

  async update(update: ICollection) {
    const model = this.getModel<CollectionModel>('system', 'Schema');
    const record = await model.query().findOne({
      database: update.database,
      reference: update.reference,
    });

    record.$set(update);

    await model.query().patch(record);

    this.registry.splice(
      this.registry.findIndex(
        s => s.database === update.database && s.reference === update.reference,
      ),
      1,
      record.$toJson(),
    );

    this.event.emit('schema.updated', record);

    return record;
  }
}