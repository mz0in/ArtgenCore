import { JSONSchema7Definition } from 'json-schema';
import { FieldTag } from '../../database/types/field-tags.enum';
import { FieldType } from '../../database/types/field-type.enum';
import { ISchema } from '../../database/types/schema.interface';
import {
  isAutoGenerated,
  isCapability,
} from '../../database/utils/field-tools';
import { CrudAction } from '../../rest/interface/crud-action.enum';

export const schemaToJsonSchema = (
  schema: ISchema,
  action: CrudAction,
  forForm: boolean = false,
): JSONSchema7Definition => {
  const jschema: JSONSchema7Definition = {
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
      if (isAutoGenerated(field) && action === CrudAction.CREATE) {
        continue;
      }

      // Created At / Updated At / Deleted At field is auto managed
      if (isCapability(field)) {
        continue;
      }
    }

    const fieldDef: JSONSchema7Definition = {
      title: field.title,
      readOnly: isAutoGenerated(field) && mode === 'write',
      default: field.defaultValue as any,
    };

    switch (field.type) {
      case FieldType.BOOLEAN:
        fieldDef.type = 'boolean';
        fieldDef.default = false;
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
        fieldDef.default = field.defaultValue as any;
        break;
      case FieldType.JSON:
      case FieldType.JSONB:
        fieldDef.type = 'string';
        break;
      default:
        fieldDef.type = 'string';
    }

    if (field.type === FieldType.ENUM) {
      if (field.args?.values) {
        fieldDef.enum = field.args.values;
      } else {
        fieldDef.enum = [];
      }
    }

    if (field.tags.includes(FieldTag.NULLABLE)) {
      if (forForm) {
        fieldDef.type = [fieldDef.type as any, 'null'];
      } else {
      }
    }

    jschema.properties[field.reference] = fieldDef;

    // Required if not nullable
    if (!field.tags.includes(FieldTag.NULLABLE)) {
      jschema.required.push(field.reference);
    }
  }

  return jschema;
};
