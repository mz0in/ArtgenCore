import { EventEmitter2 } from 'eventemitter2';
import { Knex } from 'knex';
import { isEqual } from 'lodash';
import { Model, ModelClass } from 'objection';
import { ILogger, Inject, Logger } from '../../../app/container';
import { Exception } from '../../../app/exceptions/exception';
import { ISchema } from '../../schema';
import { IConnection, IDatabase } from '../interface';
import { IAssociation } from '../interface/association.interface';
import { parseDialect } from './parser/parse-dialect';
import { Synchronizer } from './synchronizer';
import { toDialect } from './transformer/to-dialect';
import { addRelations, toModel } from './transformer/to-model';
import { toStructure } from './transformer/to-structure';

export class Connection implements IConnection {
  /**
   * Inner registry to track the schema associations and their synchronized structures
   */
  protected associations = new Map<string, IAssociation>();
  protected synchornizer: Synchronizer;

  constructor(
    @Logger()
    readonly logger: ILogger,
    @Inject(EventEmitter2)
    readonly eventBus: EventEmitter2,
    readonly knex: Knex,
    readonly database: IDatabase,
  ) {
    this.logger = this.logger.child({ scope: `Link:${this.getName()}` });
    this.synchornizer = new Synchronizer(
      this.logger.child({ scope: `Sync:${this.getName()}` }),
    );
  }

  getAssications() {
    return this.associations;
  }

  getName(): string {
    return this.database.name;
  }

  getModel<T extends Model = Model>(reference: string): ModelClass<T> {
    if (this.associations.has(reference)) {
      return this.associations.get(reference).model as ModelClass<T>;
    }

    throw new Exception(
      `Model [${reference}] is not associated with the [${this.getName()}] database`,
    );
  }

  getSchema(reference: string): ISchema {
    if (this.associations.has(reference)) {
      return this.associations.get(reference).schema;
    }

    throw new Exception(
      `Schema [${reference}] is not associated with the [${this.getName()}] database`,
    );
  }

  getSchemas(): ISchema[] {
    return Array.from(this.associations.values()).map(r => r.schema);
  }

  async associate(schemas: ISchema[]): Promise<IConnection> {
    const dialect = parseDialect(this.database.dsn);

    // Patch the schema for the dialect exceptions
    schemas = schemas.map(s => toDialect(s, dialect));

    for (const schema of schemas) {
      const key = schema.reference;
      const structure = toStructure(schema, dialect);

      // Check if the schema is already associated with the registry.
      if (this.associations.has(key)) {
        const association = this.associations.get(key);

        // Update the schema ref
        association.schema = schema;

        // Check if the structure has changed.
        if (!isEqual(association.structure, structure)) {
          this.logger.info(
            'Schema [%s] structure has changed',
            schema.reference,
          );

          association.structure = structure;
          association.inSync = false;
        }
      } else {
        const model = toModel(schema).bindKnex(this.knex);

        this.associations.set(key, { schema, structure, inSync: false, model });

        this.logger.info('Schema [%s] registered', schema.reference);
      }
    }

    // Map relations after the models are defined.
    for (const schema of schemas) {
      addRelations(this.getModel(schema.reference), schema, this);
    }

    await this.synchronize();

    return this;
  }

  /**
   * Synchronize the schemas with the database and the ORM.
   */
  protected async synchronize(): Promise<void> {
    await this.synchornizer.sync(this);

    this.eventBus.emit(`link.${this.database.name}.updated`, this);
  }

  close(): Promise<void> {
    this.logger.info('Closing the connection pool');

    return this.knex.destroy();
  }
}
