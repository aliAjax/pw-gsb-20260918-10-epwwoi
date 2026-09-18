// 端到端逻辑测试：与 UI 共用同一份领域逻辑（src/types.ts、src/data.ts）
import {
  matchSize,
  evaluateConflicts,
  DEST_META,
  type Batch,
  type DestinationId,
} from "../src/types";
import { SEED_GEMS } from "../src/data";

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error("✘ " + msg);
  }
}

let t = 1;
const A = (gemId: string, dest: DestinationId) => ({ gemId, dest, at: t++ });

const roster = matchSize(SEED_GEMS, 0, 9.9).map((g) => g.id);
const mk = (assignments: Batch["assignments"] = []): Batch => ({
  id: "B-T",
  orderNo: "PO-X",
  label: "测试批",
  minMm: 0,
  maxMm: 9.9,
  roster,
  assignments,
  status: "editing",
  createdAt: 0,
  audit: [],
});

// 1. 尺寸筛选（闭区间）
const picked = matchSize(SEED_GEMS, 2.5, 2.7);
assert(
  picked.every((g) => g.sizeMm >= 2.5 && g.sizeMm <= 2.7),
  "尺寸筛选结果必须都在区间内"
);
assert(picked.length === 8, `2.5–2.7mm 应有 8 颗，实际 ${picked.length}`);

// 2. 全部未定 → 全部冲突
let c = evaluateConflicts(mk());
assert(c.unassigned.length === roster.length, "未分配时所有宝石应未定");
assert(c.gemIds.length === roster.length, "未定宝石都应在冲突集合中");

// 3. 主石 2 颗 → 超容，晚入座者标冲突
const two = roster.slice(0, 2);
c = evaluateConflicts(mk([A(two[0], "main"), A(two[1], "main")]));
assert(c.overflow.main.length === 1, "主石 2 颗时溢出 1 颗");
assert(c.overflow.main[0] === two[1], "主石溢出应标出最后入座者");

// 4. 围石 9 颗 → 第 9 颗冲突
const nine = roster.slice(0, 9);
c = evaluateConflicts(
  mk(nine.map((id, i) => ({ gemId: id, dest: "surround" as const, at: i + 1 })))
);
assert(c.overflow.surround.length === 1, "围石 9 颗时溢出 1 颗");
assert(c.overflow.surround[0] === nine[8], "围石溢出应标出第 9 颗");

// 5. 主石 1 + 围石 8 + 其余配石/退回 → 无冲突
const mainGem = roster[0];
const surrGems = roster.slice(1, 9);
const restGems = roster.slice(9);
c = evaluateConflicts(
  mk([
    A(mainGem, "main"),
    ...surrGems.map((id) => A(id, "surround")),
    ...restGems.map((id, i) => A(id, i % 2 === 0 ? "accent" : "return")),
  ])
);
assert(c.unassigned.length === 0, "合法分配不应有未定宝石");
assert(c.gemIds.length === 0, `合法分配不应有冲突，实际 ${JSON.stringify(c.gemIds)}`);

// 6. 只占主石与围石 → 其余未定，不超容
c = evaluateConflicts(
  mk([A(mainGem, "main"), ...surrGems.map((id) => A(id, "surround"))])
);
assert(
  c.unassigned.length === restGems.length &&
    c.overflow.main.length === 0 &&
    c.overflow.surround.length === 0,
  "未覆盖全部清单时只有未定冲突，无超容"
);

// 7. 配石/退回不限量
c = evaluateConflicts(mk(roster.map((id) => A(id, "accent"))));
assert(
  c.overflow.accent.length === 0 && c.overflow.return.length === 0,
  "配石位/退回位不限量"
);

// 8. 拒绝原因（与 useWorkbench.submit 中生成逻辑一致）
function submitCheck(batch: Batch) {
  const conf = evaluateConflicts(batch);
  const reasons: string[] = [];
  if (conf.unassigned.length)
    reasons.push(
      `存在 ${conf.unassigned.length} 颗未定去向：${conf.unassigned.join("、")}`
    );
  (["main", "surround"] as const).forEach((dest) => {
    const cap = DEST_META[dest].cap!;
    const over = conf.overflow[dest];
    if (over.length) {
      const total = batch.assignments.filter((a) => a.dest === dest).length;
      reasons.push(
        `${DEST_META[dest].name}位限 ${cap} 颗，当前 ${total} 颗（${over.join("、")} 需移出）`
      );
    }
  });
  return { ok: reasons.length === 0, conflictIds: conf.gemIds, reasons };
}

let r = submitCheck(
  mk([
    A(two[0], "main"),
    A(two[1], "main"),
    ...surrGems.slice(0, 2).map((id) => A(id, "surround")),
  ])
);
assert(!r.ok && r.conflictIds.includes(two[1]), "拒绝时返回冲突宝石编号");
assert(r.reasons.some((x) => x.includes("主石位限 1")), "拒绝原因包含主石容量");
assert(r.reasons.some((x) => x.includes("未定去向")), "拒绝原因包含未定去向");

// 9. 合法批次通过
r = submitCheck(
  mk([
    A(mainGem, "main"),
    ...surrGems.map((id) => A(id, "surround")),
    ...restGems.map((id) => A(id, "accent")),
  ])
);
assert(r.ok, "合法分配应通过提交校验");

// 10. 边界：尺寸恰好等于上下限应入选
assert(
  matchSize(SEED_GEMS, 2.6, 2.6).every((g) => g.sizeMm === 2.6) &&
    matchSize(SEED_GEMS, 2.6, 2.6).length === 4,
  "闭区间边界（2.6mm）宝石应入选"
);

console.log(`\n纯逻辑测试：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
