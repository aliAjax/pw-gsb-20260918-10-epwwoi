// 对真实 useWorkbench hook 做端到端测试（react-test-renderer，无需浏览器 DOM）
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useWorkbench } from "../src/useWorkbench";
import { SEED_GEMS } from "../src/data";

// ---- localStorage shim ----
const mem = new Map<string, string>();
const ls = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
} as unknown as Storage;
Object.defineProperty(globalThis, "localStorage", { value: ls, configurable: true });
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) pass++;
  else {
    fail++;
    console.error("✘ " + msg);
  }
}

function mount() {
  const holder: { wb?: ReturnType<typeof useWorkbench>; renderer?: TestRenderer.ReactTestRenderer } = {};
  function Probe() {
    holder.wb = useWorkbench();
    return null;
  }
  act(() => {
    holder.renderer = TestRenderer.create(React.createElement(Probe));
  });
  return {
    holder,
    get wb() {
      return holder.wb!;
    },
    unmount: () => act(() => holder.renderer!.unmount()),
  };
}

// ==== 场景 1：完整工作流 ====
mem.clear();
const app = mount();
// Proxy 保证每次访问都拿到最新一次渲染的 hook 返回值（state 更新后动作闭包才新鲜）
const wb = new Proxy({} as ReturnType<typeof useWorkbench>, {
  get: (_t, p) => (app.wb as Record<string | symbol, unknown>)[p],
}) as ReturnType<typeof useWorkbench>;

// 建批：2.6mm 正好 4 颗
let batchId = "";
act(() => {
  batchId = wb.createBatch({
    orderNo: "PO-T1",
    label: "客户测试批",
    minMm: 2.6,
    maxMm: 2.6,
  });
});
let batch = wb.state.batches.find((b) => b.id === batchId)!;
assert(batch.roster.length === 4, `建批入选 4 颗，实际 ${batch.roster.length}`);
assert(batch.status === "editing", "新批次为分拣中");

// 未定去向直接提交 → 拒绝，4 颗全部列为冲突
let res = { ok: true, conflictIds: [] as string[], reasons: [] as string[] };
act(() => {
  res = wb.submit(batchId);
});
assert(!res.ok, "未定去向时整批拒绝");
assert(res.conflictIds.length === 4, `4 颗都应标冲突，实际 ${res.conflictIds.length}`);
batch = wb.state.batches.find((b) => b.id === batchId)!;
assert(batch.status === "editing", "拒绝后保持分拣中（未锁定）");
assert(
  batch.audit.some((a) => a.type === "reject"),
  "拒绝事件写入调整记录"
);

// 归位：2 主石（故意超容）+ 2 围石
const [g1, g2, g3, g4] = batch.roster;
act(() => {
  wb.assign(batchId, g1, "main");
  wb.assign(batchId, g2, "main");
  wb.assign(batchId, g3, "surround");
  wb.assign(batchId, g4, "surround");
});
act(() => {
  res = wb.submit(batchId);
});
assert(!res.ok, "主石超容时整批拒绝");
assert(
  res.conflictIds.includes(g2) && !res.conflictIds.includes(g1),
  "标出晚入座的主石 g2，g1 不算冲突"
);

// 把 g2 改到围石 → 围石变 3 颗（仍合法）
act(() => {
  wb.assign(batchId, g2, "surround");
});
batch = wb.state.batches.find((b) => b.id === batchId)!;
assert(
  batch.assignments.find((a) => a.gemId === g2)!.dest === "surround",
  "调整去向覆盖旧记录"
);
assert(
  batch.audit.filter((a) => a.type === "assign").length === 5,
  `每次调整都有记录（期望 5 条，实际 ${batch.audit.filter((a) => a.type === "assign").length}）`
);

// 再补：撤销 g4（回到未定）→ 提交应因 g4 未定被拒
act(() => {
  wb.clearAssignment(batchId, g4);
});
act(() => {
  res = wb.submit(batchId);
});
assert(!res.ok && res.conflictIds.includes(g4), "单颗撤销后未定，提交拒绝并标出 g4");

// g4 → 配石，全部齐了：主石 1 / 围石 3 / 配石 1
act(() => {
  wb.assign(batchId, g4, "accent");
});
act(() => {
  res = wb.submit(batchId);
});
assert(res.ok, "合法分配提交成功");
batch = wb.state.batches.find((b) => b.id === batchId)!;
assert(batch.status === "submitted", "提交后锁定");
assert(typeof batch.submittedAt === "number", "锁定时间被记录");

// 锁定后 assign 无效
const before = batch.assignments;
act(() => {
  wb.assign(batchId, g4, "return");
});
const after = wb.state.batches.find((b) => b.id === batchId)!.assignments;
assert(before === after || JSON.stringify(before) === JSON.stringify(after), "锁定后不可调整");

// 撤回 → 恢复编辑，去向与记录保留
const auditCount = batch.audit.length;
act(() => {
  wb.withdraw(batchId);
});
batch = wb.state.batches.find((b) => b.id === batchId)!;
assert(batch.status === "editing", "撤回后恢复分拣中");
assert(batch.assignments.length === 4, "撤回后原去向保留");
assert(batch.audit.length === auditCount + 1, "撤回本身追加一条记录，历史不丢");
assert(
  batch.assignments.find((a) => a.gemId === g1)!.dest === "main" &&
    batch.assignments.find((a) => a.gemId === g2)!.dest === "surround" &&
    batch.assignments.find((a) => a.gemId === g3)!.dest === "surround" &&
    batch.assignments.find((a) => a.gemId === g4)!.dest === "accent",
  "撤回后各宝石原去向逐一保留"
);

// 围石 9 颗场景：再建一个大批次
let bigId = "";
act(() => {
  bigId = wb.createBatch({ orderNo: "PO-T2", label: "大批", minMm: 0, maxMm: 9.9 });
});
const big = wb.state.batches.find((b) => b.id === bigId)!;
assert(big.roster.length === SEED_GEMS.length, `大批入选全部 ${SEED_GEMS.length} 颗`);
act(() => {
  big.roster.slice(0, 9).forEach((id) => wb.assign(bigId, id, "surround"));
});
act(() => {
  res = wb.submit(bigId);
});
assert(!res.ok, "围石 9 颗 + 其余未定时整批拒绝");
assert(
  res.conflictIds.includes(big.roster[8]),
  "第 9 颗围石被标为超容冲突"
);

app.unmount();

// ==== 场景 2：刷新页面（重新 mount，从 localStorage 恢复）====
assert(mem.has("gem-sorting-workbench:v1"), "状态已写入 localStorage");
(function remount() {
  function Probe() {
    app.holder.wb = useWorkbench();
    return null;
  }
  act(() => {
    app.holder.renderer = TestRenderer.create(React.createElement(Probe));
  });
})();
assert(wb.state.batches.length === 2, "刷新后批次仍在");
const restored = wb.state.batches.find((b) => b.id === batchId)!;
assert(restored.status === "editing", "刷新后撤回的批次仍是分拣中");
assert(restored.assignments.length === 4, "刷新后去向保留");
assert(
  restored.audit.filter((a) => a.type === "assign").length === 7,
  "刷新后每次调整记录保留（7 条 assign，含撤销）"
);
const restoredBig = wb.state.batches.find((b) => b.id === bigId)!;
assert(restoredBig.roster.length === SEED_GEMS.length, "刷新后批次清单保留");
app.unmount();

console.log(`\nHook 端到端测试：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
