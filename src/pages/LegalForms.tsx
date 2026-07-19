import { useEffect, useMemo, useState } from 'react';
import { Gavel, Search, Eye, Download, FileText, FileType, Scale } from 'lucide-react';
import { Input, Segmented } from 'antd';
import { useAppStore } from '../store/appStore';
import { BRAND } from '../constants/theme';
import { saveAs } from 'file-saver';

interface LegalForm {
  title: string;
  category: string[];
  shiyang: string;
  file: string;
  word?: string;
}

type CatFilter = '全部' | '行政' | '刑事' | '通用';

const base = import.meta.env.BASE_URL || '/';
const assetUrl = (file: string) => base + file.replace(/^\//, '');

const CAT_COLOR: Record<string, string> = {
  通用: '#2563EB',
  行政: '#059669',
  刑事: '#7C3AED',
};

// 行政/刑事筛选时，通用文书（行政刑事通用）同时出现
function matchCat(f: LegalForm, cat: CatFilter): boolean {
  if (cat === '全部') return true;
  if (cat === '通用') return f.category.includes('通用');
  if (cat === '行政') return f.category.includes('行政') || f.category.includes('通用');
  if (cat === '刑事') return f.category.includes('刑事') || f.category.includes('通用');
  return true;
}

export default function LegalForms() {
  const showToast = useAppStore((s) => s.showToast);
  const [forms, setForms] = useState<LegalForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<CatFilter>('全部');
  const [kw, setKw] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(assetUrl('forms/manifest.json'))
      .then((r) => {
        if (!r.ok) throw new Error('清单读取失败 ' + r.status);
        return r.json();
      })
      .then((data: LegalForm[]) => { if (alive) setForms(data); })
      .catch((e) => showToast('文书清单加载失败: ' + (e instanceof Error ? e.message : '未知错误'), 'error'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [showToast]);

  const stats = useMemo(() => ({
    total: forms.length,
    admin: forms.filter((f) => f.category.includes('行政') || f.category.includes('通用')).length,
    crim: forms.filter((f) => f.category.includes('刑事') || f.category.includes('通用')).length,
    common: forms.filter((f) => f.category.includes('通用')).length,
  }), [forms]);

  const list = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return forms.filter((f) => {
      if (!matchCat(f, cat)) return false;
      if (!k) return true;
      return (
        f.title.toLowerCase().includes(k) ||
        (f.shiyang || '').toLowerCase().includes(k)
      );
    });
  }, [forms, cat, kw]);

  const openPreview = (f: LegalForm) => {
    const url = assetUrl(f.file);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) showToast('浏览器拦截了新窗口，请允许弹出窗口后重试', 'warning');
  };

  const downloadFile = async (f: LegalForm, kind: 'pdf' | 'word') => {
    const isPdf = kind === 'pdf';
    const path = isPdf ? f.file : f.word;
    if (!path) {
      showToast('该文书暂未提供 Word 版', 'warning');
      return;
    }
    const fileName = `${f.title}.${isPdf ? 'pdf' : 'docx'}`.replace(/[<>"/\\|?*]/g, '_');
    try {
      const res = await fetch(assetUrl(path));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      saveAs(blob, fileName);
      showToast(`已下载：${fileName}`, 'success');
    } catch (e) {
      showToast('下载失败：' + (e instanceof Error ? e.message : '未知错误'), 'error');
    }
  };

  const Kpi = ({ label, val, ico, grad }: { label: string; val: number; ico: React.ReactNode; grad: string }) => (
    <div className="wb-kpi" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span className="wb-kpi-ico" style={{ background: grad, color: '#fff' }}>{ico}</span>
      <div>
        <div className="wb-kpi-label">{label}</div>
        <div className="wb-kpi-val">{val}<span className="wb-kpi-unit">份</span></div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '24px 28px 40px', maxWidth: 1240, margin: '0 auto', width: '100%' }}>
      {/* 头部 */}
      <div className="dash-hero" style={{ marginBottom: 18 }}>
        <span className="dash-hero-avatar" style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${BRAND.primaryDark},${BRAND.primaryLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 20px rgba(37,99,235,.3)' }}>
          <Gavel size={26} />
        </span>
        <div>
          <div className="dash-hero-greet">文书库</div>
          <div className="dash-hero-sub">公安行政 / 刑事法律文书式样 · 离线空白模板，支持 PDF 与 Word 双格式下载</div>
        </div>
        <div className="dash-hero-actions" style={{ flex: '0 0 auto', width: 320, maxWidth: '40vw' }}>
          <Input
            allowClear
            prefix={<Search size={15} />}
            placeholder="搜索文书名 / 式样号"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
        </div>
      </div>

      {/* KPI */}
      <div className="dash-kpi" style={{ marginBottom: 18 }}>
        <Kpi label="文书总数" val={stats.total} ico={<FileText size={24} />} grad={`linear-gradient(135deg,${BRAND.primaryDark},${BRAND.primaryLight})`} />
        <Kpi label="行政文书" val={stats.admin} ico={<Scale size={24} />} grad="linear-gradient(135deg,#0E7C4B,#38A169)" />
        <Kpi label="刑事法律文书" val={stats.crim} ico={<Gavel size={24} />} grad="linear-gradient(135deg,#6D28D9,#8B5CF6)" />
        <Kpi label="行政刑事通用" val={stats.common} ico={<FileType size={24} />} grad="linear-gradient(135deg,#1D4ED8,#3B82F6)" />
      </div>

      {/* 分类切换 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Segmented
          value={cat}
          onChange={(v) => setCat(v as CatFilter)}
          options={[
            { label: `全部 (${stats.total})`, value: '全部' },
            { label: `行政 (${stats.admin})`, value: '行政' },
            { label: `刑事 (${stats.crim})`, value: '刑事' },
            { label: `通用 (${stats.common})`, value: '通用' },
          ]}
        />
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {loading ? '加载中…' : `共 ${list.length} 份`}
        </span>
      </div>

      {/* 卡片网格 */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-secondary)' }}>正在加载文书库…</div>
      ) : list.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-secondary)' }}>没有匹配的文书</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {list.map((f) => (
            <div
              key={f.file}
              className="wb-panel"
              style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(37,99,235,.12)', color: BRAND.primaryDark }}>
                  <FileText size={20} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.35 }}>{f.title}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                    {f.shiyang && (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>{f.shiyang}</span>
                    )}
                    {f.category.map((c) => (
                      <span
                        key={c}
                        style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: `${CAT_COLOR[c]}1f`, color: CAT_COLOR[c], fontWeight: 600 }}
                      >{c}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
                <button className="dash-action" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openPreview(f)}>
                  <Eye size={15} /> 预览
                </button>
                <button className="dash-action" style={{ flex: 1, justifyContent: 'center' }} onClick={() => downloadFile(f, 'pdf')}>
                  <Download size={15} /> PDF
                </button>
                <button className="dash-action dash-action-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => downloadFile(f, 'word')}>
                  <FileType size={15} /> Word
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
