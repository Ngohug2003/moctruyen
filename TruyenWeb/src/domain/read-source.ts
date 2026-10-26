/** Keep packaged reading data on the critical path; network is a fallback only. */
export async function readLocalFirst<T>(
  local: () => Promise<T>,
  remote: () => Promise<T>,
): Promise<T> {
  try {
    return await local();
  } catch {
    return remote();
  }
}
