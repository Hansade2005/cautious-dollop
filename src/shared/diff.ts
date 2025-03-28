export type DiffStrategy = 'unified' | 'split';

// Re-export from core/diff/types to ensure consistency
export type { DiffStrategy as CoreDiffStrategy } from '../core/diff/types'; 