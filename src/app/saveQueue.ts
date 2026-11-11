/**
 * Starts an idle save synchronously and orders subsequent asynchronous writes.
 * Web pagehide can therefore commit before returning to the browser.
 */
export function createSaveQueue(write: (text: string) => void | Promise<void>) {
  let tail: Promise<void> | null = null;
  function attempt(text: string): Promise<void> {
    try { return Promise.resolve(write(text)); }
    catch (error) { return Promise.reject(error instanceof Error ? error : new Error('Storage write failed.')); }
  }
  return (text: string): Promise<void> => {
    const result = tail === null ? attempt(text) : tail.then(() => attempt(text));
    const settled = result.catch(() => { /* The caller reports failures; the queue must keep moving. */ });
    tail = settled;
    void settled.then(() => { if (tail === settled) tail = null; });
    return result;
  };
}
