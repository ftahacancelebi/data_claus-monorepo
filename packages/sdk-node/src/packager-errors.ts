export type PackagerErrorCode = 'AUTH' | 'VALIDATION' | 'API' | 'NETWORK';

export class PackagerError extends Error {
  public readonly code: PackagerErrorCode;
  public readonly cause?: unknown;

  constructor(code: PackagerErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'PackagerError';
    this.code = code;
    this.cause = cause;
    // Restore prototype chain for `instanceof` across ES5 targets.
    Object.setPrototypeOf(this, PackagerError.prototype);
  }
}
