const CATEGORIES = {
  Tops: 800,
  Outerwear: 1800,
  Dresses: 1400,
  Bottoms: 1200,
  Shoes: 1600,
  Accessories: 700,
  Bundle: 2200
};
const CONDITIONS = {
  'New with tags': 1,
  Excellent: 0.72,
  Good: 0.48,
  'Well loved': 0.25
};
const BRANDS = { Everyday: 1, Premium: 1.22, Designer: 1.5, Unbranded: 0.8 };

function estimateValue({ category, condition, brandTier }) {
  const base = CATEGORIES[category];
  const conditionFactor = CONDITIONS[condition];
  const brandFactor = BRANDS[brandTier] || BRANDS.Everyday;
  if (!base || !conditionFactor) throw new TypeError('Choose a supported category and condition.');
  return Math.round((base * conditionFactor * brandFactor) / 50) * 50;
}

module.exports = { estimateValue, CATEGORIES, CONDITIONS, BRANDS };
