import { snakeCase, startCase } from 'lodash';
import camelCase from 'lodash.camelcase';
import { FieldTag, FieldType, IField, ISchema } from '..';
import { migrateField } from './migrate-field';

const createNew = (name: string) =>
  migrateField({
    reference: camelCase(name),
    columnName: snakeCase(name),
    title: startCase(name),
    type: FieldType.TEXT,
    defaultValue: null,
    meta: {},
    args: {},
    tags: [],
  });

export const isPrimary = (field: IField) =>
  field.tags.includes(FieldTag.PRIMARY);

export const isText = (field: IField) =>
  field.type === FieldType.TEXT || field.type === FieldType.BLOB;

export const isJson = (field: IField) =>
  field.type === FieldType.JSON ||
  field.type === FieldType.JSONB ||
  field.type == FieldType.HSTORE;

export const isDate = (field: IField) =>
  field.type === FieldType.DATEONLY || field.type === FieldType.DATETIME;

export const isNullable = (field: IField) =>
  field.tags.includes(FieldTag.NULLABLE);

export const isAutoGenerated = (field: IField) => {
  if (isPrimary(field)) {
    if (field.type === FieldType.UUID || field.type === FieldType.INTEGER) {
      return true;
    }
  }

  return false;
};

const hasDefaultValue = (field: IField) =>
  typeof field.defaultValue !== 'undefined';

export const isInteger = (field: IField) =>
  field.type == FieldType.BIGINT ||
  field.type == FieldType.INTEGER ||
  field.type == FieldType.MEDIUMINT ||
  field.type == FieldType.SMALLINT ||
  field.type == FieldType.TINYINT;

const isNumber = (field: IField) =>
  isInteger(field) ||
  field.type === FieldType.DECIMAL ||
  field.type === FieldType.FLOAT;

export const isManagedField = (field: IField) =>
  field.tags.includes(FieldTag.CREATED) ||
  field.tags.includes(FieldTag.UPDATED) ||
  field.tags.includes(FieldTag.VERSION) ||
  field.tags.includes(FieldTag.DELETED);

export const isCapability = (field: IField) =>
  field.tags.includes(FieldTag.CREATED) ||
  field.tags.includes(FieldTag.UPDATED) ||
  field.tags.includes(FieldTag.VERSION) ||
  field.tags.includes(FieldTag.TAGS) ||
  field.tags.includes(FieldTag.DELETED);

export const isIndexed = (field: IField) =>
  field.tags.includes(FieldTag.PRIMARY) ||
  field.tags.includes(FieldTag.INDEX) ||
  field.tags.includes(FieldTag.UNIQUE);

export const getTakenColumNames = (schema: ISchema) => [
  ...schema.fields.map(field => field.columnName), // Locked in the table
  ...schema.fields.map(field => field.reference), // Locked in the JSON
  ...schema.relations.map(r => r.localField), // Locked in the table
  ...schema.relations.map(r => r.name), // Locked in the JSON
];

export const FieldTool = {
  isPrimary,
  isText,
  isNullable,
  isAutoGenerated,
  isManagedField,
  isCapability,
  isIndexed,
  isInteger,
  hasDefaultValue,
  isJson,
  isDate,
  isNumber,
  fReference: (ref: string) => (f: IField) => f.reference === ref,
  createNew,
};
