import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { selection } from '../selection';
import { elements } from '../elements';
import type { DiagramElement } from '$lib/types/diagram';

describe('Selection Store', () => {
  const mockElements: DiagramElement[] = [
    {
      id: 'elem1',
      type: 'vessel',
      name: 'Vessel 1',
      x: 100,
      y: 100,
      width: 50,
      height: 80,
      color: '#ff0000'
    },
    {
      id: 'elem2', 
      type: 'pump',
      name: 'Pump 1',
      x: 200,
      y: 150,
      width: 40,
      height: 40,
      color: '#00ff00'
    },
    {
      id: 'elem3',
      type: 'vessel',
      name: 'Vessel 2', 
      x: 300,
      y: 200,
      width: 50,
      height: 80,
      color: '#ff0000'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    selection.clear();
    
    // Mock the elements store
    elements.clear();
    mockElements.forEach(elem => elements.addElement(elem));
  });

  describe('initialization', () => {
    it('should initialize with empty selection', () => {
      expect(get(selection.hasSelection)).toBe(false);
      expect(get(selection.selectionCount)).toBe(0);
      expect(selection.getSelectedIds()).toHaveLength(0);
    });
  });

  describe('single selection', () => {
    it('should select single element', () => {
      selection.select('elem1');
      
      expect(selection.isSelected('elem1')).toBe(true);
      expect(get(selection.hasSelection)).toBe(true);
      expect(get(selection.selectionCount)).toBe(1);
      expect(selection.getSelectedIds()).toEqual(['elem1']);
    });

    it('should replace selection when selecting without add flag', () => {
      selection.select('elem1');
      selection.select('elem2');
      
      expect(selection.isSelected('elem1')).toBe(false);
      expect(selection.isSelected('elem2')).toBe(true);
      expect(get(selection.selectionCount)).toBe(1);
    });

    it('should add to selection when using add flag', () => {
      selection.select('elem1');
      selection.select('elem2', true);
      
      expect(selection.isSelected('elem1')).toBe(true);
      expect(selection.isSelected('elem2')).toBe(true);
      expect(get(selection.selectionCount)).toBe(2);
      expect(get(selection.hasMultipleSelection)).toBe(true);
    });

    it('should track last selected element', () => {
      selection.select('elem1');
      selection.select('elem2', true);
      
      const lastSelected = selection.getLastSelected();
      expect(lastSelected?.id).toBe('elem2');
    });
  });

  describe('multiple selection', () => {
    it('should select multiple elements', () => {
      selection.selectMultiple(['elem1', 'elem2']);
      
      expect(get(selection.selectionCount)).toBe(2);
      expect(selection.isSelected('elem1')).toBe(true);
      expect(selection.isSelected('elem2')).toBe(true);
    });

    it('should add multiple elements to existing selection', () => {
      selection.select('elem1');
      selection.selectMultiple(['elem2', 'elem3'], true);
      
      expect(get(selection.selectionCount)).toBe(3);
      expect(selection.getSelectedIds()).toContain('elem1');
      expect(selection.getSelectedIds()).toContain('elem2');
      expect(selection.getSelectedIds()).toContain('elem3');
    });

    it('should replace selection when adding multiple without flag', () => {
      selection.select('elem1');
      selection.selectMultiple(['elem2', 'elem3']);
      
      expect(get(selection.selectionCount)).toBe(2);
      expect(selection.isSelected('elem1')).toBe(false);
    });
  });

  describe('deselection', () => {
    it('should deselect single element', () => {
      selection.selectMultiple(['elem1', 'elem2']);
      selection.deselect('elem1');
      
      expect(selection.isSelected('elem1')).toBe(false);
      expect(selection.isSelected('elem2')).toBe(true);
      expect(get(selection.selectionCount)).toBe(1);
    });

    it('should deselect multiple elements', () => {
      selection.selectMultiple(['elem1', 'elem2', 'elem3']);
      selection.deselectMultiple(['elem1', 'elem3']);
      
      expect(selection.isSelected('elem1')).toBe(false);
      expect(selection.isSelected('elem2')).toBe(true);
      expect(selection.isSelected('elem3')).toBe(false);
      expect(get(selection.selectionCount)).toBe(1);
    });

    it('should clear last selected when all deselected', () => {
      selection.select('elem1');
      selection.deselect('elem1');
      
      expect(selection.getLastSelected()).toBeNull();
    });
  });

  describe('toggle selection', () => {
    it('should toggle unselected element to selected', () => {
      selection.toggle('elem1');
      
      expect(selection.isSelected('elem1')).toBe(true);
    });

    it('should toggle selected element to unselected', () => {
      selection.select('elem1');
      selection.toggle('elem1');
      
      expect(selection.isSelected('elem1')).toBe(false);
    });

    it('should add to selection when toggling with add flag', () => {
      selection.select('elem1');
      selection.toggle('elem2', true);
      
      expect(selection.isSelected('elem1')).toBe(true);
      expect(selection.isSelected('elem2')).toBe(true);
    });
  });

  describe('clear selection', () => {
    it('should clear all selections', () => {
      selection.selectMultiple(['elem1', 'elem2', 'elem3']);
      selection.clear();
      
      expect(get(selection.hasSelection)).toBe(false);
      expect(get(selection.selectionCount)).toBe(0);
      expect(selection.getLastSelected()).toBeNull();
    });
  });

  describe('select all', () => {
    it('should select all elements', () => {
      selection.selectAll();
      
      expect(get(selection.selectionCount)).toBe(mockElements.length);
      mockElements.forEach(elem => {
        expect(selection.isSelected(elem.id)).toBe(true);
      });
    });
  });

  describe('selection by criteria', () => {
    it('should select by type', () => {
      selection.selectByType('vessel');
      
      expect(get(selection.selectionCount)).toBe(2);
      expect(selection.isSelected('elem1')).toBe(true);
      expect(selection.isSelected('elem3')).toBe(true);
      expect(selection.isSelected('elem2')).toBe(false);
    });

    it('should add to selection by type', () => {
      selection.select('elem2');
      selection.selectByType('vessel', true);
      
      expect(get(selection.selectionCount)).toBe(3);
      expect(selection.isSelected('elem2')).toBe(true);
    });

    it('should select elements in bounds', () => {
      const bounds = { x: 150, y: 120, width: 200, height: 100 };
      selection.selectInBounds(bounds);
      
      // elem2 (200,150,40,40) should intersect with bounds (150,120,200,100)
      expect(selection.isSelected('elem2')).toBe(true);
    });
  });

  describe('selection bounds', () => {
    it('should calculate selection bounds for single element', () => {
      selection.select('elem1');
      const bounds = selection.getSelectionBounds();
      
      expect(bounds).toEqual({
        x: 100,
        y: 100,
        width: 50,
        height: 80
      });
    });

    it('should calculate selection bounds for multiple elements', () => {
      selection.selectMultiple(['elem1', 'elem2']);
      const bounds = selection.getSelectionBounds();
      
      // elem1: (100,100,50,80) -> (100,100) to (150,180)
      // elem2: (200,150,40,40) -> (200,150) to (240,190)
      // Combined: (100,100) to (240,190)
      expect(bounds).toEqual({
        x: 100,
        y: 100,
        width: 140, // 240 - 100
        height: 90  // 190 - 100
      });
    });

    it('should return null bounds for empty selection', () => {
      const bounds = selection.getSelectionBounds();
      expect(bounds).toBeNull();
    });
  });

  describe('advanced operations', () => {
    it('should invert selection', () => {
      selection.select('elem1');
      selection.invertSelection();
      
      expect(selection.isSelected('elem1')).toBe(false);
      expect(selection.isSelected('elem2')).toBe(true);
      expect(selection.isSelected('elem3')).toBe(true);
      expect(get(selection.selectionCount)).toBe(2);
    });

    it('should select similar elements by type', () => {
      selection.selectSimilar('elem1', 'type');
      
      expect(get(selection.selectionCount)).toBe(2);
      expect(selection.isSelected('elem1')).toBe(true);
      expect(selection.isSelected('elem3')).toBe(true); // Same type 'vessel'
      expect(selection.isSelected('elem2')).toBe(false);
    });

    it('should select similar elements by color', () => {
      selection.selectSimilar('elem1', 'color');
      
      expect(get(selection.selectionCount)).toBe(2);
      expect(selection.isSelected('elem1')).toBe(true);
      expect(selection.isSelected('elem3')).toBe(true); // Same color '#ff0000'
      expect(selection.isSelected('elem2')).toBe(false);
    });

    it('should select similar elements by size', () => {
      selection.selectSimilar('elem1', 'size');
      
      expect(get(selection.selectionCount)).toBe(2);
      expect(selection.isSelected('elem1')).toBe(true);
      expect(selection.isSelected('elem3')).toBe(true); // Same dimensions 50x80
      expect(selection.isSelected('elem2')).toBe(false);
    });

    it('should handle select similar with nonexistent reference', () => {
      selection.selectSimilar('nonexistent', 'type');
      expect(get(selection.selectionCount)).toBe(0);
    });
  });

  describe('group operations', () => {
    it('should create group from selection', () => {
      selection.selectMultiple(['elem1', 'elem2']);
      const groupId = selection.groupSelected();
      
      expect(typeof groupId).toBe('string');
      expect(groupId).toContain('group_');
    });

    it('should not create group with single element', () => {
      selection.select('elem1');
      const groupId = selection.groupSelected();
      
      expect(groupId).toBeNull();
    });

    it('should not create group with no selection', () => {
      const groupId = selection.groupSelected();
      expect(groupId).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should provide selection statistics', () => {
      selection.selectMultiple(['elem1', 'elem2']);
      const stats = selection.getSelectionStats();
      
      expect(stats.count).toBe(2);
      expect(stats.types).toEqual({ vessel: 1, pump: 1 });
      expect(stats.bounds).toBeDefined();
      expect(stats.bounds?.width).toBeGreaterThan(0);
    });

    it('should provide empty statistics for no selection', () => {
      const stats = selection.getSelectionStats();
      
      expect(stats.count).toBe(0);
      expect(stats.types).toEqual({});
      expect(stats.bounds).toBeNull();
    });
  });

  describe('derived stores', () => {
    it('should update selected elements derived store', () => {
      selection.selectMultiple(['elem1', 'elem3']);
      const selectedElements = get(selection.selectedElements);
      
      expect(selectedElements).toHaveLength(2);
      expect(selectedElements.map(el => el.id)).toContain('elem1');
      expect(selectedElements.map(el => el.id)).toContain('elem3');
    });

    it('should update has selection derived store', () => {
      expect(get(selection.hasSelection)).toBe(false);
      
      selection.select('elem1');
      expect(get(selection.hasSelection)).toBe(true);
      
      selection.clear();
      expect(get(selection.hasSelection)).toBe(false);
    });

    it('should update multiple selection derived store', () => {
      selection.select('elem1');
      expect(get(selection.hasMultipleSelection)).toBe(false);
      
      selection.select('elem2', true);
      expect(get(selection.hasMultipleSelection)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle selecting nonexistent elements', () => {
      selection.select('nonexistent');
      
      expect(get(selection.selectionCount)).toBe(1);
      expect(selection.isSelected('nonexistent')).toBe(true);
      // Should not crash when getting selected elements
      expect(selection.getSelectedElements()).toHaveLength(0);
    });

    it('should handle deselecting nonexistent elements', () => {
      selection.deselect('nonexistent');
      expect(get(selection.selectionCount)).toBe(0);
    });

    it('should handle empty arrays in multiple operations', () => {
      selection.selectMultiple([]);
      expect(get(selection.selectionCount)).toBe(0);
      
      selection.deselectMultiple([]);
      expect(get(selection.selectionCount)).toBe(0);
    });
  });
});