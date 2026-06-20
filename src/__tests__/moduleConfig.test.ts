/**
 * Tests for moduleConfig utilities
 */
import { describe, it, expect } from 'vitest';
import { isFieldVisible, filterVisibleFields, MODULE_NAMES, MODULE_INFO, getBaseModules, findModule } from '../moduleConfig';
import type { FieldDefinition } from '../moduleConfig';

describe('moduleConfig', () => {
  describe('MODULE_NAMES', () => {
    it('should have entries for all modules', () => {
      expect(Object.keys(MODULE_NAMES).length).toBeGreaterThan(0);
    });

    it('should map module IDs to Chinese labels', () => {
      expect(MODULE_NAMES['mass-clue']).toContain('涉众');
      expect(MODULE_NAMES['squad-case']).toContain('中队');
    });
  });

  describe('MODULE_INFO', () => {
    it('should include department info', () => {
      expect(MODULE_INFO['mass-clue']?.dept).toBe('涉众办');
      expect(MODULE_INFO['squad-case']?.dept).toBe('案件中队');
    });
  });

  describe('getBaseModules', () => {
    it('should return all modules', () => {
      const modules = getBaseModules();
      expect(modules.length).toBeGreaterThan(0);
    });
  });

  describe('findModule', () => {
    it('should find existing module', () => {
      const mod = findModule('mass-clue');
      expect(mod).toBeDefined();
      expect(mod?.label).toContain('涉众');
    });

    it('should return undefined for non-existent module', () => {
      const mod = findModule('non-existent');
      expect(mod).toBeUndefined();
    });
  });

  describe('isFieldVisible', () => {
    it('should show field when no hiddenForRoles', () => {
      const field: FieldDefinition = { id: 'test', label: 'Test', type: 'text' };
      expect(isFieldVisible(field, '普通用户')).toBe(true);
    });

    it('should hide field for specified role', () => {
      const field: FieldDefinition = { id: 'test', label: 'Test', type: 'text', hiddenForRoles: ['普通用户'] };
      expect(isFieldVisible(field, '普通用户')).toBe(false);
    });

    it('should show field for non-hidden role', () => {
      const field: FieldDefinition = { id: 'test', label: 'Test', type: 'text', hiddenForRoles: ['普通用户'] };
      expect(isFieldVisible(field, '管理员')).toBe(true);
    });
  });

  describe('filterVisibleFields', () => {
    it('should filter out hidden fields', () => {
      const fields: FieldDefinition[] = [
        { id: 'a', label: 'A', type: 'text' },
        { id: 'b', label: 'B', type: 'text', hiddenForRoles: ['普通用户'] },
        { id: 'c', label: 'C', type: 'text' },
      ];
      const visible = filterVisibleFields(fields, '普通用户');
      expect(visible.length).toBe(2);
      expect(visible.map((f) => f.id)).toEqual(['a', 'c']);
    });

    it('should keep all fields for admin', () => {
      const fields: FieldDefinition[] = [
        { id: 'a', label: 'A', type: 'text', hiddenForRoles: ['普通用户'] },
        { id: 'b', label: 'B', type: 'text', hiddenForRoles: ['普通用户'] },
      ];
      const visible = filterVisibleFields(fields, '管理员');
      expect(visible.length).toBe(2);
    });
  });
});
