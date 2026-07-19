import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload, FileText, CheckCircle, XCircle } from 'lucide-react';
import { useAppStore } from "../store/appStore"
import {
  exportAllModulesToExcel,
  exportCasesToExcel,
  exportOperationLog,
  importExcelToModule,
  downloadModuleTemplate,
  exportCsv,
} from '../utils/excelUtils';
import { getMassRecords } from '../store/massStore';
import { getBaseModules } from '../moduleConfig';

interface VictimRow {
  [key: string]: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误';
}

export default function ImportExport({ noHeader }: { noHeader?: boolean }) {
    const showToast = useAppStore((s) => s.showToast);
  const [importResult, setImportResult] = useState<{
    show: boolean;
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  // 导入文件选择
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModuleId, setImportModuleId] = useState<string>('');

  const allModules = getBaseModules();

  const handleFileImport = async (file: File) => {
    if (!importModuleId) {
      showToast('请先选择目标模块', 'warning');
      return;
    }
    try {
      const result = await importExcelToModule(file, importModuleId);
      setImportResult({
        show: true,
        success: result.success,
        failed: result.failed,
        errors: result.errors,
      });
      if (result.success > 0) {
        showToast(`成功导入 ${result.success} 条记录`, 'success');
      }
    } catch (err) {
      showToast(`导入失败: ${getErrorMessage(err)}`, 'error');
    }
    setImportModuleId('');
  };

  // 导出受害人信息 CSV
  const handleExportVictimCsv = () => {
    const allRecords = getMassRecords();
    const victimData: VictimRow[] = [];
    for (const rec of allRecords) {
      const reporters = rec.data?.reporters;
      if (Array.isArray(reporters)) {
        for (const r of reporters) {
          victimData.push({
            '项目名称': String(rec.data?.projectName || rec.data?.caseName || ''),
            '受害人姓名': r.reporterName || '',
            '性别': r.reporterGender || '',
            '身份证号': r.reporterIdNo || '',
            '联系电话': r.reporterPhone || '',
            '投资金额': r.reporterAmount || '',
            '登记日期': rec.createdAt ? rec.createdAt.slice(0, 10).replace(/-/g, '/') : '',
          });
        }
      }
    }
    if (victimData.length === 0) {
      // 生成空模板
      victimData.push({
        '项目名称': '',
        '受害人姓名': '',
        '性别': '',
        '身份证号': '',
        '联系电话': '',
        '投资金额': '',
        '登记日期': '',
      });
    }
    exportCsv(
      ['项目名称', '受害人姓名', '性别', '身份证号', '联系电话', '投资金额', '登记日期'],
      victimData,
      '受害人信息',
    );
    showToast('正在生成 CSV...', 'info');
  };

  return (
    <div>
      {!noHeader && (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
          style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg, #1B5E9B, #2E7DCA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(27,94,155,.3)' }}>
          <Download size={20} color="#fff" />
        </motion.div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>导入导出</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>支持 Excel / CSV / JSON 格式</div>
        </div>
      </motion.div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* 导入区 */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: '#EBF5FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={22} color="#1B5E9B" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>数据导入</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>批量导入工作记录 · 先选模块再选文件</div>
            </div>
          </div>

          {/* 目标模块选择 */}
          <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={importModuleId}
              onChange={(e) => setImportModuleId(e.target.value)}
              style={{
                flex: 1, height: 36, padding: '0 10px', borderRadius: 6,
                border: '1.5px solid var(--color-border)', fontSize: 13, fontFamily: 'inherit',
                outline: 'none', background: 'var(--color-surface)', color: 'var(--color-text)',
              }}
            >
              <option value="">— 选择目标模块 —</option>
              {allModules.map((mod) => (
                <option key={mod.id} value={mod.id}>{mod.label}</option>
              ))}
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileImport(file);
                e.target.value = '';
              }}
            />
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (!importModuleId) {
                  showToast('请先选择目标模块', 'warning');
                  return;
                }
                fileInputRef.current?.click();
              }}
              style={{
                height: 36, padding: '0 16px', background: '#2E7DCA', color: '#fff',
                border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
              }}
            >
              <Upload size={14} />选择文件导入
            </motion.button>
          </div>

          {/* 导入结果展示 */}
          {importResult?.show && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{
                padding: 12, borderRadius: 8, marginBottom: 12,
                background: importResult.failed === 0 ? '#E8F5E9' : '#FFF3E0',
                border: `1px solid ${importResult.failed === 0 ? '#A5D6A7' : '#FFCC80'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {importResult.failed === 0
                  ? <CheckCircle size={16} color="#388E3C" />
                  : <XCircle size={16} color="#E67E22" />
                }
                <span style={{ fontSize: 13, fontWeight: 600, color: importResult.failed === 0 ? '#388E3C' : '#E67E22' }}>
                  导入完成
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                成功 {importResult.success} 条
                {importResult.failed > 0 && `，失败 ${importResult.failed} 条`}
              </div>
              {importResult.errors.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#DC2626' }}>
                  {importResult.errors.slice(0, 3).map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                  {importResult.errors.length > 3 && <div>……还有 {importResult.errors.length - 3} 条错误</div>}
                </div>
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={() => setImportResult(null)}
                style={{
                  marginTop: 8, padding: '4px 12px', background: 'none',
                  border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                关闭
              </motion.button>
            </motion.div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600, marginBottom: 2 }}>
              下载导入模板 →
            </div>
            {allModules.slice(0, 8).map((mod) => (
              <motion.button key={mod.id} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}
                onClick={() => {
                  downloadModuleTemplate(mod.id);
                  showToast(`正在下载「${mod.label}」模板`, 'info');
                }}
                style={{
                  padding: '8px 14px', background: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit', textAlign: 'left',
                }}>
                <FileText size={14} color="#1B5E9B" />
                <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{mod.label} 导入模板</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}>下载</span>
              </motion.button>
            ))}
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              点击模块名称下载对应导入模板（Excel 格式）
            </div>
          </div>
        </motion.div>

        {/* 导出区 */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}
          className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download size={22} color="#388E3C" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>数据导出</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>导出工作记录与案件台账</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ExportItem
              label="全部工作记录（Excel）"
              desc="含所有模块记录 · 按模块分 sheet"
              format="xlsx"
              onClick={() => {
                exportAllModulesToExcel();
                showToast('正在生成全部工作记录...', 'info');
              }}
            />
            <ExportItem
              label="案件台账（Excel）"
              desc="案件管理全字段导出"
              format="xlsx"
              onClick={() => {
                exportCasesToExcel();
                showToast('正在生成案件台账...', 'info');
              }}
            />
            <ExportItem
              label="受害人信息（CSV）"
              desc="涉众案件受害人信息 · 含投资详情"
              format="csv"
              onClick={handleExportVictimCsv}
            />
            <ExportItem
              label="系统操作日志（JSON）"
              desc="审计日志 · 全量导出"
              format="json"
              onClick={() => {
                exportOperationLog();
                showToast('正在导出操作日志...', 'info');
              }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/** 导出项按钮组件 */
function ExportItem({
  label, desc, format, onClick,
}: {
  label: string;
  desc: string;
  format: string;
  onClick: () => void;
}) {
  const formatColors: Record<string, string> = {
    xlsx: '#E8F5E9',
    csv: '#FFF3E0',
    json: '#EBF5FF',
  };
  const formatTextColors: Record<string, string> = {
    xlsx: '#388E3C',
    csv: '#E67E22',
    json: '#1B5E9B',
  };
  const bg = formatColors[format] || 'var(--color-surface-hover)';
  const tc = formatTextColors[format] || 'var(--color-text-secondary)';

  return (
    <motion.button
      whileHover={{ x: 4, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        padding: '11px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center',
        gap: 10, fontFamily: 'inherit', textAlign: 'left',
      }}
    >
      <div style={{
        fontSize: 9.5, padding: '1px 6px', borderRadius: 4,
        background: bg, color: tc, fontWeight: 700, fontFamily: 'monospace',
      }}>
        {format}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{desc}</div>
      </div>
      <Download size={14} color="var(--color-text-muted)" />
    </motion.button>
  );
}
