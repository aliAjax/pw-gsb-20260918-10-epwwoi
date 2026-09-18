import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { Batch, Destination, PersistedState, SizeRange } from "./types";
import {
  groupGems,
  inSizeRange,
  loadState,
  resetState,
  saveState,
  uid,
  validateBatch,
} from "./store";
import BatchSidebar from "./components/BatchSidebar";
import BatchWorkspace from "./components/BatchWorkspace";

function App() {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [selectedId, setSelectedId] = useState<string | null>(
    () => loadState().batches[0]?.id ?? null
  );

  // 刷新页面后继续：全部工作状态持久化到 localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  const selected = useMemo(
    () => state.batches.find((b) => b.id === selectedId) ?? null,
    [state.batches, selectedId]
  );

  function patchBatch(batchId: string, updater: (b: Batch) => Batch) {
    setState((prev) => ({
      ...prev,
      batches: prev.batches.map((b) => (b.id === batchId ? updater(b) : b)),
    }));
  }

  // 建批：先按尺寸从料盘筛选宝石
  function createBatch(orderNo: string, range: SizeRange): string | null {
    const picked = state.pool.filter((g) => inSizeRange(g.sizeMm, range));
    if (picked.length === 0) return null;

    const batch: Batch = {
      id: `B-${Date.now().toString(36).toUpperCase()}`,
      orderNo,
      createdAt: Date.now(),
      sizeFilter: range,
      status: "editing",
      gems: picked,
      assignments: {},
      logs: [
        {
          id: uid("log"),
          at: Date.now(),
          kind: "create",
          note: `按尺寸 ${range.min ?? "不限"}–${range.max ?? "不限"} mm 建批，入批 ${picked.length} 颗`,
        },
      ],
      lastRejection: null,
    };
    setState((prev) => ({
      ...prev,
      pool: prev.pool.filter((g) => !picked.some((p) => p.id === g.id)),
      batches: [...prev.batches, batch],
    }));
    setSelectedId(batch.id);
    return batch.id;
  }

  // 每次调整都留痕；一旦有新调整，上一次的拒绝标记清除
  function assignGem(batchId: string, gemId: string, dest: Destination) {
    patchBatch(batchId, (b) => {
      if (b.status === "locked") return b;
      const from = b.assignments[gemId] ?? null;
      if (from === dest) return b;
      return {
        ...b,
        assignments: { ...b.assignments, [gemId]: dest },
        lastRejection: null,
        logs: [
          ...b.logs,
          { id: uid("log"), at: Date.now(), kind: "assign", gemId, from, to: dest },
        ],
      };
    });
  }

  // 提交：整批校验；未定去向或超容则整批拒绝并标出冲突
  function submitBatch(batchId: string) {
    patchBatch(batchId, (b) => {
      if (b.status === "locked") return b;
      const rejection = validateBatch(b);
      if (rejection) {
        return { ...b, lastRejection: rejection };
      }
      return {
        ...b,
        status: "locked",
        submittedAt: Date.now(),
        lastRejection: null,
        logs: [...b.logs, { id: uid("log"), at: Date.now(), kind: "submit" }],
      };
    });
  }

  // 撤回：恢复分拣中，保留原去向和每次调整记录
  function withdrawBatch(batchId: string) {
    patchBatch(batchId, (b) => {
      if (b.status !== "locked") return b;
      return {
        ...b,
        status: "editing",
        logs: [
          ...b.logs,
          {
            id: uid("log"),
            at: Date.now(),
            kind: "withdraw",
            note: `撤回原提交（提交于 ${new Date(b.submittedAt ?? b.createdAt).toLocaleString("zh-CN")}），原去向保留`,
          },
        ],
      };
    });
  }

  function handleReset() {
    if (window.confirm("确定清空所有批次与分拣记录，恢复示例料盘？")) {
      const fresh = resetState();
      setState(fresh);
      setSelectedId(null);
    }
  }

  const totalGems = state.batches.reduce((n, b) => n + b.gems.length, 0);
  const lockedCount = state.batches.filter((b) => b.status === "locked").length;
  const pendingGems = state.batches.reduce(
    (n, b) => n + groupGems(b).unassigned.length + groupGems(b).pending.length,
    0
  );

  return (
    <main className="app">
      <section className="hero">
        <p>珠宝镶嵌工作室 · 分批分拣工作流</p>
        <h1>宝石分拣台</h1>
        <span>
          每批先按尺寸从料盘筛选；逐颗归入主石（限 1 颗）、围石（限 8 颗）、配石或退回待定。
          存在未定去向或目标位超容时整批拒绝并标出冲突宝石；提交后锁定，撤回保留原去向与全部调整记录，刷新可继续。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>分拣批次</small>
          <strong>{state.batches.length}</strong>
        </article>
        <article>
          <small>已锁定 / 分拣中</small>
          <strong>
            {lockedCount}
            <span>/{state.batches.length - lockedCount}</span>
          </strong>
        </article>
        <article>
          <small>在批宝石</small>
          <strong>{totalGems}</strong>
        </article>
        <article>
          <small>未定/待定</small>
          <strong>{pendingGems}</strong>
        </article>
      </section>

      <div className="toolbar">
        <span>数据自动保存在本机浏览器（localStorage），刷新页面后可继续上次工作。</span>
        <button type="button" onClick={handleReset}>
          重置示例数据
        </button>
      </div>

      <section className="workspace">
        <BatchSidebar
          batches={state.batches}
          poolCount={state.pool.length}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={createBatch}
        />
        {selected ? (
          <BatchWorkspace
            key={selected.id}
            batch={selected}
            onAssign={(gemId, dest) => assignGem(selected.id, gemId, dest)}
            onSubmit={() => submitBatch(selected.id)}
            onWithdraw={() => withdrawBatch(selected.id)}
          />
        ) : (
          <section className="panel workspace-main empty-workspace">
            <h2>选择或新建一个分拣批次</h2>
            <p>
              左侧按尺寸范围建批后，在这里逐颗决定宝石去向，完成后提交。料盘现有 {state.pool.length}{" "}
              颗宝石等待入批。
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
