// 宝石分拣工作流的领域模型与批次校验逻辑

export type DestinationId = "main" | "surround" | "accent" | "return";

export interface Gem {
  id: string; // 宝石编号，如 ST-2048
  species: string; // 种类：蓝宝石 / 钻石 / 祖母绿 ...
  shape: string; // 形状：圆形 / 椭圆 / 梨形 / 祖母绿切
  carat: number; // 克拉重量
  sizeMm: number; // 尺寸（直径/长轴，毫米）
  clarity: string; // 净度
  color: string; // 颜色
  cut: string; // 切工
  note?: string; // 缺陷备注
}

/** 一颗宝石在某批次内的去向记录（包含入座时间，用于超容时标出最后挤入的宝石） */
export interface Assignment {
  gemId: string;
  dest: DestinationId;
  at: number;
}

export type BatchStatus = "editing" | "submitted";

export interface AuditEntry {
  id: string;
  at: number;
  type: "assign" | "submit" | "reject" | "withdraw" | "create";
  gemId?: string;
  from?: DestinationId | null;
  to?: DestinationId | null;
  detail: string;
}

export interface Batch {
  id: string;
  orderNo: string; // 所属订单
  label: string; // 批次名称
  minMm: number; // 批次尺寸筛选：下限
  maxMm: number; // 批次尺寸筛选：上限
  roster: string[]; // 建批时按尺寸筛出的宝石编号（批次清单固定）
  assignments: Assignment[];
  status: BatchStatus;
  createdAt: number;
  submittedAt?: number;
  /** 提交被拒绝时的冲突快照（修改后会实时复算，此快照只作历史痕迹，列表仍实时展示） */
  lastRejectedAt?: number;
  audit: AuditEntry[];
}

export interface WorkbenchState {
  version: number;
  gems: Gem[];
  batches: Batch[];
}

export const DEST_ORDER: DestinationId[] = ["main", "surround", "accent", "return"];

export const DEST_META: Record<
  DestinationId,
  { name: string; cap: number | null; tone: string }
> = {
  main: { name: "主石", cap: 1, tone: "rose" },
  surround: { name: "围石", cap: 8, tone: "teal" },
  accent: { name: "配石", cap: null, tone: "violet" },
  return: { name: "退回待定", cap: null, tone: "amber" },
};

export interface Conflicts {
  /** 未定去向的宝石（在批次清单内但没有任何去向） */
  unassigned: string[];
  /** 超容冲突：目标位 -> 超出容量的宝石（按最后调整时间倒序，最晚入座者为冲突） */
  overflow: Record<DestinationId, string[]>;
  /** 所有冲突宝石编号（去重） */
  gemIds: string[];
}

/** 按尺寸筛选：落在闭区间 [minMm, maxMm] 内的宝石进入批次清单 */
export function matchSize(gems: Gem[], minMm: number, maxMm: number): Gem[] {
  return gems
    .filter((g) => g.sizeMm >= minMm && g.sizeMm <= maxMm)
    .sort((a, b) => a.sizeMm - b.sizeMm || a.id.localeCompare(b.id));
}

export function evaluateConflicts(batch: Batch): Conflicts {
  const assignedIds = new Set(batch.assignments.map((a) => a.gemId));
  const unassigned = batch.roster.filter((id) => !assignedIds.has(id));

  const overflow = {} as Record<DestinationId, string[]>;
  const gemSet = new Set<string>();

  for (const dest of DEST_ORDER) {
    const cap = DEST_META[dest].cap;
    const here = batch.assignments
      .filter((a) => a.dest === dest)
      .sort((a, b) => a.at - b.at);
    let over: string[] = [];
    if (cap !== null && here.length > cap) {
      over = here.slice(cap).map((a) => a.gemId);
    }
    overflow[dest] = over;
    over.forEach((id) => gemSet.add(id));
  }
  unassigned.forEach((id) => gemSet.add(id));

  return { unassigned, overflow, gemIds: [...gemSet] };
}

export function batchCarat(gems: Gem[], batch: Batch): number {
  const map = new Map(gems.map((g) => [g.id, g]));
  return batch.roster.reduce((sum, id) => sum + (map.get(id)?.carat ?? 0), 0);
}

export function assignedCount(batch: Batch): number {
  return new Set(batch.assignments.map((a) => a.gemId)).size;
}
