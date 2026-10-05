import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyPlanning,
  parsePlanning,
  toggleCompare,
  setChecklistStep,
  planningKey,
  createPlanningStore,
} from "../src/planning.ts";
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) || null,
    setItem: (key, value) => map.set(key, value),
  };
}
test("comparison survives reload, enforces three items, and allows removal", () => {
  const storage = memoryStorage(),
    key = planningKey("guest"),
    store = createPlanningStore(storage, key);
  for (const id of ["a", "b", "c"]) store.update((s) => toggleCompare(s, id));
  store.update((s) => toggleCompare(s, "d"));
  assert.deepEqual(store.getSnapshot().data.compareIds, ["a", "b", "c"]);
  assert.match(store.getSnapshot().message, /최대 3개/);
  const reloaded = createPlanningStore(storage, key);
  reloaded.update((s) => toggleCompare(s, "b"));
  reloaded.update((s) => toggleCompare(s, "d"));
  assert.deepEqual(reloaded.getSnapshot().data.compareIds, ["a", "c", "d"]);
});
test("checklist changes survive reload and remain scoped to user and benefit", () => {
  const storage = memoryStorage(),
    a = createPlanningStore(storage, planningKey("alice"));
  a.update((s) => setChecklistStep(s, "one", "documents", true));
  a.update((s) => setChecklistStep(s, "two", "submitted", true));
  assert.deepEqual(
    createPlanningStore(storage, planningKey("alice")).getSnapshot().data
      .checklists,
    { one: ["documents"], two: ["submitted"] },
  );
  for (const owner of ["bob", "guest"])
    assert.deepEqual(
      createPlanningStore(storage, planningKey(owner)).getSnapshot().data,
      emptyPlanning(),
    );
  a.update((s) => setChecklistStep(s, "one", "documents", false));
  assert.equal(a.getSnapshot().data.checklists.one, undefined);
});
test("a second tab preserves the first tab changes before writing", () => {
  const storage = memoryStorage(),
    key = planningKey("guest");
  const a = createPlanningStore(storage, key),
    b = createPlanningStore(storage, key);
  a.update((s) => toggleCompare(s, "one"));
  b.update((s) => setChecklistStep(s, "two", "schedule", true));
  a.reload();
  assert.deepEqual(a.getSnapshot().data.compareIds, ["one"]);
  assert.deepEqual(a.getSnapshot().data.checklists.two, ["schedule"]);
});
test("storage denial keeps progress in memory and reports it", () => {
  const store = createPlanningStore(
    {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("denied");
      },
    },
    planningKey("guest"),
  );
  store.update((s) => setChecklistStep(s, "one", "eligibility", true));
  store.update((s) => setChecklistStep(s, "one", "documents", true));
  assert.deepEqual(store.getSnapshot().data.checklists.one, [
    "eligibility",
    "documents",
  ]);
  assert.match(store.getSnapshot().message, /이번 방문/);
});
test("write quota failure does not discard prior in-memory progress", () => {
  const storage = memoryStorage();
  const store = createPlanningStore(storage, planningKey("guest"));
  store.update((s) => toggleCompare(s, "one"));
  storage.setItem = () => {
    throw Error("quota");
  };
  store.update((s) => toggleCompare(s, "two"));
  store.update((s) => toggleCompare(s, "three"));
  assert.deepEqual(store.getSnapshot().data.compareIds, [
    "one",
    "two",
    "three",
  ]);
  assert.match(store.getSnapshot().message, /저장하지 못했어요/);
});
test("malformed records, unknown steps and prototype keys are discarded", () => {
  assert.deepEqual(parsePlanning("{broken"), emptyPlanning());
  assert.deepEqual(parsePlanning('{"version":2}'), emptyPlanning());
  const parsed = parsePlanning(
    '{"version":1,"compareIds":["a","a",null,12,"b","c","d"],"checklists":{"a":["documents","documents","unknown",1],"__proto__":["submitted"],"constructor":["submitted"]}}',
  );
  assert.deepEqual(parsed.compareIds, ["a", "b", "c"]);
  assert.deepEqual(parsed.checklists, { a: ["documents"] });
  assert.equal(Object.prototype.submitted, undefined);
});
test("bounded progress storage does not evict existing records silently", () => {
  let state = emptyPlanning();
  for (let i = 0; i < 200; i++)
    state = setChecklistStep(state, String(i), "eligibility", true);
  assert.throws(
    () => setChecklistStep(state, "overflow", "documents", true),
    /최대 200개/,
  );
  state = setChecklistStep(state, "0", "eligibility", false);
  state = setChecklistStep(state, "overflow", "documents", true);
  assert.equal(Object.keys(state.checklists).length, 200);
  assert.deepEqual(state.checklists.overflow, ["documents"]);
});
