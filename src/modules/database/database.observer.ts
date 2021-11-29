import { ILogger, Inject, Logger } from '../../app/container';
import { getErrorMessage } from '../../app/kernel';
import { Observer, On } from '../event';
import { ISchema } from '../schema';
import { SchemaService } from '../schema/service/schema.service';
import { IDatabase } from './interface';
import { LinkService } from './service/link.service';

@Observer()
export class DatabaseObserver {
  constructor(
    @Logger()
    readonly logger: ILogger,
    @Inject(LinkService)
    readonly linkService: LinkService,
    @Inject(SchemaService)
    readonly schemaService: SchemaService,
  ) {}

  @On('crud.system.Schema.created')
  async handleSchemaCreate(schema: ISchema) {
    this.logger.warn('New schema created! [%s]', schema.reference);

    try {
      const link = this.linkService.findByName(schema.database);
      const schemas = link.getSchemas();

      this.schemaService.registry.push(schema);
      await link.setSchemas([...schemas, schema]);
    } catch (error) {
      this.logger.error(getErrorMessage(error));
    }
  }

  @On('crud.system.Schema.updated')
  async handleSchemaUpdate(schema: ISchema) {
    this.logger.warn('Schema changed! [%s]', schema.reference);

    try {
      const link = this.linkService.findByName(schema.database);
      await link.setSchemas(link.getSchemas());
    } catch (error) {
      this.logger.error(getErrorMessage(error));
    }
  }

  @On('crud.system.Schema.deleted')
  async handleSchemaDelete(schema: ISchema) {
    this.logger.warn('Schema delete! [%s]', schema.reference);

    try {
      const link = this.linkService.findByName(schema.database);
      // Delete the table
      await link.connection.getQueryInterface().dropTable(schema.tableName);
    } catch (error) {
      this.logger.error(getErrorMessage(error));
    }
  }

  @On('crud.system.Database.created')
  async handleDatabaseCreate(database: IDatabase) {
    this.logger.warn('New database created! [%s]', database.name);

    try {
      const link = await this.linkService.create(database, []);
      const schemas = await this.linkService.discover(link);

      for (const schema of schemas) {
        await this.schemaService
          .create(schema)
          .catch(e => this.logger.error(getErrorMessage(e)));
      }
    } catch (error) {
      this.logger.error(getErrorMessage(error));
    }
  }

  @On('crud.system.Database.deleted')
  async handleDatabaseDelete(database: IDatabase) {
    this.logger.warn('Database [%s] deleted', database.name);

    try {
      const link = this.linkService.findByName(database.name);

      if (link) {
        await link.close();
      }

      this.logger.info('Link [%s] closed', database.name);

      // Refresh the schema cache
      await this.schemaService.findAll();
    } catch (error) {
      this.logger.error(getErrorMessage(error));
    }
  }
}
