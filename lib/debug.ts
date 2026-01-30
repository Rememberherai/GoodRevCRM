const DEBUG = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true';

export function debug(namespace: string, message: string, data?: unknown) {
  if (!DEBUG) return;

  const timestamp = new Date().toISOString().split('T')[1]?.slice(0, 12);
  const prefix = `[${timestamp}] [${namespace}]`;

  if (data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

export function debugError(namespace: string, message: string, error?: unknown) {
  if (!DEBUG) return;

  const timestamp = new Date().toISOString().split('T')[1]?.slice(0, 12);
  const prefix = `[${timestamp}] [${namespace}]`;

  console.error(prefix, message, error);
}

// Create namespaced loggers
export function createDebugger(namespace: string) {
  return {
    log: (message: string, data?: unknown) => debug(namespace, message, data),
    error: (message: string, error?: unknown) => debugError(namespace, message, error),
  };
}
