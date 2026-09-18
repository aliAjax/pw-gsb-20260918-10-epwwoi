import { useMemo, useState } from "react";
import "./styles.css";
import { useWorkbench } from "./useWorkbench";
import NewBatchForm from "./NewBatchForm";
import BatchCard from "./BatchCard";
import OrderView from "./OrderView";
import { clearStorage } from "./data";
import { batchCarat } from "./types";

type StatusFilter = "all" | "editing" | "submitted";

function App() {
  const wb = useWorkbench();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [keyword, setKeyword] = useState("");

  const visibleBatches = useMemo(() => {
    return wb.state.batches.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const hit =
          b.id.toLowerCase().includes(kw) ||
          b.label.toLowerCase().includes(kw) ||
          b.orderNo.toLowerCase().includes(kw) ||
          b.roster.some(
            (id) =>
              id.toLowerCase().includes(kw) ||
              wb.gemMap.get(id)?.species.toLowerCase().includes(kw)
          );
        if (!hit) return false;
      }
      return true;
    });
  }, [wb.state.batches, wb.gemMap, statusFilter, keyword]);

  const metrics = useMemo(() => {
    const editing = wb.state.batches.filter((b) => b.status === "editing").length;
    const submitted = wb.state.batches.filter(
      (b) => b.status === "submitted"
    ).length;
    const lockedCarat = wb.state.batches
      .filter((b) => b.status === "submitted")
      .reduce((s, b) => s + batchCarat(wb.state.gems, b), 0);
    return {
      batches: wb.state.batches.length,
      editing,
      submitted,
      lockedCarat: lockedCarat.toFixed(2),
    };
  }, [wb.state.batches, wb.state.gems]);

  const resetAll = () => {
    if (window.confirm("清空全部批次并恢复示例宝石数据？此操作不可撤销。")) {
      clearStorage();
      window.location.reload();
    }
  };

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62006 · 珠宝镶嵌工作室 · Port 62006</p>
        <h1>宝石分拣工作台</h1>
        <span>
          分批工作流：建批时先按尺寸筛选 → 逐颗归入主石 / 围石 / 配石 / 退回待定 →
          提交校验（主石位限 1、围石位限 8，未定去向或超容整批拒绝并标出冲突）→
          提交即锁定，可撤回，原去向与每次调整记录均保留；数据本地持久化，刷新页面可继续。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>分拣批次</small>
          <strong>{metrics.batches}</strong>
        </article>
        <article>
          <small>分拣中</small>
          <strong>{metrics.editing}</strong>
        </article>
        <article>
          <small>已锁定</small>
          <strong>{metrics.submitted}</strong>
        </article>
        <article>
          <small>锁定总克拉</small>
          <strong>{metrics.lockedCarat}</strong>
        </article>
      </section>

      <NewBatchForm wb={wb} onCreated={() => setStatusFilter("all")} />

      <section className="panel batch-list-panel">
        <div className="heading">
          <div>
            <p>第二步 · 逐颗归位并提交</p>
            <h2>分拣批次</h2>
          </div>
          <div className="list-controls">
            <input
              className="search"
              placeholder="搜批次号 / 订单 / 宝石编号 / 种类"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <div className="chips">
              {(
                [
                  ["all", `全部 ${wb.state.batches.length}`],
                  [
                    "editing",
                    `分拣中 ${metrics.editing}`,
                  ],
                  [
                    "submitted",
                    `已锁定 ${metrics.submitted}`,
                  ],
                ] as [StatusFilter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={statusFilter === key ? "chip-on" : ""}
                  onClick={() => setStatusFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button onClick={resetAll}>重置示例数据</button>
          </div>
        </div>

        {wb.state.batches.length === 0 && (
          <p className="empty-hint">
            还没有批次。在上方设置尺寸区间并「按筛选结果建批」开始分拣。
          </p>
        )}
        {wb.state.batches.length > 0 && visibleBatches.length === 0 && (
          <p className="empty-hint">没有符合筛选条件的批次。</p>
        )}

        <div className="batch-list">
          {visibleBatches.map((batch) => (
            <BatchCard key={batch.id} batch={batch} wb={wb} />
          ))}
        </div>
      </section>

      <OrderView wb={wb} />

      <footer className="foot">
        数据保存在本浏览器 localStorage（gem-sorting-workbench:v1），仅用于演示，刷新与重开页面后可继续分拣。
      </footer>
    </main>
  );
}

export default App;
