type Listener = () => void;

const listeners = new Set<Listener>();

export function onExpensesChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyExpensesChanged() {
  listeners.forEach((listener) => listener());
}
