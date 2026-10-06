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

// Simple BroadcastChannel mock that delivers messages across channels with the same name
type ChannelHandler = (e: MessageEvent) => void;
const channelListeners = new Map<string, Set<ChannelHandler>>();

class MockBroadcastChannel {
  name: string;
  private listeners = new Set<ChannelHandler>();

  constructor(name: string) {
    this.name = name;
    if (!channelListeners.has(name)) {
      channelListeners.set(name, new Set());
    }
  }

  postMessage(data: unknown) {
    const subs = channelListeners.get(this.name);
    if (subs) {
      const event = new MessageEvent('message', { data });
      subs.forEach((cb) => {
        // BroadcastChannel delivers to other instances, not itself
        if (!this.listeners.has(cb)) {
          cb(event);
        }
      });
    }
  }

  addEventListener(type: string, handler: ChannelHandler) {
    if (type === 'message') {
      this.listeners.add(handler);
      channelListeners.get(this.name)?.add(handler);
    }
  }

  removeEventListener(type: string, handler: ChannelHandler) {
    if (type === 'message') {
      this.listeners.delete(handler);
      channelListeners.get(this.name)?.delete(handler);
    }
  }

  close() {
    this.listeners.forEach((l) => channelListeners.get(this.name)?.delete(l));
    this.listeners.clear();
  }
}

// Polyfill globals for test environment
globalThis.localStorage = localStorageMock as unknown as Storage;
(globalThis as unknown as { window: unknown }).window = globalThis;
// @ts-expect-error polyfill for Node test environment
globalThis.BroadcastChannel = MockBroadcastChannel;

// Dynamic import after polyfills
const {
  createEmptyGrammarProgress,
  loadGrammarProgress,
  saveGrammarProgress,
  exportableGrammarProgress,
  importGrammarProgress,
  onRemoteGrammarSave,
  TAB_ID,
} = await import('../grammarStorage');

describe('grammarStorage and cross-tab sync', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  it('creates an empty grammar progress object', () => {
    const empty = createEmptyGrammarProgress();
    expect(empty.version).toBe(1);
    expect(empty.points).toEqual({});
    expect(empty.paths).toEqual({});
  });

  it('saves and loads grammar progress from localStorage fallback', async () => {
    const sample = {
      version: 1 as const,
      points: {
        'ba-structure': {
          attempts: 5,
          correct: 4,
          completed: true,
          bestScore: 0.8,
        },
      },
      paths: {
        'hsk1-path': {
          completedSteps: ['step-1', 'step-2'],
        },
      },
    };

    await saveGrammarProgress(sample);
    const loaded = await loadGrammarProgress();
    expect(loaded.points['ba-structure']).toBeDefined();
    expect(loaded.points['ba-structure'].attempts).toBe(5);
    expect(loaded.paths['hsk1-path']?.completedSteps).toEqual(['step-1', 'step-2']);
  });

  it('broadcasts over BroadcastChannel with TAB_ID when saveGrammarProgress is called', async () => {
    const testChannel = new MockBroadcastChannel('hanzi-flow-grammar');
    const receivedMessages: unknown[] = [];
    testChannel.addEventListener('message', (e) => {
      receivedMessages.push(e.data);
    });

    const sample = createEmptyGrammarProgress();
    await saveGrammarProgress(sample);

    expect(receivedMessages.length).toBe(1);
    expect(receivedMessages[0]).toEqual({ type: 'saved', from: TAB_ID });
    testChannel.close();
  });

  it('filters out self-notifications in onRemoteGrammarSave', async () => {
    const remoteSpy = vi.fn();
    const unsub = onRemoteGrammarSave(remoteSpy);

    const testChannel = new MockBroadcastChannel('hanzi-flow-grammar');

    // Simulate a message from our own TAB_ID -> should NOT call remoteSpy
    testChannel.postMessage({ type: 'saved', from: TAB_ID });
    expect(remoteSpy).not.toHaveBeenCalled();

    // Simulate a message from another tab -> should call remoteSpy
    testChannel.postMessage({ type: 'saved', from: 'other-tab-456' });
    expect(remoteSpy).toHaveBeenCalledTimes(1);

    unsub();
    testChannel.close();
  });

  it('reloads and updates state when remote tab saves progress', async () => {
    // 1. Initial state is empty
    await saveGrammarProgress(createEmptyGrammarProgress());

    // 2. Another tab writes to storage and broadcasts
    const otherTabProgress = {
      version: 1 as const,
      points: {
        'remote-point': { attempts: 2, correct: 2, completed: true },
      },
      paths: {},
    };
    localStorageMock.setItem('hanzi-flow:grammar-progress', JSON.stringify(otherTabProgress));

    const otherTabChannel = new MockBroadcastChannel('hanzi-flow-grammar');
    otherTabChannel.postMessage({ type: 'saved', from: 'remote-tab-999' });

    // Wait a tick for async loadGrammarProgress to run
    await new Promise((r) => setTimeout(r, 20));

    // 3. Now loadGrammarProgress should reflect the remote update
    const reloaded = await loadGrammarProgress();
    expect(reloaded.points['remote-point']).toBeDefined();
    expect(reloaded.points['remote-point'].completed).toBe(true);
    otherTabChannel.close();
  });

  it('exports and imports grammar progress cleanly', async () => {
    const sample = {
      version: 1 as const,
      points: {
        'de-particle': {
          attempts: 10,
          correct: 9,
          completed: true,
        },
      },
      paths: {
        'path-1': { completedSteps: ['s1'] },
      },
    };

    await saveGrammarProgress(sample);
    const exported = await exportableGrammarProgress();
    expect(exported).toEqual(sample);

    // Reset to empty
    await saveGrammarProgress(createEmptyGrammarProgress());
    expect((await loadGrammarProgress()).points['de-particle']).toBeUndefined();

    // Import back
    const imported = await importGrammarProgress(exported);
    expect(imported).not.toBeNull();
    const reloaded = await loadGrammarProgress();
    expect(reloaded.points['de-particle']?.attempts).toBe(10);
  });
});
