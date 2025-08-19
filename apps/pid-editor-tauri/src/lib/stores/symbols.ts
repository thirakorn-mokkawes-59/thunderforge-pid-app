import { writable, derived } from 'svelte/store';
import type { Symbol } from '$lib/types/symbol';
import { SymbolCategory, SymbolStandard } from '$lib/types/symbol';

// Equipment symbol names based on the extracted files
const equipmentNames = [
  'Tank General Basin', 'Tank Floating Roof', 'Vessel General Column', 'Vessel General',
  'Vessel Conical Head', 'Vessel Dished Head', 'Vessel Trays', 'Vessel Spherical',
  'Vessel Fixed Bed', 'Vessel Fluidized Bed', 'Vessel Full Tube Coil', 'Vessel Semi Tube Coil',
  'Vessel Jacketed', 'Storage Container', 'Storage Bag', 'Storage Barrel Drum',
  'Storage Gas Cylinder', 'Furnace Industrial', 'Pump', 'Compressor', 'Blower',
  'Heat Exchanger General 1', 'Heat Exchanger General 2', 'Heat Exchanger Cooling Tower',
  'Heat Exchanger Spiral', 'Heat Exchanger Double Pipe', 'Heat Exchanger Plate Type',
  'Heat Exchanger Finned Tube', 'Heat Exchanger Tube Bundle U-Tube',
  'Heat Exchanger Shell and Tube Bundle U-Tube', 'Heat Exchanger Tube Bundle Floating Head'
];

const valveNames = [
  'Gate Valve', 'Globe Valve', 'Ball Valve', 'Butterfly Valve', 'Check Valve',
  'Check Valve Spring Loaded', 'Plug Valve', 'Diaphragm Valve', 'Needle Valve',
  'Angle Valve', 'Three Way Valve', 'Four Way Valve', 'Relief Valve', 'Safety Valve',
  'Pressure Reducing Valve', 'Control Valve', 'Control Valve Pneumatic',
  'Control Valve Electric', 'Control Valve Hydraulic', 'Solenoid Valve',
  'Float Valve', 'Knife Gate Valve', 'Pinch Valve', 'Rotary Valve'
];

// Create the main symbols store
function createSymbolStore() {
  // Symbol data - we'll load this from the file system
  let symbolData: Symbol[] = [];
  const { subscribe, set, update } = writable<Symbol[]>([]);
  
  return {
    subscribe,
    
    async loadSymbols() {
      try {
        // Create symbol entries based on the file structure
        const symbols: Symbol[] = [];
        
        // ISO Equipment symbols - check actual file names
        const equipmentFiles = [
          'tank_general_basin', 'tank_floating_roof', 'vessel_general_column', 'vessel_general'
        ];
        
        // Load first 30 equipment symbols with proper names and file extensions
        for (let i = 0; i < 30; i++) {
          const paddedIndex = String(i).padStart(3, '0');
          // Build the filename based on the actual pattern
          let filename = `pid_iso_equipment_${paddedIndex}`;
          
          // Add descriptive part for known symbols
          const descriptiveNames = [
            '_tank_general_basin', '_tank_floating_roof', '_vessel_general_column', '_vessel_general',
            '_vessel_conical_head', '_vessel_dished_head', '_vessel_trays', '_vessel_spherical',
            '_vessel_fixed_bed', '_vessel_fluidized_bed', '_vessel_full_tube_coil', '_vessel_semi_tube_coil',
            '_vessel_jacketed', '_storage_container', '_storage_bag', '_storage_barrel_drum',
            '_storage_gas_cylinder', '_furnace_industrial', '_pump', '_compressor', '_blower',
            '_heat_exchanger_general_1', '_heat_exchanger_general_2', '_heat_exchanger_general_cooling_tower',
            '_heat_exchanger_spiral', '_heat_exchanger_double_pipe', '_heat_exchanger_plate_type',
            '_heat_exchanger_finned_tube', '_heat_exchanger_tube_bundle_u_tube',
            '_heat_exchanger_shell_and_tube_bundle_u_tube', '_heat_exchanger_tube_bundle_floating_head'
          ];
          
          if (i < descriptiveNames.length) {
            filename += descriptiveNames[i];
          }
          
          symbols.push({
            id: `iso_equipment_${i}`,
            name: equipmentNames[i] || `Equipment ${i}`,
            category: SymbolCategory.Equipment,
            standard: SymbolStandard.ISO,
            svgPath: `/symbols/ISO/PID-ISO-Equipments-Symbols/svg/${filename}.svg`,
            connectionPoints: []
          });
        }
        
        // ISO Valves symbols
        for (let i = 0; i < 24; i++) {
          const paddedIndex = String(i).padStart(3, '0');
          // Build the filename based on the actual pattern
          let filename = `pid_iso_valves_${paddedIndex}`;
          
          const valveDescriptiveNames = [
            '_gate_valve', '_globe_valve', '_ball_valve', '_butterfly_valve', '_check_valve',
            '_check_valve_spring_loaded', '_plug_valve', '_diaphragm_valve', '_needle_valve',
            '_angle_valve', '_three_way_valve', '_four_way_valve', '_relief_valve', '_safety_valve',
            '_pressure_reducing_valve', '_control_valve', '_control_valve_pneumatic',
            '_control_valve_electric', '_control_valve_hydraulic', '_solenoid_valve',
            '_float_valve', '_knife_gate_valve', '_pinch_valve', '_rotary_valve'
          ];
          
          if (i < valveDescriptiveNames.length) {
            filename += valveDescriptiveNames[i];
          }
          
          symbols.push({
            id: `iso_valves_${i}`,
            name: valveNames[i] || `Valve ${i}`,
            category: SymbolCategory.Valves,
            standard: SymbolStandard.ISO,
            svgPath: `/symbols/ISO/PID-ISO-Valves-Symbols/svg/${filename}.svg`,
            connectionPoints: []
          });
        }
        
        // ISO Instruments symbols
        for (let i = 0; i < 16; i++) {
          const paddedIndex = String(i).padStart(3, '0');
          symbols.push({
            id: `iso_instruments_${i}`,
            name: `Instrument ${i}`,
            category: SymbolCategory.Instruments,
            standard: SymbolStandard.ISO,
            svgPath: `/symbols/ISO/PID-ISO-Instruments-Symbols/svg/pid_iso_instruments_${paddedIndex}.svg`,
            connectionPoints: []
          });
        }
        
        // ISO Fittings symbols
        for (let i = 0; i < 23; i++) {
          const paddedIndex = String(i).padStart(3, '0');
          symbols.push({
            id: `iso_fittings_${i}`,
            name: `Fitting ${i}`,
            category: SymbolCategory.Fittings,
            standard: SymbolStandard.ISO,
            svgPath: `/symbols/ISO/PID-ISO-Fittings-Symbols/svg/pid_iso_fittings_${paddedIndex}.svg`,
            connectionPoints: []
          });
        }
        
        set(symbols);
        // Store for filtering
        symbolData.length = 0; // Clear existing data
        symbolData.push(...symbols);
        console.log('Loaded symbols:', symbols.length);
      } catch (error) {
        console.error('Failed to load symbols:', error);
      }
    },
    
    filterByCategory(category: SymbolCategory | null) {
      update(currentSymbols => {
        if (!category || symbolData.length === 0) return currentSymbols;
        return symbolData.filter(s => s.category === category);
      });
    },
    
    filterByStandard(standard: SymbolStandard | null) {
      update(currentSymbols => {
        if (!standard || symbolData.length === 0) return currentSymbols;
        return symbolData.filter(s => s.standard === standard);
      });
    },
    
    search(query: string) {
      update(currentSymbols => {
        if (!query || symbolData.length === 0) return currentSymbols;
        const lowerQuery = query.toLowerCase();
        return symbolData.filter(s => 
          s.name.toLowerCase().includes(lowerQuery) ||
          s.category.toLowerCase().includes(lowerQuery)
        );
      });
    }
  };
}

export const symbols = createSymbolStore();