import test from "node:test";
import assert from "node:assert/strict";
import { beginLatestRequest, isLatestRequest } from "../latest-request";

test("only the newest request token remains current", () => {
  const sequence = { current: 0 };
  const first = beginLatestRequest(sequence);
  const second = beginLatestRequest(sequence);

  assert.equal(isLatestRequest(sequence, first), false);
  assert.equal(isLatestRequest(sequence, second), true);
});

test("allocating a token invalidates an in-flight request immediately", () => {
  const sequence = { current: 7 };
  const inFlight = beginLatestRequest(sequence);

  beginLatestRequest(sequence);

  assert.equal(isLatestRequest(sequence, inFlight), false);
});

test("sequences are independent between component instances", () => {
  const firstComponent = { current: 0 };
  const secondComponent = { current: 0 };

  const firstToken = beginLatestRequest(firstComponent);
  beginLatestRequest(secondComponent);
  beginLatestRequest(secondComponent);

  assert.equal(isLatestRequest(firstComponent, firstToken), true);
});
