import { JSONSchema7Definition } from 'json-schema';
import { FieldTag, FieldType, ICollection } from '../../collection';
import {
  isAutoGenerated,
  isCapability,
} from '../../collection/util/field-tools';
import { ContentAction } from '../interface/content-action.enum';

export const schemaToJsonSchema = (
  schema: ICollection,
  action: ContentAction,
): JSONSchema7Definition => {
  const jschema: JSONSchema7Definition = {
    type: 'object',
    properties: {},
    required: [],
  };

  const mode =
    action === ContentAction.CREATE || action === ContentAction.UPDATE
      ? 'write'
      : 'read';

  for (const field of schema.fields) {
    if (mode === 'write') {
      // Primary UUID is auto generated
      if (isAutoGenerated(field) && action === ContentAction.CREATE) {
        continue;
      }

      // Created At / Updated At / Deleted At field is auto managed
      if (isCapability(field)) {
        continue;
      }
    }

    const fieldDef: JSONSchema7Definition = {
      title: field.label,
      type: 'string',
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
        fieldDef.type = undefined;
        break;
    }

    if (field.type === FieldType.ENUM) {
      fieldDef.enum = field.typeParams.values;
    }

    jschema.properties[field.reference] = fieldDef;

    // Required if not nullable
    if (!field.tags.includes(FieldTag.NULLABLE)) {
      jschema.required.push(field.reference);
    }
  }

  return jschema;
};
