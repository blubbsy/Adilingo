import { translateUnsafe, type MessageKey, type MessageVars, type TFunction } from './index';

/** A message the UI can show in any language: the key plus its variables, optionally caused by another error. */
export interface LocalizedMessage {
  key: MessageKey;
  vars?: MessageVars;
  /** The underlying error; its text fills the `{reason}` variable. */
  cause?: unknown;
}

/**
 * An error whose user-facing text depends on the interface language. Utilities throw it instead of an
 * English `Error`; `.message` stays English for logs, the UI renders it with `errorText(t, error)`.
 */
export class LocalizedError extends Error implements LocalizedMessage {
  readonly key: MessageKey;
  readonly vars?: MessageVars;
  readonly cause?: unknown;

  constructor(key: MessageKey, vars?: MessageVars, cause?: unknown) {
    super(translateUnsafe('en', key, vars));
    this.name = 'LocalizedError';
    this.key = key;
    this.vars = vars;
    this.cause = cause;
  }
}

/** Text of any thrown value in the interface language (falls back to the plain message). */
export function errorText(t: TFunction, error: unknown): string {
  if (error instanceof LocalizedError) return describeMessage(t, error);
  if (error instanceof Error) return error.message;
  return String(error);
}

export function describeMessage(t: TFunction, message: LocalizedMessage): string {
  const reason = message.cause === undefined ? undefined : errorText(t, message.cause);
  return t(message.key, reason === undefined ? message.vars : { ...message.vars, reason });
}
