import { writable } from 'svelte/store';
import type { Symbol } from '$lib/types/symbol';
import { SymbolCategory, SymbolStandard } from '$lib/types/symbol';

function createSimpleSymbolStore() {
  const { subscribe, set, update } = writable<Symbol[]>([]);
  
  // Hardcode a few symbols to test
  const testSymbols: Symbol[] = [
    {
      id: 'test_1',
      name: 'Tank General Basin',
      category: SymbolCategory.Equipment,
      standard: SymbolStandard.ISO,
      svgPath: '/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_000_tank_general_basin.svg',
      connectionPoints: []
    },
    {
      id: 'test_2',
      name: 'Pump',
      category: SymbolCategory.Equipment,
      standard: SymbolStandard.ISO,
      svgPath: '/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_018_pump.svg',
      connectionPoints: []
    },
    {
      id: 'test_3',
      name: 'Gate Valve',
      category: SymbolCategory.Valves,
      standard: SymbolStandard.ISO,
      svgPath: '/symbols/ISO/PID-ISO-Valves-Symbols/svg/pid_iso_valves_000_gate_valve.svg',
      connectionPoints: []
    },
    {
      id: 'test_4',
      name: 'Ball Valve',
      category: SymbolCategory.Valves,
      standard: SymbolStandard.ISO,
      svgPath: '/symbols/ISO/PID-ISO-Valves-Symbols/svg/pid_iso_valves_002_ball_valve.svg',
      connectionPoints: []
    },
    {
      id: 'test_5',
      name: 'Compressor',
      category: SymbolCategory.Equipment,
      standard: SymbolStandard.ISO,
      svgPath: '/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_019_compressor.svg',
      connectionPoints: []
    }
  ];
  
  return {
    subscribe,
    loadSymbols: async () => {
      console.log('Loading test symbols...');
      set(testSymbols);
      return testSymbols;
    }
  };
}

export const symbolsSimple = createSimpleSymbolStore();