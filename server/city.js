function normalizeCity(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/\s+/gu, ' ').trim()
    : '';
}

function cityMatchKey(value) {
  return normalizeCity(value).toLocaleLowerCase('en-US');
}

function cityPattern(value) {
  const city = normalizeCity(value);
  if (!city) return null;
  const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/gu, '\\s+');
  return new RegExp(`^${escaped}$`, 'iu');
}

module.exports = { normalizeCity, cityMatchKey, cityPattern };
