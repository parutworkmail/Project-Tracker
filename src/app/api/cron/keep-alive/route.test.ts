import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: queryRaw,
  },
}));

import { GET } from "./route";

function requestWithAuth(header?: string) {
  const headers = new Headers();
  if (header !== undefined) {
    headers.set("authorization", header);
  }
  return new Request("http://localhost/api/cron/keep-alive", { headers });
}

describe("GET /api/cron/keep-alive", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("runs the keep-alive query and returns ok when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(requestWithAuth());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.timestamp).toBe("string");
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when CRON_SECRET is set but the header is missing", async () => {
    process.env.CRON_SECRET = "s3cret";

    const response = await GET(requestWithAuth());

    expect(response.status).toBe(401);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is set but the header doesn't match", async () => {
    process.env.CRON_SECRET = "s3cret";

    const response = await GET(requestWithAuth("Bearer wrong"));

    expect(response.status).toBe(401);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("returns 200 when the bearer token matches CRON_SECRET", async () => {
    process.env.CRON_SECRET = "s3cret";

    const response = await GET(requestWithAuth("Bearer s3cret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});
