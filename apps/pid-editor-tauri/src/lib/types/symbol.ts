export interface Symbol {
  id: string;
  name: string;
  category: SymbolCategory;
  standard: SymbolStandard;
  svgPath: string;
  thumbnailPath?: string;
  connectionPoints: Point[];
  metadata?: {
    tags: string[];
    description: string;
  };
}

export interface Point {
  x: number;
  y: number;
}

export enum SymbolCategory {
  Equipment = 'equipment',
  Valves = 'valves',
  Instruments = 'instruments',
  Fittings = 'fittings',
  PipesAndSignals = 'pipes_and_signals'
}

export enum SymbolStandard {
  ISO = 'ISO',
  PIP = 'PIP'
}