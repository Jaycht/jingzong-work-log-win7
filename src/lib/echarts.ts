// 集中注册 echarts，按需引入以缩减打包体积（L-11）。
// 原代码三处 `import * as echarts from 'echarts'` 会拖入 echarts 全量包（约 1.1MB）。
// 改为从 echarts/core 按需注册本项目实际用到的图表类型与组件：
//   图表类型：bar（柱状）、pie（饼/玫瑰）、graph（关系图谱）
//   组件：     Tooltip / Legend / Grid(xAxis,yAxis) / Dataset
//   渲染器：   Canvas
// 实际用途枚举见 Dashboard.tsx / Statistics.tsx / CaseGraph.tsx / EChartBox.tsx。
// 新增图表或组件时，必须在此同步注册，否则对应图表会在运行期静默失效。
import * as echarts from 'echarts/core';
import { BarChart, PieChart, GraphChart, LineChart } from 'echarts/charts';
import {
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  PieChart,
  GraphChart,
  LineChart,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  CanvasRenderer,
]);

export * from 'echarts/core';
export default echarts;
