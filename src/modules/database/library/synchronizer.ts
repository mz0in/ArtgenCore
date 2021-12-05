import { DepGraph } from 'dependency-graph';
import { diff } from 'just-diff';
import { Knex } from 'knex';
import { isEqual } from 'lodash';
import { ILogger, Logger } from '../../../app/container';
import { FieldTag, FieldType, ISchema } from '../../schema';
import { RelationKind } from '../../schema/interface/relation.interface';
import { isPrimary } from '../../schema/util/field-tools';
import { IConnection } from '../interface';
import { toSchema } from '../transformer/to-schema';
import { toStructure } from '../transformer/to-structure';
import { Inspector } from './inspector';

interface ChangeStep {
  type: 'backup' | 'copy' | 'create' | 'constraint' | 'foreign' | 'drop';
  query: Knex.SchemaBuilder;
}

const fColumns = (s: ISchema) => (ref: string[]) =>
  s.fields.filter(f => ref.includes(f.reference)).map(f => f.columnName);

const getPKCols = (schema: ISchema) =>
  schema.fields.filter(isPrimary).map(f => f.columnName);

export class Synchronizer {
  constructor(
    @Logger()
    readonly logger: ILogger,
  ) {}

  protected async doAlterTable(
    schema: ISchema,
    link: IConnection,
    inspector: Inspector,
  ): Promise<ChangeStep[]> {
    const instructions: ChangeStep[] = [];

    const columns = await inspector.columns(schema.tableName);
    const foreignKeys = await inspector.foreignKeys(schema.tableName);
    const uniques = await inspector.uniques(schema.tableName);

    // TODO need to read the unique sets from the table
    const revSchema = toSchema(
      schema.database,
      schema.tableName,
      columns,
      foreignKeys,
      uniques,
      link,
    );

    const revStruct = toStructure(revSchema);
    const knownStruct = toStructure(schema);

    if (!isEqual(revStruct, knownStruct)) {
      // const alterQuery = connection.schema.table(schema.tableName, table => {});
      const changes = diff(revStruct, knownStruct);

      for (const change of changes) {
        // Field has been removed
        if (change.op === 'remove' && change.path[0] === 'fields') {
          instructions.push({
            type: 'drop',
            query: link.knex.schema.alterTable(schema.tableName, t =>
              t.dropColumn(revStruct.fields[change.path[1]].columnName),
            ),
          });
        }
      }

      console.log('Struct mismatch!', changes);
      console.log('Known', knownStruct);
      console.log('Reversed', revStruct);

      if (1) process.exit(1);
    }

    return instructions;
  }

  protected createTable(schema: ISchema, link: IConnection): ChangeStep[] {
    const instructions: ChangeStep[] = [];

    instructions.push({
      type: 'create',
      query: link.knex.schema.createTable(schema.tableName, table => {
        schema.fields.forEach(f => {
          let col: Knex.ColumnBuilder;

          switch (f.type) {
            case FieldType.BOOLEAN:
              col = table.boolean(f.columnName);
              break;
            case FieldType.DATETIME:
              col = table.datetime(f.columnName);
              break;
            case FieldType.DATEONLY:
              col = table.date(f.columnName);
              break;
            case FieldType.TIME:
              col = table.time(f.columnName);
              break;
            case FieldType.INTEGER:
              col = table.integer(
                f.columnName,
                (f.typeParams.length as number) ?? undefined,
              );
              break;
            case FieldType.JSON:
              col = table.json(f.columnName);
              break;
            case FieldType.TEXT:
              let textLength = 'text';

              switch (f.typeParams?.length) {
                case 'medium':
                  textLength = 'mediumtext';
                  break;
                case 'long':
                  textLength = 'longtext';
                  break;
              }

              col = table.text(f.columnName, textLength);
              break;
            case FieldType.UUID:
              col = table.uuid(f.columnName);
              break;
            case FieldType.STRING:
              col = table.string(f.columnName);
              break;
            case FieldType.BIGINT:
              col = table.bigInteger(f.columnName);
              break;
            case FieldType.TINYINT:
              col = table.tinyint(f.columnName);
              break;
            case FieldType.SMALLINT:
            case FieldType.MEDIUMINT:
              col = table.integer(f.columnName);
              break;
            case FieldType.FLOAT:
              col = table.float(f.columnName);
              break;
            case FieldType.REAL:
            case FieldType.DOUBLE:
              col = table.double(f.columnName);
              break;
            case FieldType.DECIMAL:
              col = table.decimal(
                f.columnName,
                f.typeParams.precision,
                f.typeParams.scale,
              );
              break;
            case FieldType.BLOB:
              col = table.binary(f.columnName);
              break;
            case FieldType.ENUM:
              col = table.enum(f.columnName, f.typeParams.values);
              break;
            case FieldType.JSONB:
              col = table.jsonb(f.columnName);
              break;
            case FieldType.HSTORE:
              col = table.specificType(f.columnName, 'HSTORE');
              break;
            case FieldType.CIDR:
              col = table.specificType(f.columnName, 'CIDR');
              break;
            case FieldType.INET:
              col = table.specificType(f.columnName, 'INET');
              break;
            case FieldType.MACADDR:
              col = table.specificType(f.columnName, 'MACADDR');
              break;
          }

          // Field modifiers
          if (f.typeParams.unsigned) {
            col = col.unsigned();
          }

          // Add nullable
          if (f.tags.includes(FieldTag.NULLABLE) || f.defaultValue === null) {
            col = col.nullable();
          } else {
            col = col.notNullable();
          }

          if (f.defaultValue !== undefined) {
            const defType = typeof f.defaultValue;

            switch (defType) {
              case 'boolean':
              case 'number':
              case 'string':
                col.defaultTo(f.defaultValue as string);
                break;
              case 'object':
                col.defaultTo(JSON.stringify(f.defaultValue));
                break;
            }
          }
        });
      }),
    });

    instructions.push({
      type: 'constraint',
      query: link.knex.schema.alterTable(schema.tableName, table => {
        schema.fields.forEach(f => {
          // Add index
          if (f.tags.includes(FieldTag.INDEX)) {
            table.index(f.columnName);
          }

          // Add unique
          if (f.tags.includes(FieldTag.UNIQUE)) {
            table.unique([f.columnName]);
          }
        });

        table.primary(getPKCols(schema));

        schema.uniques.forEach(unq => {
          table.unique(unq.fields);
        });
      }),
    });

    return instructions;
  }

  protected createRelations(schema: ISchema, link: IConnection): ChangeStep[] {
    return [
      {
        type: 'foreign',
        query: link.knex.schema.alterTable(schema.tableName, table => {
          schema.relations.forEach(rel => {
            /**
             * @example Product belongsTo Category, local field is Product.category_id remote field is Category.id
             * @example User hasOne Avatar, local field is User.id remote field is Avatar.user_id
             * @example Customer hasMany Order, local field is Customer.id remote field is Order.customer_id
             */
            if (rel.kind == RelationKind.BELONGS_TO_ONE) {
              const target = link.getSchema(rel.target);

              table
                .foreign(fColumns(schema)([rel.localField]))
                .references(fColumns(target)([rel.remoteField]))
                .inTable(target.tableName);
            }

            /**
             * @example Product hasManyThroughMany Orders through the OrderEntry, local field is Product.id -> OrderEntry.product_id && OrderEntry.order_id -> Order.id
             */
            if (rel.kind == RelationKind.BELONGS_TO_MANY) {
              // TODO implement
            }
          });
        }),
      },
    ];
  }

  protected getDependencyGraph(schemas: ISchema[]): DepGraph<void> {
    const dependencies: DepGraph<void> = new DepGraph({
      circular: true,
    });

    schemas.forEach(s => dependencies.addNode(s.reference));

    for (const localSchema of schemas) {
      if (localSchema.relations) {
        for (const rel of localSchema.relations) {
          const remoteSchema = schemas.find(s => s.reference === rel.target);

          if (rel.kind === RelationKind.BELONGS_TO_ONE) {
            dependencies.addDependency(
              localSchema.reference,
              remoteSchema.reference,
            );
          }
        }
      }
    }

    return dependencies;
  }

  async sync(link: IConnection) {
    const instructions: ChangeStep[] = [];

    // Reduce the associations to only the changed schemas.
    const changes: ISchema[] = Array.from(link.getAssications().values())
      .filter(association => !association.inSync)
      .map(association => association.schema);

    // Nothing has changed, skip early.
    if (!changes.length) {
      return;
    }

    // Dependency tree is used to remove foreign keys
    // when we drop a table we need to know if the any other table
    // is dependent on it. If so, then the user has to remove the dependency first.
    //
    // Or when we change a column and we plan to drop it, because the type will not match???
    // Or when the column is removed from the schema but still on the db!
    const dependencies = this.getDependencyGraph(changes);

    // TODO validate the schema for sanity,
    // - types match their foreign keys
    // - remote tables exits
    // - changed fields require conversion
    // - has unique
    // - index for foreign key in local
    // - unique for foreign key targe

    const inspector = new Inspector(link.knex);
    const currentTables = await inspector.tables();
    const isSchemaExits = (s: ISchema) => currentTables.includes(s.tableName);

    for (const schema of changes) {
      // Imported / protected schemas are not synchronized.
      if (!schema || schema.tags.includes('readonly')) {
        continue;
      }
      this.logger.debug('Synchornizing [%s] schema', schema.reference);

      if (!isSchemaExits(schema)) {
        instructions.push(...this.createTable(schema, link));
        instructions.push(...this.createRelations(schema, link));
      } else {
        instructions.push(
          ...(await this.doAlterTable(schema, link, inspector)),
        );
      }

      link.getAssications().get(schema.reference).inSync = true;
    }

    const order: ChangeStep['type'][] = [
      'backup',
      'copy',
      'create',
      'constraint',
      'foreign',
      'drop',
    ];

    for (const phase of order) {
      const queries = instructions
        .filter(i => i.type === phase)
        .map(i => i.query)
        .filter(q => !!q.toQuery());

      this.logger.info(
        'Phase [%s] with [%d] instruction',
        phase,
        queries.length,
      );

      queries.forEach(q => console.log('--SQL:\t', q.toQuery()));

      await Promise.all(queries);
    }

    this.logger.info('Synchronized');
  }
}