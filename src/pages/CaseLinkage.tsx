/**
 * 串并案分析页（P0-3）
 * 基于 caseLinkage 引擎，跨模块自动发现「同一身份证号 / 同一统一社会信用代码 / 同一银行账号」
 * 出现在≥2条记录中的疑似关联线索，供研判人员一键串并。
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Waypoints, Fingerprint, Building2, Wallet, Link2, ArrowRight, Info } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useDataChanged } from '../store/dataEvents';
import { getMassRecords, updateMassRecord } from '../store/massStore';
import { detectLinkageClusters, linkageSummary, type LinkKeyType, type LinkageCluster } from '../utils/caseLinkage';
import CaseDetail from './CaseDetail';
import type { MassRecord } from '../store/massStore';

const KEY_ICON: Record<LinkKeyType, React.ComponentType<{ size?: number; color?: string }>> = {
  idCard: Fingerprint,
  creditCode: Building2,
  bankAccount: Wallet,
};

const KEY_TINT: Record<LinkKeyType, { bg: string; color: string }> = {
  idCard: { bg: 'rgba(37,99,235,0.12)', color: '#2563EB' },
  creditCode: { bg: 'rgba(124,58,237,0.12)', color: '#7C3AED' },
  bankAccount: { bg: 'rgba(5,150,105,0.12)', color: '#059669' },
};

const KEY_TEXT: Record<LinkKeyType, string> = {
  idCard: '身份证号',
  creditCode: '统一社会信用代码',
  bankAccount: '银行账号',
};

type FilterType = 'all' | LinkKeyType;

export default function CaseLinkage() {
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const openModal = useAppStore((s) => s.openModal);
  const setEditRecord = useAppStore((s) => s.setEditRecord);
  const showToast = useAppStore((s) => s.showToast);
  const darkMode = useAppStore((s) => s.darkMode);
  const dataVersion = useDataChanged();

  const [filter, setFilter] = useState<FilterType>('all');
  const [onlyCross, setOnlyCross] = useState(false);
  const [detail, setDetail] = useState<MassRecord | null>(null);

  const records = useMemo(() => getMassRecords(), [dataVersion]);
  const allClusters = useMemo(() => detectLinkageClusters(records), [records]);
  const summary = useMemo(() => linkageSummary(allClusters), [allClusters]);

  const clusters = useMemo(
    () =>
      allClusters.filter(
        (c) => (filter === 'all' || c.keyType === filter) && (!onlyCross || c.isCrossModule)
      ),
    [allClusters, filter, onlyCross]
  );

  const textColor = 'var(--color-text)';
  const mutedColor = 'var(--color-text-secondary)';

  const handleLink = (cluster: LinkageCluster) => {
    const ids = cluster.hits.map((h) => h.record.id);
    let changed = 0;
    for (const h of cluster.hits) {
      const others = ids.filter((id) => id !== h.record.id);
      const cur = Array.isArray(h.record.data?.linkedRecordIds)
        ? (h.record.data!.linkedRecordIds as string[])
        : [];
      const merged = Array.from(new Set([...cur, ...others]));
      if (merged.length !== cur.length) changed += 1;
      updateMassRecord(h.record.id, { ...(h.record.data || {}), linkedRecordIds: merged });
    }
    if (changed > 0) showToast(`已建立关联，共串联 ${ids.length} 条记录`, 'success');
    else showToast('这些记录已关联，无需重复操作', 'info');
  };

  const openRecord = (rec: MassRecord) => {
    setEditRecord(rec);
    setCurrentPage(rec.moduleId);
    openModal('newRecord');
  };

  /* ── 空状态 ── */
  if (allClusters.length === 0) {
    return (
      <div className="dash">
        <div className="wb-panel" style={{ padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: 18, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Waypoints size={30} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: textColor, marginBottom: 8 }}>暂未发现串并案线索</div>
          <div style={{ fontSize: 13, color: mutedColor, marginBottom: 6, lineHeight: 1.7 }}>
            系统已扫描全部记录，目前没有「同一身份证号 / 同一统一社会信用代码 / 同一银行账号」<br />
            出现在 2 条及以上记录中的情况。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">
      {/* ── 头部：标题 + 概览 + 筛选 ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="wb-panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className="wb-panel-ico" style={{ background: 'rgba(37,99,235,0.12)', color: '#2563EB' }}>
            <Waypoints size={18} color="#2563EB" />
          </div>
          <div>
            <div className="wb-panel-title" style={{ fontSize: 17 }}>串并案分析</div>
            <div style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>
              跨模块强身份键自动匹配 · 同一身份证 / 信用代码 / 银行账号出现≥2次即预警
            </div>
          </div>
        </div>

        {/* 概览统计 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
          <SummaryStat label="疑似线索" value={summary.clusters} unit="条" color="#2563EB" />
          <SummaryStat label="涉及记录" value={summary.records} unit="条" color="#7C3AED" />
          <SummaryStat label="跨模块线索" value={summary.cross} unit="条" color="#DC2626" />
        </div>

        {/* 筛选 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {(['all', 'idCard', 'creditCode', 'bankAccount'] as FilterType[]).map((t) => {
            const active = filter === t;
            const label = t === 'all' ? '全部' : KEY_TEXT[t];
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="wb-hover-ghost"
                style={{
                  height: 32, padding: '0 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                  border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: active ? 'var(--color-primary-bg)' : 'transparent',
                  color: active ? 'var(--color-primary)' : mutedColor, fontWeight: active ? 700 : 500,
                }}
              >
                {label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setOnlyCross((v) => !v)}
            className="wb-hover-ghost"
            style={{
              height: 32, padding: '0 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
              border: `1px solid ${onlyCross ? 'var(--color-danger)' : 'var(--color-border)'}`,
              background: onlyCross ? 'var(--color-danger-bg)' : 'transparent',
              color: onlyCross ? 'var(--color-danger)' : mutedColor, fontWeight: onlyCross ? 700 : 500,
            }}
          >
            <Link2 size={14} /> 仅看跨模块
          </button>
        </div>
      </motion.div>

      {/* ── 线索卡片列表 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
        {clusters.map((c, i) => {
          const Icon = KEY_ICON[c.keyType];
          const tint = KEY_TINT[c.keyType];
          const isMerge = c.kind === 'merge';
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="wb-panel"
              style={{ padding: 18 }}
            >
              {/* 卡片头 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tint.bg, color: tint.color, flexShrink: 0 }}>
                  <Icon size={19} color={tint.color} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: tint.color, background: tint.bg, padding: '2px 8px', borderRadius: 6 }}>{KEY_TEXT[c.keyType]}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 14, color: textColor, letterSpacing: '0.03em' }}>{c.masked}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {c.moduleNames.map((m) => (
                      <span key={m} style={{ fontSize: 11, color: mutedColor, background: 'var(--color-surface-hover)', padding: '1px 7px', borderRadius: 5 }}>{m}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span className={`badge ${isMerge ? 'badge-danger' : 'badge-info'}`}>{isMerge ? '疑似串并案' : '疑似重复录入'}</span>
                  <span className="badge badge-info">{c.count} 条</span>
                  <button
                    onClick={() => handleLink(c)}
                    className="wb-hover-ghost"
                    style={{ height: 30, padding: '0 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', fontWeight: 600 }}
                  >
                    <Link2 size={13} /> 一键关联
                  </button>
                </div>
              </div>

              {/* 命中记录清单 */}
              <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: 8 }}>
                {c.hits.map((h) => (
                  <div
                    key={h.record.id}
                    onClick={() => setDetail(h.record)}
                    className="wb-hover-row"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</div>
                      <div style={{ fontSize: 11.5, color: mutedColor, marginTop: 2 }}>{h.moduleName}{h.updatedAt ? ` · 更新 ${h.updatedAt.slice(0, 10)}` : ''}</div>
                    </div>
                    <ArrowRight size={15} color="var(--color-text-muted)" />
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}

        {clusters.length === 0 && (
          <div className="wb-panel" style={{ padding: 32, textAlign: 'center', color: mutedColor, fontSize: 13 }}>
            当前筛选条件下没有线索
          </div>
        )}
      </div>

      {/* ── 说明 ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--color-info-bg)', color: 'var(--color-info)', fontSize: 12, lineHeight: 1.7 }}>
        <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          串并案识别基于<strong>强身份键精确匹配</strong>（同类型字段归一化后等值），区别于详情页的模糊关键词关联，噪音更低。
          「疑似重复录入」指同模块同案名下的多条记录，可能是同一案件多次登记；「疑似串并案」指跨模块或多案名，价值更高。
          点击「一键关联」会在这批记录间建立双向结构化关联，可在各记录详情的「关联与脉络」中查看。
        </span>
      </div>

      {detail && <CaseDetail record={detail} onClose={() => setDetail(null)} onOpenRelated={setDetail} />}
    </div>
  );
}

function SummaryStat({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div style={{ background: 'var(--color-surface-hover)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 8, height: 36, borderRadius: 4, background: color, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'monospace', lineHeight: 1.1 }}>
          {value}<span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 3 }}>{unit}</span>
        </div>
      </div>
    </div>
  );
}
