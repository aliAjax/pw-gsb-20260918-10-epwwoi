import type { Gem, WorkbenchState } from "./types";

// 初始宝石库存（工作室示例数据）
export const SEED_GEMS: Gem[] = [
  { id: "ST-2048", species: "蓝宝石", shape: "椭圆", carat: 1.82, sizeMm: 8.1, clarity: "VVS", color: "皇家蓝", cut: "椭圆明亮切工", note: "台面微小矿缺" },
  { id: "ST-2051", species: "蓝宝石", shape: "椭圆", carat: 0.62, sizeMm: 6.0, clarity: "VS", color: "矢车菊蓝", cut: "椭圆混合切工" },
  { id: "ST-2052", species: "蓝宝石", shape: "椭圆", carat: 0.58, sizeMm: 5.8, clarity: "VS", color: "矢车菊蓝", cut: "椭圆混合切工" },
  { id: "ST-2061", species: "钻石", shape: "圆形", carat: 0.08, sizeMm: 2.6, clarity: "VVS", color: "D", cut: "圆形明亮切工" },
  { id: "ST-2062", species: "钻石", shape: "圆形", carat: 0.09, sizeMm: 2.7, clarity: "VVS", color: "E", cut: "圆形明亮切工" },
  { id: "ST-2063", species: "钻石", shape: "圆形", carat: 0.07, sizeMm: 2.5, clarity: "VS", color: "F", cut: "圆形明亮切工" },
  { id: "ST-2064", species: "钻石", shape: "圆形", carat: 0.08, sizeMm: 2.6, clarity: "VS", color: "E", cut: "圆形明亮切工" },
  { id: "ST-2065", species: "钻石", shape: "圆形", carat: 0.10, sizeMm: 2.8, clarity: "VVS", color: "D", cut: "圆形明亮切工" },
  { id: "ST-2066", species: "钻石", shape: "圆形", carat: 0.07, sizeMm: 2.5, clarity: "SI", color: "G", cut: "圆形明亮切工", note: "腰棱轻微磨损" },
  { id: "ST-2067", species: "钻石", shape: "圆形", carat: 0.08, sizeMm: 2.6, clarity: "VS", color: "F", cut: "圆形明亮切工" },
  { id: "ST-2068", species: "钻石", shape: "圆形", carat: 0.09, sizeMm: 2.7, clarity: "VVS", color: "E", cut: "圆形明亮切工" },
  { id: "ST-2069", species: "钻石", shape: "圆形", carat: 0.08, sizeMm: 2.6, clarity: "VS", color: "F", cut: "圆形明亮切工" },
  { id: "ST-2072", species: "沙弗莱石", shape: "圆形", carat: 0.35, sizeMm: 4.2, clarity: "VS", color: "翠绿", cut: "圆形明亮切工" },
  { id: "ST-2075", species: "粉色蓝宝石", shape: "梨形", carat: 0.22, sizeMm: 3.8, clarity: "VS", color: "热粉", cut: "梨形切工" },
  { id: "ST-2080", species: "黄钻", shape: "圆形", carat: 0.15, sizeMm: 3.4, clarity: "VS", color: "Fancy Yellow", cut: "圆形明亮切工" },
  { id: "ST-2084", species: "红宝石", shape: "椭圆", carat: 1.05, sizeMm: 7.0, clarity: "SI", color: "鸽血红", cut: "椭圆混合切工", note: "亭部可见色带" },
  { id: "ST-2090", species: "海蓝宝", shape: "祖母绿切", carat: 0.74, sizeMm: 6.5, clarity: "VVS", color: "圣玛利亚", cut: "阶梯切工" },
  { id: "ST-2099", species: "祖母绿", shape: "祖母绿切", carat: 0.96, sizeMm: 6.8, clarity: "SI", color: "木佐绿", cut: "阶梯切工", note: "内含物明显，需客户确认" },
  { id: "ST-2103", species: "钻石", shape: "圆形", carat: 0.05, sizeMm: 2.1, clarity: "SI", color: "H", cut: "圆形明亮切工" },
  { id: "ST-2107", species: "尖晶石", shape: "枕形", carat: 0.41, sizeMm: 4.6, clarity: "VVS", color: "绝地武士", cut: "枕形切工" },
];

const STORAGE_KEY = "gem-sorting-workbench:v1";

export function loadState(): WorkbenchState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkbenchState;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.gems) && Array.isArray(parsed.batches)) {
        return parsed;
      }
    }
  } catch {
    // 存储损坏时回退到初始数据
  }
  return { version: 1, gems: SEED_GEMS, batches: [] };
}

export function saveState(state: WorkbenchState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 隐私模式等场景下静默失败
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
