export type OpenMeteoApi = 'forecast' | 'marine' | 'elevation';

export type OpenMeteoErrorReason =
  /** The request did not end in the time limit. */
  | 'TIMEOUT'
  /** The request did not get a response (for example, no network). */
  | 'NETWORK'
  /** The API returned an HTTP status that is not 2xx. */
  | 'HTTP'
  /** The response does not have the expected shape. */
  | 'INVALID_RESPONSE';

export class OpenMeteoError extends Error {
  readonly api: OpenMeteoApi;
  readonly reason: OpenMeteoErrorReason;
  /** The HTTP status. Only for the reason HTTP. */
  readonly status: number | null;

  constructor({
    api,
    reason,
    message,
    status = null,
    cause,
  }: {
    api: OpenMeteoApi;
    reason: OpenMeteoErrorReason;
    message: string;
    status?: number | null;
    cause?: unknown;
  }) {
    super(`${api}: ${message}`, { cause });
    this.name = 'OpenMeteoError';
    this.api = api;
    this.reason = reason;
    this.status = status;
  }

  /**
   * A retry can help after a time-out, a network failure, a server failure
   * (5xx) or too many requests (429). It cannot help after other 4xx statuses
   * or an incorrect response.
   */
  get retryable(): boolean {
    if (this.reason === 'TIMEOUT' || this.reason === 'NETWORK') return true;
    if (this.reason === 'HTTP' && this.status !== null) {
      return this.status >= 500 || this.status === 429;
    }
    return false;
  }
}
