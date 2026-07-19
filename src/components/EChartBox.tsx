import { useEffect, useRef } from 'react';
import * as echarts from '../lib/echarts';

interface EChartBoxProps {
  option: Record<string, unknown>;
  style?: React.CSSProperties;
  /**
   * 是否完全替换（notMerge）。默认 false：option 变化时仅 setOption 合并更新，
   * 实例只 init 一次，避免反复 dispose + init 造成的闪烁与性能浪费（M-5）。
   */
  notMerge?: boolean;
}

export default function EChartBox({ option, style, notMerge = false }: EChartBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // 初始化一次
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // option 变化时仅 setOption（合并），不重建实例
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, notMerge);
  }, [option, notMerge]);

  return <div ref={containerRef} style={{ width: '100%', ...style }} />;
}
