import { Pool, type PoolClient } from "pg";

// Time allowed to establish ONE database connection. A normal connect takes
// about 1-2 s, so this only trips on a hang like a silently dropped TLS hello.
export const CONNECT_TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 250;

const RETRYABLE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
]);

const RETRYABLE_MESSAGES =
  /timeout exceeded when trying to connect|connection terminated due to connection timeout|connection terminated unexpectedly/i;

// Only errors raised while ACQUIRING a connection qualify. At that point no
// query has been sent, so retrying can never run a write twice. Wrong
// password, unknown database and SQL errors are never retried.
export function isRetryableConnectError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as { code?: unknown }).code;

  if (typeof code === "string" && RETRYABLE_CODES.has(code)) {
    return true;
  }

  return RETRYABLE_MESSAGES.test(error.message);
}

export async function withConnectRetry<T>(
  attempt: () => Promise<T>,
  delayMs: number = RETRY_DELAY_MS
): Promise<T> {
  try {
    return await attempt();
  } catch (error) {
    if (!isRetryableConnectError(error)) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return attempt();
  }
}

type ConnectCallback = (
  error: Error | undefined,
  client: PoolClient | undefined,
  done: (release?: unknown) => void
) => void;

export class RetryingPool extends Pool {
  connect(): Promise<PoolClient>;
  connect(callback: ConnectCallback): void;
  connect(callback?: ConnectCallback): Promise<PoolClient> | void {
    if (!callback) {
      return withConnectRetry(() => super.connect());
    }

    super.connect((error, client, done) => {
      if (error && isRetryableConnectError(error)) {
        setTimeout(() => super.connect(callback), RETRY_DELAY_MS);
        return;
      }

      callback(error, client, done);
    });
  }
}
