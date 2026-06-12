const CACHE_TTL_MS = 60_000;
let _result = null;
let _at = 0;

export function getPayloadCache() {
  return _result && Date.now() - _at < CACHE_TTL_MS ? _result : null;
}

export function setPayloadCache(result) {
  _result = result;
  _at = Date.now();
}

export function invalidatePayloadCache() {
  _result = null;
}
