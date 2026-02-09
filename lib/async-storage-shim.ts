type Value = string | null;

// A tiny cross-environment AsyncStorage shim to satisfy packages that expect
// `@react-native-async-storage/async-storage` in web builds.
// - In the browser: uses `localStorage`
// - On the server / during build: falls back to an in-memory map

const memory = new Map<string, string>();

function getStore() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
}

const AsyncStorage = {
  async getItem(key: string): Promise<Value> {
    return getStore().getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    getStore().setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    getStore().removeItem(key);
  },
};

export default AsyncStorage;
export { AsyncStorage };

