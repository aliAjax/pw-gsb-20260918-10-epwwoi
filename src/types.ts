// 宝石去向：主石 / 围石 / 配石 / 退回待定；null 表示尚未决定去向
export type Destination = "main" | "surround" | "accent" | "pending";

export const DEST_LABEL: Record<Destination, string> = {
  main: "主石",
  surround: "围石",
  accent: "配石",
  pending: "退回待定",
};

export interface Gem {
  id: string; // 宝石编号
  kind: string; // 种类
  shape: string; // 形状
  carat: number; // 克拉重量
  sizeMm: number; // 尺寸（直径/长径 mm，分拣按此筛选）
  clarity: string; // 净度
  color: string; // 颜色
  cut: string; // 切工
  defect?: string; // 缺陷备注
}

export type LogKind = "create" | "assign" | "submit" | "withdraw";

export interface AdjustLog {
  id: string;
  at: number;
  kind: LogKind;
  gemId?: string;
  from?: Destination | null;
  to?: Destination | null;
  note?: string;
}

/** 提交被整批拒绝时记录的冲突明细（用于标出冲突宝石） */
export interface Rejection {
  at: number;
  unassigned: string[]; // 未定去向
  overflowMain: string[]; // 主石位超容（超出 1 颗的部分）
  overflowSurround: string[]; // 围石位超容（超出 8 颗的部分）
}

export type BatchStatus = "editing" | "locked";

export interface SizeRange {
  min: number | null;
  max: number | null;
}

export interface Batch {
  id: string;
  orderNo: string; // 订单号
  createdAt: number;
  sizeFilter: SizeRange; // 建批时的尺寸筛选条件
  status: BatchStatus; // editing=分拣中，locked=已提交锁定
  gems: Gem[];
  assignments: Record<string, Destination>;
  logs: AdjustLog[]; // 每次调整记录（含提交/撤回）
  submittedAt?: number;
  lastRejection?: Rejection | null;
}

export interface PersistedState {
  version: 1;
  pool: Gem[]; // 尚未进入任何批次的宝石
  batches: Batch[];
}

export const SLOT_LIMITS = {
  main: 1,
  surround: 8,
} as const;
