import { useEffect, useMemo, useState } from 'react';
import { DEPARTMENTS, getBaseModules, type FieldDefinition, type WorkModule } from './moduleConfig';
import { localStorageAdapter } from './store/adapter';

const STORAGE_KEY = 'jingzong.customModules.v1';

const defaultFields: FieldDefinition[] = [
  { id: 'title', label: '记录标题', type: 'text', required: true },
  { id: 'recordDate', label: '记录日期', type: 'date', required: true },
  { id: 'content', label: '工作内容', type: 'textarea', required: true },
];

export function loadCustomModules(): WorkModule[] {
  return localStorageAdapter.getItem<WorkModule[]>(STORAGE_KEY, []);
}

function saveCustomModules(modules: WorkModule[]) {
  localStorageAdapter.setItem(STORAGE_KEY, modules);
}

function notifyCustomModulesUpdated() {
  window.dispatchEvent(new Event('jingzong-custom-modules-updated'));
}

export function createCustomModule(input: {
  departmentId: string;
  label: string;
  description?: string;
  fields: FieldDefinition[];
}): WorkModule {
  const department = DEPARTMENTS.find((item) => item.id === input.departmentId) || DEPARTMENTS[0];
  const id = `custom-${input.departmentId}-${Date.now()}`;
  const fields = input.fields.length ? input.fields : defaultFields;

  return {
    id,
    label: input.label,
    departmentId: department.id,
    departmentLabel: department.label,
    description: input.description || '用户自定义工作模块',
    tabs: [
      {
        id: `${id}-main`,
        label: '记录信息',
        fields,
      },
    ],
  };
}

export function useCustomModules() {
  const [customModules, setCustomModules] = useState<WorkModule[]>(() => loadCustomModules());

  useEffect(() => {
    const refresh = () => setCustomModules(loadCustomModules());
    window.addEventListener('jingzong-custom-modules-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('jingzong-custom-modules-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const allModules = useMemo(() => [...getBaseModules(), ...customModules], [customModules]);

  const addCustomModule = (module: WorkModule) => {
    setCustomModules((prev) => {
      const next = [...prev, module];
      saveCustomModules(next);
      setTimeout(notifyCustomModulesUpdated, 0);
      return next;
    });
  };

  const removeCustomModule = (id: string) => {
    setCustomModules((prev) => {
      const next = prev.filter((module) => module.id !== id);
      saveCustomModules(next);
      setTimeout(notifyCustomModulesUpdated, 0);
      return next;
    });
  };

  return { customModules, allModules, addCustomModule, removeCustomModule };
}
