import { useEffect, useMemo, useState } from 'react';
import { Scale, Search, BookOpen, ChevronLeft, ExternalLink, Layers, Hash, ScrollText, CalendarClock, Star, ArrowRight, Link2 } from 'lucide-react';
import { Input } from 'antd';
import { useAppStore } from '../store/appStore';
import { BRAND } from '../constants/theme';
import { useLawPrefsStore, noteKey } from '../store/lawPrefsStore';

interface LawMeta {
  id: string;
  title: string;
  category: string;
  categoryName: string;
  file: string;
  source: string;
  sourceUrl: string;
  version: string;
  effectiveDate: string;
  articles: number;
  pending?: boolean;
  timeline?: { date: string; label: string }[];
}
interface Manifest {
  generatedAt: string;
  totalLaws: number;
  categories: { id: string; name: string; count: number }[];
  laws: LawMeta[];
}

interface ArticleBlock { kind: 'article'; num: string; body: string[]; }
interface SectionBlock { kind: 'section'; title: string; }
interface IntroBlock { kind: 'intro'; text: string; }
type Block = ArticleBlock | SectionBlock | IntroBlock;

const base = import.meta.env.BASE_URL || '/';
const assetUrl = (file: string) => base + file.replace(/^\//, '');

// 离线打包：法条文本随构建内联（?raw），避免 dev/prod 静态服务对「中文文件名」路径处理不一致导致取不到文件
const lawTextModules = import.meta.glob('../../public/laws/**/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// ── 经侦管辖77类案件专项 ──
interface EcCase {
  seq: number;
  num: string; // 第X条
  name: string; // 罪名
  criminalLawClause: string; // 「刑法（...）」整段
  criminalLawArticle: string; // 第X条（用于跳转刑法）
  standard: string[]; // 立案追诉标准正文
  relatedIds: string[];
}
// 已收录的关联司法解释映射（seq → law id）；其余案件待补充司法解释
const EC_RELATED: Record<number, string[]> = {
  2: ['司法解释/关于办理走私刑事案件适用法律若干问题的解释'],
  23: ['司法解释/最高人民法院、最高人民检察院关于办理非法集资刑事案件具体应用法律若干问题的解释'],
  43: ['司法解释/最高人民法院、最高人民检察院关于办理洗钱刑事案件适用法律若干问题的解释'],
  44: ['司法解释/最高人民法院、最高人民检察院关于办理非法集资刑事案件具体应用法律若干问题的解释'],
  10: ['司法解释/关于办理商业贿赂刑事案件适用法律若干问题的意见'],
  11: ['司法解释/关于办理商业贿赂刑事案件适用法律若干问题的意见'],
  12: ['司法解释/关于办理商业贿赂刑事案件适用法律若干问题的意见'],
  14: [
    '司法解释/最高人民法院关于审理伪造货币等案件具体应用法律若干问题的解释（二）',
    '司法解释/最高人民法院关于审理伪造货币等案件具体应用法律若干问题的解释',
  ],
  15: [
    '司法解释/最高人民法院关于审理伪造货币等案件具体应用法律若干问题的解释（二）',
    '司法解释/最高人民法院关于审理伪造货币等案件具体应用法律若干问题的解释',
  ],
  16: [
    '司法解释/最高人民法院关于审理伪造货币等案件具体应用法律若干问题的解释（二）',
    '司法解释/最高人民法院关于审理伪造货币等案件具体应用法律若干问题的解释',
  ],
  17: [
    '司法解释/最高人民法院关于审理伪造货币等案件具体应用法律若干问题的解释（二）',
    '司法解释/最高人民法院关于审理伪造货币等案件具体应用法律若干问题的解释',
  ],
  18: [
    '司法解释/最高人民法院关于审理伪造货币等案件具体应用法律若干问题的解释（二）',
    '司法解释/最高人民法院关于审理伪造货币等案件具体应用法律若干问题的解释',
  ],
  52: ['司法解释/最高人民法院、最高人民检察院关于办理危害税收征管刑事案件适用法律若干问题的解释'],
  55: ['司法解释/最高人民法院、最高人民检察院关于办理危害税收征管刑事案件适用法律若干问题的解释'],
  56: ['司法解释/最高人民法院、最高人民检察院关于办理危害税收征管刑事案件适用法律若干问题的解释'],
  57: ['司法解释/最高人民法院、最高人民检察院关于办理危害税收征管刑事案件适用法律若干问题的解释'],
  58: ['司法解释/最高人民法院、最高人民检察院关于办理危害税收征管刑事案件适用法律若干问题的解释'],
  59: ['司法解释/最高人民法院、最高人民检察院关于办理危害税收征管刑事案件适用法律若干问题的解释'],
  60: ['司法解释/最高人民法院、最高人民检察院关于办理危害税收征管刑事案件适用法律若干问题的解释'],
  61: ['司法解释/最高人民法院、最高人民检察院关于办理危害税收征管刑事案件适用法律若干问题的解释'],
  62: ['司法解释/最高人民法院、最高人民检察院关于办理危害税收征管刑事案件适用法律若干问题的解释'],
  63: ['司法解释/最高人民法院、最高人民检察院关于办理危害税收征管刑事案件适用法律若干问题的解释'],
  64: ['司法解释/最高人民法院、最高人民检察院关于办理危害税收征管刑事案件适用法律若干问题的解释'],
  65: ['司法解释/最高人民法院、最高人民检察院关于办理危害税收征管刑事案件适用法律若干问题的解释'],
  71: ['司法解释/最高人民法院、最高人民检察院关于办理非法从事资金支付结算业务、非法买卖外汇刑事案件适用法律若干问题的解释'],
  // 妨害信用卡管理 / 窃取收买非法提供信用卡信息（规定二 第25、26条）
  25: ['司法解释/最高人民法院、最高人民检察院关于办理妨害信用卡管理刑事案件具体应用法律若干问题的解释'],
  26: ['司法解释/最高人民法院、最高人民检察院关于办理妨害信用卡管理刑事案件具体应用法律若干问题的解释'],
  // 内幕交易、泄露内幕信息（规定二 第30条）
  30: ['司法解释/关于办理内幕交易、泄露内幕信息刑事案件具体应用法律若干问题的解释的理解与适用'],
  // 利用未公开信息交易（规定二 第31条）
  31: ['司法解释/最高人民法院、最高人民检察院关于办理利用未公开信息交易刑事案件适用法律若干问题的解释'],
  // 操纵证券、期货市场（规定二 第34条）
  34: ['司法解释/最高人民法院、最高人民检察院关于办理操纵证券、期货市场刑事案件适用法律若干问题的解释'],
  // 骗购外汇（规定二 第41条）
  41: ['司法解释/最高人民法院关于审理骗购外汇、非法买卖外汇刑事案件具体应用法律若干问题的解释'],
  // 组织、领导传销活动（规定二 第70条）
  70: ['司法解释/最高人民法院、最高人民检察院、公安部关于办理组织领导传销活动刑事案件适用法律若干问题的意见'],
  77: ['司法解释/最高人民法院、最高人民检察院关于办理虚假诉讼刑事案件适用法律若干问题的解释'],
};

const ART_RE = /^第([一二三四五六七八九十百零〇两]+)条(之一)?[　 \t]*(.*)$/;
const SECTION_RE = /^第([一二三四五六七八九十百零〇两]+)(编|章)[　 \t]*(.*)$/;

function parseLaw(md: string): { title: string; meta: string[]; blocks: Block[] } {
  const lines = md.split('\n');
  let title = '';
  const meta: string[] = [];
  const introLines: string[] = [];
  const blocks: Block[] = [];
  let curArt: { num: string; body: string[] } | null = null;

  const pushArt = () => {
    if (curArt) {
      blocks.push({ kind: 'article', num: curArt.num, body: curArt.body });
      curArt = null;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!title && /^#\s+/.test(line)) { title = line.replace(/^#\s+/, ''); continue; }
    if (line.startsWith('> ')) { meta.push(line.slice(2)); continue; }
    const am = line.match(ART_RE);
    if (am) {
      pushArt();
      const num = '第' + am[1] + '条' + (am[2] || '');
      const rest = am[3] || '';
      curArt = { num, body: rest ? [rest] : [] };
      continue;
    }
    const sm = line.match(SECTION_RE);
    if (sm) {
      pushArt();
      blocks.push({ kind: 'section', title: '第' + sm[1] + (sm[2] as string) + (sm[3] ? '　' + sm[3] : '') });
      continue;
    }
    if (line.trim() === '') continue;
    if (curArt) curArt.body.push(line.trim());
    else introLines.push(line.trim());
  }
  pushArt();
  if (introLines.length) blocks.unshift({ kind: 'intro', text: introLines.join('\n') });
  return { title, meta, blocks };
}

function highlight(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#FDE68A', color: '#7C2D12', borderRadius: 3, padding: '0 2px' }}>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function LegalKnowledge() {
  const showToast = useAppStore((s) => s.showToast);
  const darkMode = useAppStore((s) => s.darkMode);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<string>('全部');
  const [kw, setKw] = useState('');

  const [selected, setSelected] = useState<LawMeta | null>(null);
  const [lawText, setLawText] = useState<string>('');
  const [lawLoading, setLawLoading] = useState(false);
  const [articleQ, setArticleQ] = useState('');
  const [view, setView] = useState<'list' | 'mine' | 'ec77'>('list');
  const [ecQ, setEcQ] = useState('');
  const [selectedCase, setSelectedCase] = useState<EcCase | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [noteKeyActive, setNoteKeyActive] = useState<string | null>(null);
  const favorites = useLawPrefsStore((s) => s.favorites);
  const notes = useLawPrefsStore((s) => s.notes);
  const toggleFavorite = useLawPrefsStore((s) => s.toggleFavorite);
  const setNote = useLawPrefsStore((s) => s.setNote);

  useEffect(() => {
    let alive = true;
    fetch(assetUrl('laws/manifest.json'))
      .then((r) => { if (!r.ok) throw new Error('清单读取失败 ' + r.status); return r.json(); })
      .then((data: Manifest) => { if (alive) setManifest(data); })
      .catch((e) => showToast('法规清单加载失败: ' + (e instanceof Error ? e.message : '未知错误'), 'error'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [showToast]);

  const totalArticles = useMemo(
    () => (manifest ? manifest.laws.reduce((s, l) => s + (l.articles || 0), 0) : 0),
    [manifest]
  );
  const judicialCount = useMemo(
    () => (manifest ? manifest.laws.filter((l) => l.category === '司法解释').length : 0),
    [manifest]
  );

  const filteredLaws = useMemo(() => {
    if (!manifest) return [];
    const k = kw.trim().toLowerCase();
    return manifest.laws.filter((l) => {
      if (catFilter !== '全部' && l.category !== catFilter) return false;
      if (!k) return true;
      return l.title.toLowerCase().includes(k) || (l.source || '').toLowerCase().includes(k);
    });
  }, [manifest, catFilter, kw]);

  // 经侦77类专项：解析《立案追诉标准（二）》
  const ecLaw = useMemo(() => (manifest ? manifest.laws.find((l) => l.category === '经侦管辖') ?? null : null), [manifest]);
  const ecCases = useMemo<EcCase[]>(() => {
    if (!ecLaw) return [];
    const entry = Object.entries(lawTextModules).find(([k]) => k.endsWith(ecLaw.file));
    if (!entry || !entry[1]) return [];
    const parsedEc = parseLaw(entry[1]);
    const articles = parsedEc.blocks.filter((b): b is ArticleBlock => b.kind === 'article');
    return articles.map((a, i) => {
      const titleLine = a.body[0] || '';
      const name = titleLine.split(/[（(]/)[0].trim();
      const clauseM = titleLine.match(/刑法(.+?)[）)]/);
      const clause = clauseM ? clauseM[1].trim() : '';
      const artM = clause.match(/第[一二三四五六七八九十百零〇两]+条(?:之一)?/);
      const article = artM ? artM[0] : '';
      return {
        seq: i + 1,
        num: a.num,
        name,
        criminalLawClause: clause,
        criminalLawArticle: article,
        standard: a.body,
        relatedIds: EC_RELATED[i + 1] || [],
      };
    });
  }, [ecLaw, manifest]);

  const criminalLaw = useMemo(
    () => (manifest ? manifest.laws.find((l) => l.id === '刑事/刑法' || l.title === '刑法') ?? null : null),
    [manifest]
  );
  const gotoCriminalLaw = (article: string) => {
    if (!criminalLaw) return;
    setSelectedCase(null);
    setSelected(null);
    openLaw(criminalLaw);
    setArticleQ(article);
  };

  const openLaw = (law: LawMeta) => {
    setSelected(law);
    setArticleQ('');
    setLawText('');
    setShowTimeline(false);
    // 返回列表时滚动到顶部
    window.scrollTo({ top: 0 });
    if (law.pending) {
      // 原文待补充：直接展示占位详情
      setLawLoading(false);
      return;
    }
    setLawLoading(true);
    const entry = Object.entries(lawTextModules).find(([k]) => k.endsWith(law.file));
    if (entry && entry[1]) {
      setLawText(entry[1]);
      setLawLoading(false);
    } else {
      showToast('法条读取失败：未找到 ' + law.file, 'error');
      setLawLoading(false);
    }
  };

  const parsed = useMemo(() => (lawText ? parseLaw(lawText) : null), [lawText]);
  const articleBlocks = useMemo(
    () => (parsed ? parsed.blocks.filter((b): b is ArticleBlock => b.kind === 'article') : []),
    [parsed]
  );
  const shownArticles = useMemo(() => {
    const q = articleQ.trim();
    if (!q) return articleBlocks;
    return articleBlocks.filter((a) => (a.num + ' ' + a.body.join(' ')).includes(q));
  }, [articleBlocks, articleQ]);

  const Kpi = ({ label, val, ico, grad, unit }: { label: string; val: number; ico: React.ReactNode; grad: string; unit?: string }) => (
    <div className="wb-kpi" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span className="wb-kpi-ico" style={{ background: grad, color: '#fff' }}>{ico}</span>
      <div>
        <div className="wb-kpi-label">{label}</div>
        <div className="wb-kpi-val">{val}{unit && <span className="wb-kpi-unit">{unit}</span>}</div>
      </div>
    </div>
  );

  const panelBg = darkMode ? '#0e1626' : '#fff';
  const panelBorder = darkMode ? 'rgba(163,201,255,0.1)' : '#EAEFF5';
  const textColor = darkMode ? '#E6EAF2' : '#1F2937';
  const textMuted = darkMode ? '#8A94A6' : '#6B7280';

  // ── 待补充原文详情视图（pending） ──
  if (selected && selected.pending) {
    return (
      <div style={{ padding: '24px 28px 40px', maxWidth: 1080, margin: '0 auto', width: '100%' }}>
        <button className="dash-action" style={{ marginBottom: 16 }} onClick={() => setSelected(null)}>
          <ChevronLeft size={15} /> 返回法规库
        </button>
        <div className="dash-hero" style={{ marginBottom: 16 }}>
          <span className="dash-hero-avatar" style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${BRAND.primaryDark},${BRAND.primaryLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 20px rgba(37,99,235,.3)' }}>
            <Scale size={26} />
          </span>
          <div>
            <div className="dash-hero-greet">{selected.title}</div>
            <div className="dash-hero-sub">{selected.categoryName} · 原文待补充</div>
          </div>
          <span className="dash-action" style={{ marginLeft: 'auto', display: 'inline-flex', width: 'auto', flexShrink: 0, background: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A' }}>
            <ScrollText size={15} /> 待补充
          </span>
        </div>

        <div className="wb-panel" style={{ padding: 16, marginBottom: 16, background: panelBg, border: `1px solid ${panelBorder}` }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px', fontSize: 13, color: textMuted }}>
            {selected.source && <span><b style={{ color: textColor }}>来源：</b>{selected.source}</span>}
            {selected.version && <span><b style={{ color: textColor }}>版本：</b>{selected.version}</span>}
            {selected.effectiveDate && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CalendarClock size={13} /> 施行：{selected.effectiveDate}</span>}
          </div>
        </div>

        {selected.timeline && selected.timeline.length > 0 && (
          <div className="wb-panel" style={{ padding: 16, marginBottom: 16, background: panelBg, border: `1px solid ${panelBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: BRAND.primaryDark, fontSize: 14 }}>
              <CalendarClock size={15} /> 立法 / 修正时间轴（{selected.timeline.length}）
            </div>
            <div style={{ marginTop: 14, borderLeft: `2px solid ${BRAND.primaryLight}`, marginLeft: 6, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {selected.timeline.map((t, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: -24, top: 4, width: 11, height: 11, borderRadius: '50%', background: BRAND.primary, boxShadow: `0 0 0 3px ${panelBg}` }} />
                  <div style={{ fontSize: 12.5, color: BRAND.primaryDark, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{t.date}</div>
                  <div style={{ fontSize: 13, color: textColor, lineHeight: 1.65 }}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="wb-panel" style={{ padding: 24, marginBottom: 16, background: panelBg, border: `1px solid ${panelBorder}`, textAlign: 'center' }}>
          <ScrollText size={30} color={textMuted} />
          <div style={{ marginTop: 12, fontSize: 15, fontWeight: 800, color: textColor }}>本法原文待补充</div>
          <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.8, color: textMuted, maxWidth: 580, margin: '8px auto 0' }}>
            当前暂未收录逐字核对的官方全文（来源站点不可机器抓取，无法保证保真）。如需纳入，请提供可访问的官方源或原文文本，开发侧将把 .md 放入 <code style={{ background: 'var(--color-surface-hover)', padding: '1px 5px', borderRadius: 5 }}>public/laws/指导性文件/</code> 并取消「待补充」标记，即可在应用内阅读全文。
          </div>
        </div>
      </div>
    );
  }

  // ── 法条详情视图 ──
  if (selected && parsed) {
    return (
      <div style={{ padding: '24px 28px 40px', maxWidth: 1080, margin: '0 auto', width: '100%' }}>
        <button className="dash-action" style={{ marginBottom: 16 }} onClick={() => setSelected(null)}>
          <ChevronLeft size={15} /> 返回法规库
        </button>

        <div className="dash-hero" style={{ marginBottom: 16 }}>
          <span className="dash-hero-avatar" style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${BRAND.primaryDark},${BRAND.primaryLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 20px rgba(37,99,235,.3)' }}>
            <Scale size={26} />
          </span>
          <div>
            <div className="dash-hero-greet">{parsed.title}</div>
            <div className="dash-hero-sub">{selected.categoryName} · 共 {selected.articles} 条</div>
          </div>
          <button
            className="dash-action"
            style={{ marginLeft: 'auto', display: 'inline-flex', width: 'auto', flexShrink: 0, ...(favorites[selected.id] ? { background: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A' } : {}) }}
            onClick={(e) => { e.stopPropagation(); toggleFavorite(selected.id); }}
            title={favorites[selected.id] ? '取消收藏' : '收藏本法'}
          >
            <Star size={15} fill={favorites[selected.id] ? '#F59E0B' : 'none'} /> {favorites[selected.id] ? '已收藏' : '收藏'}
          </button>
        </div>

        {/* 来源信息 */}
        <div className="wb-panel" style={{ padding: 16, marginBottom: 16, background: panelBg, border: `1px solid ${panelBorder}` }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px', fontSize: 13, color: textMuted }}>
            {selected.source && <span><b style={{ color: textColor }}>来源：</b>{selected.source}</span>}
            {selected.version && <span><b style={{ color: textColor }}>版本：</b>{selected.version}</span>}
            {selected.effectiveDate && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CalendarClock size={13} /> 施行：{selected.effectiveDate}</span>}
          </div>
        </div>

        {/* 立法 / 修正时间轴 */}
        {selected.timeline && selected.timeline.length > 0 && (
          <div className="wb-panel" style={{ padding: 16, marginBottom: 16, background: panelBg, border: `1px solid ${panelBorder}` }}>
            <button
              className="wb-hover-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: BRAND.primaryDark, fontSize: 14, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => setShowTimeline((v) => !v)}
            >
              <CalendarClock size={15} /> 立法 / 修正时间轴（{selected.timeline.length}）
              <span style={{ color: textMuted, fontSize: 12, fontWeight: 500 }}>{showTimeline ? '收起' : '展开'}</span>
            </button>
            {showTimeline && (
              <div style={{ marginTop: 14, borderLeft: `2px solid ${BRAND.primaryLight}`, marginLeft: 6, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {selected.timeline.map((t, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: -24, top: 4, width: 11, height: 11, borderRadius: '50%', background: BRAND.primary, boxShadow: `0 0 0 3px ${panelBg}` }} />
                    <div style={{ fontSize: 12.5, color: BRAND.primaryDark, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{t.date}</div>
                    <div style={{ fontSize: 13, color: textColor, lineHeight: 1.65 }}>{t.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 法条内搜索 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <Input
            allowClear
            prefix={<Search size={15} />}
            placeholder="搜索本法的法条内容（如：行贿、拘留、监视居住）"
            value={articleQ}
            onChange={(e) => setArticleQ(e.target.value)}
            style={{ maxWidth: 460 }}
          />
          <span style={{ fontSize: 13, color: textMuted }}>
            {articleQ.trim() ? `命中 ${shownArticles.length} 条` : `全部 ${articleBlocks.length} 条`}
          </span>
        </div>

        {lawLoading ? (
          <div style={{ padding: 60, textAlign: 'center', color: textMuted }}>正在加载法条…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {shownArticles.length === 0 && (
              <div style={{ padding: 50, textAlign: 'center', color: textMuted }}>未找到匹配的法条</div>
            )}
            {parsed.blocks.map((b, i) => {
              if (b.kind === 'intro') {
                return (
                  <div key={'intro' + i} style={{ padding: '4px 2px', color: textMuted, fontSize: 14, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                    {b.text}
                  </div>
                );
              }
              if (b.kind === 'section') {
                return (
                  <div key={'sec' + i} style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${panelBorder}`, fontSize: 16, fontWeight: 800, color: BRAND.primaryDark, letterSpacing: '0.02em' }}>
                    {b.title}
                  </div>
                );
              }
              // article
              const matchQ = articleQ.trim();
              if (matchQ && !shownArticles.includes(b)) return null;
              const nk = noteKey(selected.id, b.num);
              const hasNote = !!notes[nk];
              return (
                <div key={'art' + i} className="wb-panel" style={{ padding: '12px 16px', background: panelBg, border: `1px solid ${panelBorder}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: BRAND.primaryDark }}>{highlight(b.num, matchQ)}</div>
                    <button
                      className="wb-hover-ghost"
                      onClick={() => setNoteKeyActive(noteKeyActive === nk ? null : nk)}
                      style={{ fontSize: 12, color: hasNote ? BRAND.primary : '#9CA3AF', background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                      title={hasNote ? '查看/编辑笔记' : '为这一条添加笔记'}
                    >
                      <ScrollText size={13} /> {hasNote ? '笔记' : '加笔记'}
                    </button>
                  </div>
                  {b.body.map((p, pi) => (
                    <div key={pi} style={{ fontSize: 14.5, lineHeight: 1.95, color: textColor, whiteSpace: 'pre-wrap', marginTop: 4 }}>
                      {highlight(p, matchQ)}
                    </div>
                  ))}
                  {noteKeyActive === nk && (
                    <textarea
                      defaultValue={notes[nk] || ''}
                      placeholder="写下你对这一条的笔记 / 办案提示…"
                      onChange={(e) => setNote(nk, e.target.value)}
                      style={{ marginTop: 10, width: '100%', minHeight: 72, borderRadius: 10, border: `1px solid ${panelBorder}`, padding: '8px 10px', fontSize: 13.5, lineHeight: 1.7, color: textColor, background: darkMode ? '#0b1220' : '#F8FAFC', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── 我的收藏 / 笔记视图 ──
  if (view === 'mine') {
    const favLaws = (manifest?.laws ?? []).filter((l) => favorites[l.id]);
    const lawById = new Map((manifest?.laws ?? []).map((l) => [l.id, l]));
    const noteEntries = Object.entries(notes)
      .map(([k, text]) => {
        const idx = k.indexOf('#');
        const lawId = idx >= 0 ? k.slice(0, idx) : k;
        const art = idx >= 0 ? k.slice(idx + 1) : '';
        const law = lawById.get(lawId);
        return law ? { law, art, text } : null;
      })
      .filter((n): n is { law: LawMeta; art: string; text: string } => n !== null);
    return (
      <div style={{ padding: '24px 28px 40px', maxWidth: 1080, margin: '0 auto', width: '100%' }}>
        <button className="dash-action" style={{ marginBottom: 16 }} onClick={() => setView('list')}>
          <ChevronLeft size={15} /> 返回法规库
        </button>
        <div className="dash-hero" style={{ marginBottom: 18 }}>
          <span className="dash-hero-avatar" style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,#B45309,#F59E0B)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 20px rgba(245,158,11,.3)' }}>
            <Star size={26} />
          </span>
          <div>
            <div className="dash-hero-greet">我的收藏 / 笔记</div>
            <div className="dash-hero-sub">收藏 {favLaws.length} 部 · 条文笔记 {noteEntries.length} 条（本地离线保存）</div>
          </div>
        </div>

        {favLaws.length === 0 && noteEntries.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: textMuted }}>还没有收藏或笔记。在法规详情页点击「收藏」或为某条点击「加笔记」即可。</div>
        ) : (
          <>
            {favLaws.length > 0 && (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: textColor, margin: '6px 0 12px' }}>收藏的法规</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14, marginBottom: 26 }}>
                  {favLaws.map((l) => (
                    <div
                      key={l.id}
                      className="wb-panel"
                      style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', background: panelBg, border: `1px solid ${panelBorder}` }}
                      onClick={() => { setView('list'); openLaw(l); }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(37,99,235,.12)', color: BRAND.primaryDark }}>
                          <BookOpen size={20} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: textColor, lineHeight: 1.35 }}>{l.title}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: `${BRAND.primaryDark}1f`, color: BRAND.primaryDark, fontWeight: 600 }}>{l.categoryName}</span>
                            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'var(--color-surface-hover)', color: textMuted, border: `1px solid ${panelBorder}` }}>{l.articles} 条</span>
                          </div>
                        </div>
                        <button
                          className="wb-hover-ghost"
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(l.id); }}
                          style={{ flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: BRAND.primary, padding: 4 }}
                          title="取消收藏"
                        >
                          <Star size={18} fill="#F59E0B" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {noteEntries.length > 0 && (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: textColor, margin: '6px 0 12px' }}>条文笔记</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {noteEntries.map((n, ni) => (
                    <div
                      key={ni}
                      className="wb-panel"
                      style={{ padding: '12px 16px', background: panelBg, border: `1px solid ${panelBorder}`, cursor: 'pointer' }}
                      onClick={() => { setView('list'); openLaw(n.law); }}
                    >
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: BRAND.primaryDark, marginBottom: 6 }}>{n.law.title} · {n.art}</div>
                      <div style={{ fontSize: 13.5, lineHeight: 1.7, color: textColor, whiteSpace: 'pre-wrap' }}>{n.text}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  // ── 经侦77类专项：案件详情 ──
  if (view === 'ec77' && selectedCase) {
    const c = selectedCase;
    const lawById = new Map((manifest?.laws ?? []).map((l) => [l.id, l]));
    const related = c.relatedIds.map((id) => lawById.get(id)).filter((x): x is LawMeta => !!x);
    return (
      <div style={{ padding: '24px 28px 40px', maxWidth: 1080, margin: '0 auto', width: '100%' }}>
        <button className="dash-action" style={{ marginBottom: 16 }} onClick={() => setSelectedCase(null)}>
          <ChevronLeft size={15} /> 返回77类案件
        </button>
        <div className="dash-hero" style={{ marginBottom: 16 }}>
          <span className="dash-hero-avatar" style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${BRAND.primaryDark},${BRAND.primaryLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 20px rgba(37,99,235,.3)' }}>
            <Scale size={26} />
          </span>
          <div>
            <div className="dash-hero-greet">{c.name}</div>
            <div className="dash-hero-sub">经侦管辖第 {String(c.seq).padStart(2, '0')} 类 · {c.num}</div>
          </div>
          {c.criminalLawClause && (
            <span className="dash-action" style={{ marginLeft: 'auto', display: 'inline-flex', width: 'auto', flexShrink: 0, background: 'rgba(37,99,235,.1)', color: BRAND.primaryDark, borderColor: 'rgba(37,99,235,.25)' }}>
              <BookOpen size={15} /> 刑法{c.criminalLawClause}
            </span>
          )}
        </div>

        <div className="wb-panel" style={{ padding: 18, marginBottom: 16, background: panelBg, border: `1px solid ${panelBorder}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.primaryDark, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ScrollText size={15} /> 立案追诉标准（规定（二）{c.num}）
          </div>
          {c.standard.map((p, pi) => (
            <div key={pi} style={{ fontSize: 14.5, lineHeight: 1.95, color: textColor, whiteSpace: 'pre-wrap', marginTop: 4 }}>
              {p}
            </div>
          ))}
        </div>

        {c.criminalLawArticle && (
          <div style={{ marginBottom: 16 }}>
            <button className="dash-action" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => gotoCriminalLaw(c.criminalLawArticle)}>
              <BookOpen size={15} /> 跳转刑法{c.criminalLawArticle} <ArrowRight size={14} />
            </button>
          </div>
        )}

        <div className="wb-panel" style={{ padding: 18, background: panelBg, border: `1px solid ${panelBorder}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.primaryDark, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link2 size={15} /> 关联司法解释（{related.length}）
          </div>
          {related.length === 0 ? (
            <div style={{ fontSize: 13.5, color: textMuted, lineHeight: 1.8 }}>
              本类案件暂无已收录的关联司法解释。可在「法规库」补充相关两高解释后自动关联；建议补充清单见更新说明。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {related.map((r) => (
                <div
                  key={r.id}
                  className="wb-panel"
                  style={{ padding: '12px 14px', cursor: 'pointer', background: darkMode ? '#0b1220' : '#F8FAFC', border: `1px solid ${panelBorder}` }}
                  onClick={() => { setSelectedCase(null); openLaw(r); }}
                >
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: textColor }}>{r.title}</div>
                  <div style={{ fontSize: 12.5, color: textMuted, marginTop: 4 }}>{r.version}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 经侦77类专项：案件索引 ──
  if (view === 'ec77') {
    const q = ecQ.trim();
    const list = ecCases.filter((c) => {
      if (!q) return true;
      return c.name.includes(q) || c.num.includes(q) || c.criminalLawClause.includes(q);
    });
    const lawById = new Map((manifest?.laws ?? []).map((l) => [l.id, l]));
    return (
      <div style={{ padding: '24px 28px 40px', maxWidth: 1240, margin: '0 auto', width: '100%' }}>
        <div className="dash-hero" style={{ marginBottom: 18 }}>
          <span className="dash-hero-avatar" style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${BRAND.primaryDark},${BRAND.primaryLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 20px rgba(37,99,235,.3)' }}>
            <Scale size={26} />
          </span>
          <div>
            <div className="dash-hero-greet">经侦管辖 · 77类案件</div>
            <div className="dash-hero-sub">围绕77类案件的立案追诉标准、对应刑法条文与关联司法解释（离线专项）</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            allowClear
            prefix={<Search size={15} />}
            placeholder="搜索罪名 / 刑法条文（如：洗钱、第一百九十一条）"
            value={ecQ}
            onChange={(e) => setEcQ(e.target.value)}
            style={{ maxWidth: 520 }}
          />
          <button className="dash-action" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setView('list')}>
            <ChevronLeft size={15} /> 返回法规库
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 12 }}>
          {list.map((c) => {
            const related = c.relatedIds.map((id) => lawById.get(id)).filter((x): x is LawMeta => !!x);
            return (
              <div
                key={c.seq}
                className="wb-panel"
                style={{ padding: 14, cursor: 'pointer', background: panelBg, border: `1px solid ${panelBorder}`, display: 'flex', flexDirection: 'column', gap: 10 }}
                onClick={() => setSelectedCase(c)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: BRAND.primary, borderRadius: 8, padding: '3px 8px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{String(c.seq).padStart(2, '0')}</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: textColor, lineHeight: 1.35 }}>{c.name}</div>
                </div>
                {c.criminalLawClause && (
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: `${BRAND.primaryDark}1f`, color: BRAND.primaryDark, fontWeight: 600, alignSelf: 'flex-start' }}>刑法{c.criminalLawClause}</span>
                )}
                {related.length > 0 && (
                  <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 999, background: 'var(--color-surface-hover)', color: textMuted, border: `1px solid ${panelBorder}`, alignSelf: 'flex-start' }}>
                    关联司法解释 ×{related.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── 法规库列表视图 ──
  return (
    <div style={{ padding: '24px 28px 40px', maxWidth: 1240, margin: '0 auto', width: '100%' }}>
      <div className="dash-hero" style={{ marginBottom: 18 }}>
        <span className="dash-hero-avatar" style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${BRAND.primaryDark},${BRAND.primaryLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 20px rgba(37,99,235,.3)' }}>
          <Scale size={26} />
        </span>
        <div>
          <div className="dash-hero-greet">典法查阅</div>
          <div className="dash-hero-sub">宪法 · 刑事 · 行政 · 公安专项 · 监察 · 两高司法解释 · 指导性文件，全量官方法条离线检索</div>
        </div>
        <div className="dash-hero-actions" style={{ flex: '0 0 auto', width: 400, maxWidth: '48vw', display: 'flex', gap: 10 }}>
          <Input
            allowClear
            prefix={<Search size={15} />}
            placeholder="搜索法律名称 / 来源"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
          <button
            className="dash-action"
            style={{ width: 'auto', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, ...(view === 'ec77' ? { background: BRAND.primary, color: '#fff', borderColor: BRAND.primary } : {}) }}
            onClick={() => { setSelected(null); setSelectedCase(null); setEcQ(''); setView('ec77'); }}
          >
            <Scale size={15} /> 经侦77类
          </button>
          <button
            className="dash-action"
            style={{ width: 'auto', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => { setSelected(null); setSelectedCase(null); setView('mine'); }}
          >
            <Star size={15} /> 我的收藏/笔记{(Object.keys(favorites).length > 0 || Object.keys(notes).length > 0) ? ` (${Object.keys(favorites).length + Object.keys(notes).length})` : ''}
          </button>
        </div>
      </div>

      <div className="dash-kpi" style={{ marginBottom: 18 }}>
        <Kpi label="法律法规" val={manifest?.totalLaws ?? 0} ico={<BookOpen size={24} />} grad={`linear-gradient(135deg,${BRAND.primaryDark},${BRAND.primaryLight})`} unit="部" />
        <Kpi label="法律分类" val={manifest?.categories.length ?? 0} ico={<Layers size={24} />} grad="linear-gradient(135deg,#0E7C4B,#38A169)" unit="类" />
        <Kpi label="收录法条" val={totalArticles} ico={<Hash size={24} />} grad="linear-gradient(135deg,#1D4ED8,#3B82F6)" unit="条" />
        <Kpi label="司法解释" val={judicialCount} ico={<ScrollText size={24} />} grad="linear-gradient(135deg,#6D28D9,#8B5CF6)" unit="件" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 18, alignItems: 'start' }}>
        {/* 分类侧栏 */}
        <div className="wb-panel" style={{ padding: 10, background: panelBg, border: `1px solid ${panelBorder}`, position: 'sticky', top: 12 }}>
          <div
            onClick={() => setCatFilter('全部')}
            className="wb-hover-ghost"
            style={{ padding: '9px 12px', borderRadius: 10, cursor: 'pointer', fontWeight: catFilter === '全部' ? 800 : 500, color: catFilter === '全部' ? BRAND.primary : textColor, background: catFilter === '全部' ? (darkMode ? 'rgba(37,99,235,.18)' : 'rgba(37,99,235,.1)') : 'transparent', fontSize: 14 }}
          >
            全部法规 ({manifest?.totalLaws ?? 0})
          </div>
          {(manifest?.categories ?? []).map((c) => (
            <div
              key={c.id}
              onClick={() => setCatFilter(c.id)}
              className="wb-hover-ghost"
              style={{ padding: '9px 12px', borderRadius: 10, cursor: 'pointer', fontWeight: catFilter === c.id ? 800 : 500, color: catFilter === c.id ? BRAND.primary : textColor, background: catFilter === c.id ? (darkMode ? 'rgba(37,99,235,.18)' : 'rgba(37,99,235,.1)') : 'transparent', fontSize: 14, display: 'flex', justifyContent: 'space-between' }}
            >
              <span>{c.name}</span>
              <span style={{ color: textMuted }}>{c.count}</span>
            </div>
          ))}
        </div>

        {/* 卡片网格 */}
        <div>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: textMuted }}>正在加载法规库…</div>
          ) : filteredLaws.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: textMuted }}>没有匹配的法律</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
              {filteredLaws.map((l) => (
                <div
                  key={l.id}
                  className="wb-panel"
                  style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', background: panelBg, border: `1px solid ${panelBorder}` }}
                  onClick={() => openLaw(l)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(37,99,235,.12)', color: BRAND.primaryDark }}>
                      <BookOpen size={20} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: textColor, lineHeight: 1.35 }}>{l.title}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: `${BRAND.primaryDark}1f`, color: BRAND.primaryDark, fontWeight: 600 }}>{l.categoryName}</span>
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'var(--color-surface-hover)', color: textMuted, border: `1px solid ${panelBorder}` }}>{l.articles} 条</span>
                      </div>
                    </div>
                    <button
                      className="wb-hover-ghost"
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(l.id); }}
                      style={{ flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: favorites[l.id] ? BRAND.primary : '#9CA3AF', padding: 4, alignSelf: 'flex-start' }}
                      title={favorites[l.id] ? '取消收藏' : '收藏'}
                    >
                      <Star size={18} fill={favorites[l.id] ? '#F59E0B' : 'none'} />
                    </button>
                  </div>
                  {l.version && (
                    <div style={{ fontSize: 12.5, color: textMuted, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {l.version}
                    </div>
                  )}
                  {l.source && (
                    <div style={{ fontSize: 12, color: textMuted, marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <ExternalLink size={12} /> {l.source}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
