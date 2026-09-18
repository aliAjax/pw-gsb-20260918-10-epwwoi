import type {
  Batch,
  Destination,
  Gem,
  PersistedState,
  Rejection,
} from "./types";
import { SLOT_LIMITS } from "./types";

const STORAGE_KEY = "gem-sort-workflow-v1";

export const SEED_GEMS: Gem[] = [
  { id: "ST-2048", kind: "蓝宝石", shape: "椭圆", carat: 1.02, sizeMm: 6.0, clarity: "VVS", color: "皇家蓝", cut: "椭圆明亮" },
  { id: "ST-2051", kind: "蓝宝石", shape: "椭圆", carat: 0.95, sizeMm: 5.8, clarity: "VS", color: "矢车菊", cut: "椭圆明亮" },
  { id: "ST-2060", kind: "红宝石", shape: "圆形", carat: 0.8, sizeMm: 5.2, clarity: "VS", color: "鸽血红", cut: "圆形明亮" },
  { id: "ST-2061", kind: "钻石", shape: "圆形", carat: 0.08, sizeMm: 2.8, clarity: "VVS", color: "D", cut: "圆形明亮" },
  { id: "ST-2062", kind: "钻石", shape: "圆形", carat: 0.07, sizeMm: 2.6, clarity: "VVS", color: "E", cut: "圆形明亮" },
  { id: "ST-2063", kind: "钻石", shape: "圆形", carat: 0.09, sizeMm: 3.0, clarity: "VS", color: "F", cut: "圆形明亮" },
  { id: "ST-2064", kind: "钻石", shape: "圆形", carat: 0.08, sizeMm: 2.8, clarity: "VS", color: "G", cut: "圆形明亮" },
  { id: "ST-2065", kind: "钻石", shape: "圆形", carat: 0.06, sizeMm: 2.4, clarity: "SI", color: "F", cut: "圆形明亮" },
  { id: "ST-2066", kind: "钻石", shape: "圆形", carat: 0.1, sizeMm: 3.2, clarity: "VVS", color: "D", cut: "圆形明亮" },
  { id: "ST-2067", kind: "钻石", shape: "圆形", carat: 0.07, sizeMm: 2.6, clarity: "VS", color: "E", cut: "圆形明亮" },
  { id: "ST-2068", kind: "钻石", shape: "圆形", carat: 0.09, sizeMm: 3.0, clarity: "VS", color: "F", cut: "圆形明亮", defect: "腰棱小缺口，暂留" },
  { id: "ST-2069", kind: "钻石", shape: "圆形", carat: 0.05, sizeMm: 2.2, clarity: "SI", color: "H", cut: "圆形明亮" },
  { id: "ST-2090", kind: "钻石", shape: "圆形", carat: 0.03, sizeMm: 1.8, clarity: "VS", color: "F", cut: "圆形明亮" },
  { id: "ST-2091", kind: "钻石", shape: "圆形", carat: 0.03, sizeMm: 1.7, clarity: "VS", color: "G", cut: "圆形明亮" },
  { id: "ST-2092", kind: "钻石", shape: "圆形", carat: 0.04, sizeMm: 2.0, clarity: "SI", color: "F", cut: "圆形明亮" },
  { id: "ST-2093", kind: "钻石", shape: "圆形", carat: 0.02, sizeMm: 1.5, clarity: "SI", color: "H", cut: "圆形明亮" },
  { id: "ST-2094", kind: "钻石", shape: "圆形", carat: 0.03, sizeMm: 1.8, clarity: "SI", color: "G", cut: "圆形明亮" },
  { id: "ST-2099", kind: "祖母绿", shape: "祖母绿切", carat: 0.34, sizeMm: 4.5, clarity: "I", color: "中绿", cut: "阶梯", defect: "内含物明显，需客户确认" },
  { id: "ST-2100", kind: "沙弗莱", shape: "梨形", carat: 0.05, sizeMm: 2.0, clarity: "VS", color: "翠绿", cut: "梨形玫瑰" },
];

function seedState(): PersistedState {
  return { version: 1, pool: SEED_GEMS, batches: [] };
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== 1 || !Array.isArray(parsed.batches)) return seedState();
    return parsed;
  } catch {
    return seedState();
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 隐私模式或存储已满时静默降级：本次会话仍可操作
  }
}

export function resetState(): PersistedState {
  const fresh = seedState();
  saveState(fresh);
  return fresh;
}

let seq = 0;
export function uid(prefix = "id"): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export function inSizeRange(sizeMm: number, range: { min: number | null; max: number | null }): boolean {
  if (range.min !== null && sizeMm < range.min) return false;
  if (range.max !== null && sizeMm > range.max) return false;
  return true;
}

export interface BatchCounts {
  main: Gem[];
  surround: Gem[];
  accent: Gem[];
  pending: Gem[];
  unassigned: Gem[];
}

export function groupGems(batch: Batch): BatchCounts {
  const counts: BatchCounts = { main: [], surround: [], accent: [], pending: [], unassigned: [] };
  for (const gem of batch.gems) {
    const dest = batch.assignments[gem.id];
    if (!dest) counts.unassigned.push(gem);
    else counts[dest].push(gem);
  }
  return counts;
}

/** 校验整批：存在未定去向或主石/围石位超容即拒绝，返回冲突宝石清单 */
export function validateBatch(batch: Batch): Rejection | null {
  const grouped = groupGems(batch);
  const rejection: Rejection = {
    at: Date.now(),
    unassigned: grouped.unassigned.map((g) => g.id),
    overflowMain: grouped.main.slice(SLOT_LIMITS.main).map((g) => g.id),
    overflowSurround: grouped.surround.slice(SLOT_LIMITS.surround).map((g) => g.id),
  };
  const hasConflict =
    rejection.unassigned.length > 0 ||
    rejection.overflowMain.length > 0 ||
    rejection.overflowSurround.length > 0;
  return hasConflict ? rejection : null;
}

export function conflictGemIds(rejection: Rejection | null | undefined): Set<string> {
  if (!rejection) return new Set();
  return new Set<string>([
    ...rejection.unassigned,
    ...rejection.overflowMain,
    ...rejection.overflowSurround,
  ]);
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export const DEST_COLOR: Record<Destination, string> = {
  main: "#be123c",
  surround: "#0f766e",
  accent: "#a855f7",
  pending: "#b45309",
};
