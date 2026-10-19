export type RequestSequence = { current: number };

/**
 * Allocate a monotonically increasing token for an async request.
 * Only the most recently allocated token may update the UI.
 */
export function beginLatestRequest(sequence: RequestSequence) {
  sequence.current += 1;
  return sequence.current;
}

export function isLatestRequest(sequence: RequestSequence, token: number) {
  return sequence.current === token;
}
