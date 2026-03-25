import '@testing-library/jest-dom/vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

const localStorageStore = new Map<string, string>();

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      return localStorageStore.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      localStorageStore.set(key, value);
    },
    removeItem(key: string) {
      localStorageStore.delete(key);
    },
    clear() {
      localStorageStore.clear();
    },
  },
});

Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  value: 960,
});

Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  value: 360,
});

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value() {
    return {
      width: 960,
      height: 360,
      top: 0,
      left: 0,
      right: 960,
      bottom: 360,
      x: 0,
      y: 0,
      toJSON() {
        return this;
      },
    };
  },
});
