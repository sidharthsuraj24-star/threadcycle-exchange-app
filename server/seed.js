const { User, Listing } = require('./models');

const demoItems = [
  { title: 'Relaxed indigo denim jacket', category: 'Outerwear', size: 'M', brand: 'Studio basics', brandTier: 'Everyday', condition: 'Excellent', description: 'Soft, broken-in denim with roomy sleeves and a neat cropped fit. Illustrative demo item only.', city: 'Bengaluru', estimatedValue: 1300, demoImageNo: 1 },
  { title: 'Light cotton shirt dress', category: 'Dresses', size: 'S', brand: 'Studio basics', brandTier: 'Everyday', condition: 'Good', description: 'Easy white cotton layers for warm days; gently worn and freshly washed. Illustrative demo item only.', city: 'Mumbai', estimatedValue: 650, demoImageNo: 2 },
  { title: 'Forest-green utility overshirt', category: 'Outerwear', size: 'L', brand: 'Northmill', brandTier: 'Premium', condition: 'Excellent', description: 'Mid-weight cotton twill with generous pockets. Illustrative demo item only.', city: 'Delhi', estimatedValue: 1600, demoImageNo: 3 },
  { title: 'Blue check wool-blend shacket', category: 'Outerwear', size: 'M', brand: 'Studio basics', brandTier: 'Everyday', condition: 'Good', description: 'A relaxed check layer for cool evenings; no money is involved in a swap. Illustrative demo item only.', city: 'Pune', estimatedValue: 850, demoImageNo: 4 },
  { title: 'Red floral midi skirt', category: 'Bottoms', size: 'S', brand: 'Studio basics', brandTier: 'Everyday', condition: 'Excellent', description: 'Light, movement-friendly print with a comfortable waistband. Illustrative demo item only.', city: 'Bengaluru', estimatedValue: 850, demoImageNo: 5 },
  { title: 'Colourful weekend capsule · 3 pieces', category: 'Bundle', size: 'S–M', brand: 'Unbranded', brandTier: 'Unbranded', condition: 'Good', description: 'A small mix-and-match clothing bundle pictured for illustration; the clothes and profile are not real. Illustrative demo item only.', city: 'Hyderabad', estimatedValue: 850, demoImageNo: 6 },
  { title: 'Black everyday knit top', category: 'Tops', size: 'M', brand: 'Northmill', brandTier: 'Premium', condition: 'Excellent', description: 'A clean-lined black layer that pairs well with denim. Illustrative demo item only.', city: 'Mumbai', estimatedValue: 700, demoImageNo: 7 },
  { title: 'Neutral easy-layer capsule · 3 pieces', category: 'Bundle', size: 'M–L', brand: 'Studio basics', brandTier: 'Everyday', condition: 'Good', description: 'Neutral pieces shown as a styling illustration; not an active member offer. Illustrative demo item only.', city: 'Kochi', estimatedValue: 1050, demoImageNo: 8 }
];

async function seedDemoListings() {
  for (let index = 0; index < demoItems.length; index++) {
    const demoKey = `illustrative-demo-${index + 1}`;
    if (await Listing.exists({ demoKey })) continue;
    const user = await User.findOneAndUpdate(
      { email: `illustrative-demo-${index + 1}@example.invalid` },
      { $setOnInsert: { name: `Illustrative member ${String(index + 1).padStart(2, '0')}`, email: `illustrative-demo-${index + 1}@example.invalid`, city: demoItems[index].city, bio: 'Illustrative demo profile. Not a real marketplace member.', isDemo: true, demoLabel: 'Illustrative demo · not contactable' } },
      { upsert: true, new: true }
    );
    await Listing.findOneAndUpdate(
      { demoKey },
      { $setOnInsert: { ...demoItems[index], demoKey, isDemo: true, owner: user._id, status: 'available', imageCount: 1 } },
      { upsert: true, new: true }
    );
  }
}

module.exports = { seedDemoListings, demoItems };
