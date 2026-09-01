import { Priority } from '@prisma/client';

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Trims a string value. Returns empty string if value is null/undefined.
 */
export function trimField(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

/**
 * Validates Summary field — BR-08.
 * Required, 1–200 chars after trimming.
 */
export function validateSummary(value: unknown): FieldError | null {
  const trimmed = trimField(value);
  if (trimmed.length === 0) {
    return { field: 'summary', message: 'Summary is required.' };
  }
  if (trimmed.length > 200) {
    return { field: 'summary', message: 'Summary must not exceed 200 characters.' };
  }
  return null;
}

/**
 * Validates Description field — BR-09.
 * Required, 1–2000 chars after trimming.
 */
export function validateDescription(value: unknown): FieldError | null {
  const trimmed = trimField(value);
  if (trimmed.length === 0) {
    return { field: 'description', message: 'Description is required.' };
  }
  if (trimmed.length > 2000) {
    return { field: 'description', message: 'Description must not exceed 2000 characters.' };
  }
  return null;
}

/**
 * Validates Requested Priority field — BR-11.
 * Must be one of the Priority enum values.
 */
export function validateRequestedPriority(value: unknown): FieldError | null {
  const allowed: string[] = Object.values(Priority);
  if (typeof value !== 'string' || !allowed.includes(value)) {
    return {
      field: 'requestedPriority',
      message: 'Priority must be LOW, MEDIUM, HIGH, or CRITICAL.',
    };
  }
  return null;
}

/**
 * Validates categoryId — BR-12.
 * Must be a positive integer.
 */
export function validateCategoryId(value: unknown): FieldError | null {
  const num = Number(value);
  if (!value || !Number.isInteger(num) || num < 1) {
    return { field: 'categoryId', message: 'Category is required.' };
  }
  return null;
}

/**
 * Validates requesterId — BR-14.
 * Must be a positive integer.
 */
export function validateRequesterId(value: unknown): FieldError | null {
  const num = Number(value);
  if (!value || !Number.isInteger(num) || num < 1) {
    return { field: 'requesterId', message: 'Requester is required.' };
  }
  return null;
}

/**
 * Converts a fields array into a plain object map for the error response.
 */
export function buildFieldsMap(errors: FieldError[]): Record<string, string> {
  return Object.fromEntries(errors.map((e) => [e.field, e.message]));
}
