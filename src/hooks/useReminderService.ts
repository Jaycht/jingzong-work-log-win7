import { useEffect, useRef } from 'react';
import { getDailyNotes } from '../store/dailyNotesStore';
import { getMassRecords } from '../store/massStore';

const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;

const DISMISSED_KEY = 'jingzong.reminder.dismissed';
const TRIGGERED_KEY = 'jingzong.reminder.triggered';
const SNOOZED_KEY = 'jingzong.reminder.snoozed';

function getDismissed(): Set<string> {
  try { const raw = localStorage.getItem(DISMISSED_KEY); return raw ? new Set(JSON.parse(raw)) : new Set(); }
  catch { return new Set(); }
}

function addDismissed(id: string) {
  const s = getDismissed(); s.add(id);
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s])); } catch {}
}

function getTriggered(): Record<string, number> {
  try { const raw = localStorage.getItem(TRIGGERED_KEY); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}

function markTriggered(id: string) {
  const s = getTriggered(); s[id] = Date.now();
  try { localStorage.setItem(TRIGGERED_KEY, JSON.stringify(s)); } catch {}
}

function getSnoozed(): Record<string, number> {
  try { const raw = localStorage.getItem(SNOOZED_KEY); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}

function setSnoozed(id: string, untilMs: number) {
  const s = getSnoozed();
  s[id] = untilMs;
  try { localStorage.setItem(SNOOZED_KEY, JSON.stringify(s)); } catch {}
}

export function snoozeReminder(id: string, minutes: number) {
  setSnoozed(id, Date.now() + minutes * 60 * 1000);
}

export function dismissReminder(id: string) {
  addDismissed(id);
}

const LEGAL_RULES: Array<{ label: string; field: string; days: number }> = [
  { label: '受案→立案', field: 'receiveDate', days: 7 },
  { label: '刑事拘留', field: 'criminalDetentionDate', days: 30 },
  { label: '侦查羁押', field: 'filingDate', days: 60 },
  { label: '取保候审', field: 'bailDate', days: 365 },
  { label: '监视居住', field: 'residentialSurveillanceDate', days: 180 },
];

function parseDateField(val: any): Date | null {
  if (!val) return null;
  if (typeof val === 'string') { const d = new Date(val); return isNaN(d.getTime()) ? null : d; }
  if (val.$d) { const d = new Date(val.$d); return isNaN(d.getTime()) ? null : d; }
  if (val._isValid && val.toDate) { const d = val.toDate(); return isNaN(d.getTime()) ? null : d; }
  return null;
}

function checkLegalDeadlines(records: any[]): Array<{ id: string; title: string; body: string }> {
  const alerts: Array<{ id: string; title: string; body: string }> = [];
  const now = new Date();
  for (const rec of records) {
    const data = rec.data || rec;
    const suspects = data.suspects || [];
    for (const rule of LEGAL_RULES) {
      const targets = suspects.length > 0 ? suspects : [data];
      for (const target of targets) {
        const d = parseDateField(target[rule.field]);
        if (!d) continue;
        const deadline = new Date(d);
        deadline.setDate(deadline.getDate() + rule.days);
        const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7 && diffDays >= -30) {
          const caseName = data.caseName || data.caseNo || '';
          const suspectName = target.suspectName || '';
          alerts.push({
            id: `legal-${rec.id}-${rule.field}-${suspectName || 'main'}`,
            title: '法律时限预警',
            body: `${caseName}${suspectName ? ' ' + suspectName : ''} ${rule.label}剩余${diffDays}天`,
          });
        }
      }
    }
  }
  return alerts;
}

export function useReminderService() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isElectron) return;

    // 监听通知窗口的"稍后提醒"和"不再提醒"操作
    const api = (window as any).electronAPI;
    if (api.onReminderSnoozed) {
      api.onReminderSnoozed((data: { minutes: number; noteId: string }) => {
        if (data && data.noteId) snoozeReminder(data.noteId, data.minutes);
      });
    }
    if (api.onReminderDismissed) {
      api.onReminderDismissed((data: { noteId: string }) => {
        if (data && data.noteId) dismissReminder(data.noteId);
      });
    }

    function check() {
      const dismissed = getDismissed();
      const triggered = getTriggered();
      const snoozed = getSnoozed();
      const now = Date.now();

      // 日常随手记提醒
      try {
        const notes = getDailyNotes();
        for (const note of notes) {
          if (!note.reminder?.enabled || !note.reminder?.time) continue;
          if (dismissed.has(note.id)) continue;
          if (snoozed[note.id] && now < snoozed[note.id]) continue;

          const reminderTime = new Date(note.reminder.time).getTime();
          if (isNaN(reminderTime)) continue;
          if (now < reminderTime) continue;

          const repeat = note.reminder.repeat || 'none';
          const lastTriggered = triggered[note.id] || 0;
          let cooldownMs = 60000;

          if (repeat === 'daily') cooldownMs = 24 * 60 * 60 * 1000;
          else if (repeat === 'weekly') cooldownMs = 7 * 24 * 60 * 60 * 1000;
          else if (repeat === 'monthly') cooldownMs = 30 * 24 * 60 * 60 * 1000;
          else if (repeat === '30min') cooldownMs = 30 * 60 * 1000;
          else if (repeat === '1hour') cooldownMs = 60 * 60 * 1000;

          if (now - lastTriggered < cooldownMs) continue;

          api.showReminder(
            '日常随手记提醒',
            `${note.title || '未命名记录'} - ${note.type}`,
            note.reminder.sound || '',
            note.id,
          );
          markTriggered(note.id);
        }
      } catch {}

      // 法律时限预警 — 冷却 24 小时，每天最多提醒一次
      try {
        const records = getMassRecords();
        if (records.length > 0) {
          const alerts = checkLegalDeadlines(records);
          for (const alert of alerts) {
            if (dismissed.has(alert.id)) continue;
            const lastTriggered = triggered[alert.id] || 0;
            if (now - lastTriggered < 24 * 60 * 60 * 1000) continue;
            api.showReminder(alert.title, alert.body, '', '');
            markTriggered(alert.id);
          }
        }
      } catch {}
    }

    check();
    intervalRef.current = setInterval(check, 5000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);
}
