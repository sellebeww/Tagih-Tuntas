import { expect, it, vi } from "vitest";

it("hosted mode loads the DB from the key-value store and writes mutations back", async () => {
  vi.stubEnv("KV_REST_API_URL", "https://kv.example");
  vi.stubEnv("KV_REST_API_TOKEN", "t");
  const kv = new Map<string, string>();
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const [, op, key] = new URL(url).pathname.split("/");
    if (op === "set") kv.set(key, init.body as string);
    return Response.json({ result: kv.get(key) ?? null });
  });
  const store = await import("../src/server/store");
  const first = await store.withDB(() => store.read());
  expect(kv.size).toBe(1);
  await store.withDB(() => store.mutate({ action: "reset" }));
  expect(JSON.parse([...kv.values()][0]).invoices).toHaveLength(
    first.invoices.length,
  );
  const again = await store.withDB(() => store.read());
  expect(again.invoices).toHaveLength(first.invoices.length);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
