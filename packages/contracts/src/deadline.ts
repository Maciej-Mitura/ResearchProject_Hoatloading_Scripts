/** A bounded wait. Callers must also cancel the underlying IO using this signal. */
export async function deadline<T>(ms: number, category: string, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error(category)); }, ms); }),
    ]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
