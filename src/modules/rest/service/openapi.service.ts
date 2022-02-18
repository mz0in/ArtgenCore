import { FastifySchema } from 'fastify';
import { JSONSchema7Definition, JSONSchema7Object } from 'json-schema';
import { kebabCase } from 'lodash';
import { OpenAPIV3 } from 'openapi-types';
import { Inject, Service } from '../../../app/container';
import { FieldType, ISchema } from '../../schema';
import { FieldTool, isPrimary } from '../../schema/util/field-tools';
import { VersionProvider } from '../../upgrade/provider/version.provider';
import { UpgradeService } from '../../upgrade/upgrade.service';
import { CrudAction } from '../interface/crud-action.enum';

@Service()
export class OpenApiService {
  constructor(
    @Inject(UpgradeService)
    readonly upgradeService: UpgradeService,
    @Inject(VersionProvider)
    readonly localVersion: string,
  ) {}

  getDocument(): Partial<OpenAPIV3.Document> {
    return {
      info: {
        title: 'Artgen Core - API',
        description: 'Http Upstream Server Documentation',
        version: this.localVersion,
      },
      components: {
        securitySchemes: {
          jwt: {
            type: 'http',
            scheme: 'bearer',
            description:
              'Json Web Token transported in the Authentication headers',
          },
          accessKeyQuery: {
            type: 'apiKey',
            in: 'query',
            name: 'access-key',
            description: 'Access Key identification in the query param',
          },
          accessKeyHeader: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Access-Key',
            description: 'Access Key identification in the HTTP header',
          },
        },
      },
      tags: [
        {
          name: 'Rest',
          description: 'Rest structured endpoints',
        },
        {
          name: 'Flow',
          description: 'Flow defined HTTP triggers',
        },
      ],
    };
  }

  getResourceURL(schema: ISchema, cause: string = 'rest'): string {
    return `/api/${cause}/${kebabCase(schema.database)}/${kebabCase(
      schema.reference,
    )}`;
  }

  getRecordURL(schema: ISchema) {
    const primaryKeys = schema.fields.filter(isPrimary);
    const record =
      '/:' + primaryKeys.map(f => kebabCase(f.reference)).join('/:');

    return this.getResourceURL(schema) + record;
  }

  toFastifySchema(schema: ISchema, action: CrudAction): FastifySchema {
    let isProtected: boolean = true;

    switch (action) {
      case CrudAction.CREATE:
        isProtected = schema.access.create !== 'public';
        break;
      case CrudAction.READ:
      case CrudAction.FIND:
        isProtected = schema.access.read !== 'public';
        break;
      case CrudAction.UPDATE:
        isProtected = schema.access.update !== 'public';
        break;
      case CrudAction.DELETE:
        isProtected = schema.access.delete !== 'public';
        break;
    }

    const definition: FastifySchema = {
      tags: ['Rest'],
      security: isProtected
        ? [
            {
              jwt: [],
              accessKeyQuery: [],
              accessKeyHeader: [],
            },
          ]
        : [],
      response: {
        401: this.getUnauthorizedResponseSchema(),
      },
    };

    switch (action) {
      case CrudAction.CREATE:
        definition.response[400] = this.getBadRequestResponseSchema();
        definition.response[201] = {
          description: 'Created',
          ...(this.getJsonSchema(schema, CrudAction.READ) as JSONSchema7Object),
        };
        definition.body = this.getJsonSchema(schema, CrudAction.CREATE);
        break;

      case CrudAction.READ:
        definition.response[400] = this.getBadRequestResponseSchema();
        definition.response[404] = this.getNotFoundResponseSchema();
        definition.response[200] = {
          description: 'OK',
          ...(this.getJsonSchema(schema, CrudAction.READ) as JSONSchema7Object),
        };
        definition.params = this.getUrlParamsSchema(schema);
        break;

      case CrudAction.FIND:
        definition.response[400] = this.getBadRequestResponseSchema();
        definition.response[200] = {
          description: 'OK',
          ...(this.getJsonSchema(schema, CrudAction.FIND) as JSONSchema7Object),
        };
        break;

      case CrudAction.UPDATE:
        definition.response[400] = this.getBadRequestResponseSchema();
        definition.response[404] = this.getNotFoundResponseSchema();
        definition.response[200] = {
          description: 'OK',
          ...(this.getJsonSchema(schema, CrudAction.READ) as JSONSchema7Object),
        };
        definition.body = this.getJsonSchema(schema, CrudAction.CREATE);
        definition.params = this.getUrlParamsSchema(schema);
        break;

      case CrudAction.DELETE:
        definition.response[400] = this.getBadRequestResponseSchema();
        definition.response[404] = this.getNotFoundResponseSchema();
        definition.response[200] = {
          description: 'OK',
          ...(this.getJsonSchema(schema, CrudAction.READ) as JSONSchema7Object),
        };
        definition.params = this.getUrlParamsSchema(schema);
        break;
    }

    return definition;
  }

  getJsonSchema(schema: ISchema, action: CrudAction): JSONSchema7Definition {
    let jschema: JSONSchema7Definition = {
      type: 'object',
      properties: {},
      required: [],
    };

    const mode =
      action === CrudAction.CREATE || action === CrudAction.UPDATE
        ? 'write'
        : 'read';

    for (const field of schema.fields) {
      if (mode === 'write') {
        // Primary UUID is auto generated
        if (FieldTool.isAutoGenerated(field) && action === CrudAction.CREATE) {
          continue;
        }

        // Created At / Updated At / Deleted At field is auto managed
        if (FieldTool.isCapability(field)) {
          continue;
        }
      }

      const isNullable = FieldTool.isNullable(field);

      const fieldDef: JSONSchema7Definition = {
        title: field.title,
        readOnly: FieldTool.isAutoGenerated(field) && mode === 'write',
        default: field.defaultValue as any,
      };

      switch (field.type) {
        case FieldType.BOOLEAN:
          fieldDef.type = 'boolean';
          break;
        case FieldType.BIGINT:
        case FieldType.TINYINT:
        case FieldType.SMALLINT:
        case FieldType.MEDIUMINT:
        case FieldType.FLOAT:
        case FieldType.REAL:
        case FieldType.DOUBLE:
        case FieldType.DECIMAL:
        case FieldType.INTEGER:
          fieldDef.type = 'number';
          break;
        case FieldType.JSON:
        case FieldType.JSONB:
          fieldDef.oneOf = [
            {
              type: 'object',
            },
            {
              type: 'array',
            },
            {
              type: 'string',
            },
            {
              type: 'number',
            },
          ];

          if (isNullable) {
            for (const one of fieldDef.oneOf) {
              one['nullable'] = true;
            }
          }
          break;
        case FieldType.ENUM:
          if (field.args?.values) {
            fieldDef.enum = field.args.values;
          } else {
            fieldDef.enum = [];
          }
          break;

        default:
          fieldDef.type = 'string';
      }

      if (isNullable) {
        if (fieldDef.type) {
          fieldDef['nullable'] = true;
          fieldDef.type = ['null', fieldDef.type as any];
        }
      }

      jschema.properties[field.reference] = fieldDef;

      // Required if not nullable, or does not have defaultValue
      if (!isNullable && !FieldTool.hasDefaultValue(field)) {
        jschema.required.push(field.reference);
      }

      if (FieldTool.isAutoGenerated(field) || FieldTool.isPrimary(field)) {
        jschema.readOnly = true;
      }
    }

    if (action === CrudAction.FIND) {
      jschema = {
        type: 'object',
        properties: {
          meta: {
            type: 'object',
            properties: {
              total: {
                type: 'number',
              },
            },
          },
          data: {
            type: 'array',
            items: jschema,
          },
        },
        required: ['meta', 'data'],
      };
    }

    return jschema;
  }

  protected getUrlParamsSchema(schema: ISchema): JSONSchema7Definition {
    const primaryKeys = schema.fields.filter(isPrimary);
    const definition: JSONSchema7Definition = {
      type: 'object',
      properties: {},
      required: primaryKeys.map(pk => kebabCase(pk.reference)),
    };

    primaryKeys.forEach(
      pk =>
        (definition.properties[kebabCase(pk.reference)] = {
          title: pk.title,
          type: 'string',
        }),
    );

    return definition;
  }

  protected getUnauthorizedResponseSchema(): JSONSchema7Definition {
    return {
      description: 'Request is not authenticated',
      type: 'object',
      properties: {
        error: {
          type: 'string',
          default: 'Unauthorized',
        },
        statusCode: {
          type: 'number',
          default: 401,
        },
      },
    };
  }

  protected getBadRequestResponseSchema(): JSONSchema7Definition {
    return {
      description: 'Request input is not valid',
      type: 'object',
      properties: {
        error: {
          type: 'string',
          default: 'Bad Request',
        },
        statusCode: {
          type: 'number',
          default: 400,
        },
      },
    };
  }

  protected getNotFoundResponseSchema(): JSONSchema7Definition {
    return {
      description: 'Resource not found',
      type: 'object',
      properties: {
        error: {
          type: 'string',
          default: 'Not found',
        },
        statusCode: {
          type: 'number',
          default: 404,
        },
      },
    };
  }
}
