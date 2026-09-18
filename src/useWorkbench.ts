import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Assignment,
  AuditEntry,
  Batch,
  DestinationId,
  WorkbenchState,
} from "./types";
import { DEST_META, evaluateConflicts, matchSize } from "./types";
import { loadState, saveState } from "./data";

let auditSeq = 0;
function newAudit(
  type: AuditEntry["type"],
  detail: string,
  extra?: Partial<AuditEntry>
): AuditEntry {
  auditSeq += 1;
  return {
    id: `a-${Date.now()}-${auditSeq}`,
    at: Date.now(),
    type,
    detail,
    ...extra,
  };
}

export interface CreateBatchInput {
  orderNo: string;
  label: string;
  minMm: number;
  maxMm: number;
}

export interface SubmitResult {
  ok: boolean;
  conflictIds: string[];
  reasons: string[];
}

export function useWorkbench() {
  const [state, setState] = useState<WorkbenchState>(() => loadState());

  // 每次变更都写入 localStorage，刷新页面后可继续
  useEffect(() => {
    saveState(state);
  }, [state]);

  const gemMap = useMemo(
    () => new Map(state.gems.map((g) => [g.id, g])),
    [state.gems]
  );

  /** 按尺寸筛出符合条件的宝石（供新建批次时预览） */
  const previewSize = useCallback(
    (minMm: number, maxMm: number) => matchSize(state.gems, minMm, maxMm),
    [state.gems]
  );

  /** 新建批次：建批瞬间按尺寸筛定清单，之后清单不再随库存变化 */
  const createBatch = useCallback(
    (input: CreateBatchInput): string => {
      const year = new Date().getFullYear();
      const used = new Set(state.batches.map((b) => b.id));
      let n = state.batches.length + 1;
      let id = `B-${year}-${String(n).padStart(3, "0")}`;
      while (used.has(id)) {
        n += 1;
        id = `B-${year}-${String(n).padStart(3, "0")}`;
      }
      const roster = matchSize(state.gems, input.minMm, input.maxMm).map(
        (g) => g.id
      );
      const batch: Batch = {
        id,
        orderNo: input.orderNo.trim() || "未关联订单",
        label: input.label.trim() || `分拣批次 ${id}`,
        minMm: input.minMm,
        maxMm: input.maxMm,
        roster,
        assignments: [],
        status: "editing",
        createdAt: Date.now(),
        audit: [
          newAudit(
            "create",
            `建批：尺寸筛选 ${input.minMm}–${input.maxMm} mm，入选 ${roster.length} 颗`
          ),
        ],
      };
      setState((prev) => ({ ...prev, batches: [batch, ...prev.batches] }));
      return id;
    },
    [state.batches, state.gems]
  );

  /** 调整一颗宝石的去向（编辑中批次）；每次调整都写审计 */
  const assign = useCallback(
    (batchId: string, gemId: string, dest: DestinationId) => {
      setState((prev) => ({
        ...prev,
        batches: prev.batches.map((b) => {
          if (b.id !== batchId || b.status !== "editing") return b;
          const existing = b.assignments.find((a) => a.gemId === gemId);
          if (existing?.dest === dest) return b;
          const from = existing?.dest ?? null;
          const rest = b.assignments.filter((a) => a.gemId !== gemId);
          const next: Assignment = { gemId, dest, at: Date.now() };
          return {
            ...b,
            assignments: [...rest, next],
            audit: [
              ...b.audit,
              newAudit(
                "assign",
                `${gemId}：${from ? DEST_META[from].name : "未定"} → ${DEST_META[dest].name}`,
                { gemId, from, to: dest }
              ),
            ],
          };
        }),
      }));
    },
    []
  );

  /** 撤回单颗宝石的去向（回到未定） */
  const clearAssignment = useCallback((batchId: string, gemId: string) => {
    setState((prev) => ({
      ...prev,
      batches: prev.batches.map((b) => {
        if (b.id !== batchId || b.status !== "editing") return b;
        const existing = b.assignments.find((a) => a.gemId === gemId);
        if (!existing) return b;
        return {
          ...b,
          assignments: b.assignments.filter((a) => a.gemId !== gemId),
          audit: [
            ...b.audit,
            newAudit(
              "assign",
              `${gemId}：${DEST_META[existing.dest].name} → 未定`,
              { gemId, from: existing.dest, to: null }
            ),
          ],
        };
      }),
    }));
  }, []);

  /**
   * 提交批次：存在未定去向或目标位超容时整批拒绝，
   * 返回冲突宝石编号用于页面标出；通过则锁定。
   */
  const submit = useCallback(
    (batchId: string): SubmitResult => {
      const batch = state.batches.find((b) => b.id === batchId);
      if (!batch || batch.status !== "editing") {
        return { ok: false, conflictIds: [], reasons: ["批次不可提交"] };
      }

      const conflicts = evaluateConflicts(batch);
      const reasons: string[] = [];

      if (conflicts.unassigned.length > 0) {
        reasons.push(
          `存在 ${conflicts.unassigned.length} 颗未定去向：${conflicts.unassigned.join("、")}`
        );
      }

      (["main", "surround", "accent", "return"] as DestinationId[]).forEach(
        (dest) => {
          const cap = DEST_META[dest].cap;
          const over = conflicts.overflow[dest];
          if (cap === null || over.length === 0) return;
          const total = batch.assignments.filter((a) => a.dest === dest).length;
          reasons.push(
            `${DEST_META[dest].name}位限 ${cap} 颗，当前 ${total} 颗（${over.join(
              "、"
            )} 需移出）`
          );
        }
      );

      if (reasons.length > 0) {
        const audit = newAudit("reject", `提交被拒：${reasons.join("；")}`);
        setState((prev) => ({
          ...prev,
          batches: prev.batches.map((b) =>
            b.id === batchId
              ? { ...b, lastRejectedAt: audit.at, audit: [...b.audit, audit] }
              : b
          ),
        }));
        return { ok: false, conflictIds: conflicts.gemIds, reasons };
      }

      const audit = newAudit("submit", "提交成功，批次已锁定");
      setState((prev) => ({
        ...prev,
        batches: prev.batches.map((b) =>
          b.id === batchId
            ? {
                ...b,
                status: "submitted",
                submittedAt: audit.at,
                audit: [...b.audit, audit],
              }
            : b
        ),
      }));
      return { ok: true, conflictIds: [], reasons: [] };
    },
    [state.batches]
  );

  /** 撤回已提交批次：恢复编辑，原去向与全部调整记录保留 */
  const withdraw = useCallback((batchId: string) => {
    setState((prev) => ({
      ...prev,
      batches: prev.batches.map((b) => {
        if (b.id !== batchId || b.status !== "submitted") return b;
        const summary = (["main", "surround", "accent", "return"] as DestinationId[])
          .map((d) => {
            const n = b.assignments.filter((a) => a.dest === d).length;
            return n > 0 ? `${DEST_META[d].name} ${n}` : "";
          })
          .filter(Boolean)
          .join("、");
        return {
          ...b,
          status: "editing",
          audit: [
            ...b.audit,
            newAudit(
              "withdraw",
              `撤回锁定恢复编辑，原去向保留（${summary}）`
            ),
          ],
        };
      }),
    }));
  }, []);

  const deleteBatch = useCallback((batchId: string) => {
    setState((prev) => ({
      ...prev,
      batches: prev.batches.filter((b) => b.id !== batchId),
    }));
  }, []);

  return {
    state,
    gemMap,
    previewSize,
    createBatch,
    assign,
    clearAssignment,
    submit,
    withdraw,
    deleteBatch,
  };
}
