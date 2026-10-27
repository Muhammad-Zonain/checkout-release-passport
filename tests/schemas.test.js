import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

test("every published JSON schema is syntactically valid JSON", async () => {
  const names = (await readdir(new URL("../schemas/", import.meta.url)))
    .filter((name) => name.endsWith(".json"));
  assert.ok(names.length >= 5);
  for (const name of names) {
    const raw = await readFile(new URL(`../schemas/${name}`, import.meta.url), "utf8");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.$schema, "https://json-schema.org/draft/2020-12/schema");
  }
});
