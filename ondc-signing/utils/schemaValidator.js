// utils/schemaValidator.js
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs/promises';
import path from 'node:path';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const SCHEMAS_DIR = path.resolve('./schemas'); // Assuming your schemas are in a 'schemas' directory at the project root

async function loadSchema(schemaName) {
  try {
    const schemaPath = path.join(SCHEMAS_DIR, `${schemaName}.json`);
    const schemaContent = await fs.readFile(schemaPath, 'utf8');
    return JSON.parse(schemaContent);
  } catch (error) {
    console.error(`Error loading schema '${schemaName}':`, error);
    return null;
  }
}

export const validateSchema = async (data, schemaName) => {
  const schema = await loadSchema(schemaName);
  if (!schema) {
    return { valid: false, errors: [{ message: `Schema '${schemaName}' not found.` }] };
  }
  const validate = ajv.compile(schema);
  const valid = validate(data);
  return { valid, errors: validate.errors };
};