import test from "node:test";
import assert from "node:assert/strict";
import { createRemotePlanningStore } from "../src/remotePlanning.ts";
import { emptyPlanning, mergePlanning, toggleCompare, setChecklistStep } from "../src/planning.ts";
const response = (revision, data, status = 200) => new Response(JSON.stringify({ revision, data }), { status });
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("account edits persist, reload on another device, and import without clearing progress", async () => {
  let data = emptyPlanning(), revision = 0;
  const request = async (method, body, signal, importing) => {
    if (method === "PUT") {
      assert.equal(body.revision, revision);
      data = body.data; revision++;
    } else if (importing) { data = mergePlanning(data, body); revision++; }
    return response(revision, data);
  };
  const first = createRemotePlanningStore(request);
  first.start(); await tick();
  await first.update((s) => toggleCompare(s, "a"));
  await first.update((s) => setChecklistStep(s, "a", "eligibility", true));
  const second = createRemotePlanningStore(request);
  second.start(); await tick();
  assert.deepEqual(second.getSnapshot().data, first.getSnapshot().data);
  await second.importData({ version: 1, compareIds: ["a", "b"], checklists: { a: ["documents"] } });
  await first.reload();
  assert.deepEqual(first.getSnapshot().data.compareIds, ["a", "b"]);
  assert.deepEqual(first.getSnapshot().data.checklists.a, ["eligibility", "documents"]);
});

test("a stale device cannot overwrite newer progress and is prompted to retry", async () => {
  const latest = { version: 1, compareIds: ["other"], checklists: { other: ["documents"] } };
  let reads = 0;
  const store = createRemotePlanningStore(async (method) => method === "PUT"
    ? response(0, emptyPlanning(), 409)
    : response(reads++ ? 2 : 0, reads > 1 ? latest : emptyPlanning()));
  store.start(); await tick();
  await store.update((s) => toggleCompare(s, "stale"));
  assert.deepEqual(store.getSnapshot().data, latest);
  assert.match(store.getSnapshot().message, /다른 기기/);
});

test("failed saves preserve confirmed progress and permit a retry", async () => {
  let fail = true;
  const store = createRemotePlanningStore(async (method, body) => method === "GET"
    ? response(0, emptyPlanning())
    : fail ? new Response("", { status: 503 }) : response(1, body.data));
  store.start(); await tick();
  await store.update((s) => toggleCompare(s, "a"));
  assert.deepEqual(store.getSnapshot().data.compareIds, []);
  assert.equal(store.getSnapshot().busy, false);
  assert.match(store.getSnapshot().message, /다시 시도/);
  fail = false;
  await store.update((s) => toggleCompare(s, "a"));
  assert.deepEqual(store.getSnapshot().data.compareIds, ["a"]);
});

test("logout discards late account responses and StrictMode restart can load again", async () => {
  let finish;
  const store = createRemotePlanningStore(() => new Promise((resolve) => { finish = resolve; }));
  store.start(); store.stop();
  finish(response(4, { version: 1, compareIds: ["private"], checklists: {} }));
  await tick();
  assert.deepEqual(store.getSnapshot().data, emptyPlanning());
  store.start(); finish(response(0, emptyPlanning())); await tick();
  assert.equal(store.getSnapshot().ready, true);
});

test("import overflow is explicit and does not silently discard a selection", () => {
  const previous = { version: 1, compareIds: ["a", "b", "c"], checklists: {} };
  assert.throws(() => mergePlanning(previous, { version: 1, compareIds: ["d"], checklists: {} }), /3개/);
  assert.deepEqual(previous.compareIds, ["a", "b", "c"]);
});
