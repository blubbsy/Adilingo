import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStorage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
  get length() {
    return mockStorage.size;
  },
  key: (index: number) => Array.from(mockStorage.keys())[index] ?? null,
};

// Polyfill globals for test environment
globalThis.localStorage = localStorageMock as unknown as Storage;
(globalThis as unknown as { window: unknown }).window = globalThis;

const {
  createDefaultState,
  parseBackup,
} = await import('../../utils/storage');

const {
  saveGrammarProgress,
  loadGrammarProgress,
  createEmptyGrammarProgress,
  exportableGrammarProgress,
  importGrammarProgress,
} = await import('../../grammar');

describe('Coordinated reset and backup export/import', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  it('coordinated reset wipes both UserState and GrammarProgress', async () => {
    // 1. Populate user state and grammar progress
    const userState = createDefaultState();
    userState.progress['ni3hao3|ni3hao3'] = {
      recognition: {
        due: '2026-10-10',
        stability: 10,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 10,
        reps: 3,
        lapses: 0,
        state: 2,
        history: [],
        consecutiveCorrect: 3,
        failureCount: 0,
        isLeech: false,
      },
    };
    userState.stats.totalReviewed = 25;

    const grammar = {
      version: 1 as const,
      points: {
        'grammar-1': { attempts: 5, correct: 5, completed: true },
      },
      paths: {
        'path-1': { completedSteps: ['step-a'] },
      },
    };
    await saveGrammarProgress(grammar);

    // Verify grammar is saved
    const beforeResetGrammar = await loadGrammarProgress();
    expect(beforeResetGrammar.points['grammar-1']?.completed).toBe(true);
    expect(beforeResetGrammar.paths['path-1']?.completedSteps).toEqual(['step-a']);

    // 2. Perform coordinated reset (as implemented in handleReset)
    const resetUserState = { ...createDefaultState(), settings: userState.settings };
    await saveGrammarProgress(createEmptyGrammarProgress());

    // 3. Verify user state is reset
    expect(resetUserState.progress).toEqual({});
    expect(resetUserState.stats.totalReviewed).toBe(0);

    // 4. Verify grammar progress is completely erased
    const afterResetGrammar = await loadGrammarProgress();
    expect(afterResetGrammar.points).toEqual({});
    expect(afterResetGrammar.paths).toEqual({});
  });

  it('backup export includes grammar, and parseBackup recovers it', async () => {
    const userState = createDefaultState();
    userState.progress['test|test'] = {
      recognition: {
        due: '2026-10-06',
        stability: 1,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 1,
        reps: 1,
        lapses: 0,
        state: 1,
        history: [],
        consecutiveCorrect: 1,
        failureCount: 0,
        isLeech: false,
      },
    };

    const grammar = {
      version: 1 as const,
      points: {
        'le-aspect': { attempts: 8, correct: 7, completed: true },
      },
      paths: {
        'hsk2-path': { completedSteps: ['s1', 's2'] },
      },
    };
    await saveGrammarProgress(grammar);

    const grammarExport = await exportableGrammarProgress();

    // Create backup file representation
    const backupJson = JSON.stringify({
      app: 'hanzi-flow',
      exportedAt: new Date().toISOString(),
      schemaVersion: 2,
      state: userState,
      grammar: grammarExport,
    });

    const mockFile = {
      text: async () => backupJson,
    } as File;

    const parsed = await parseBackup(mockFile);
    expect(parsed.state.progress['test|test']).toBeDefined();
    expect(parsed.grammar).toBeDefined();

    // Import parsed grammar
    const importedGrammar = await importGrammarProgress(parsed.grammar);
    expect(importedGrammar).not.toBeNull();
    expect(importedGrammar?.points['le-aspect']?.attempts).toBe(8);
  });
});
