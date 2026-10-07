const crypto = require('node:crypto');

const rateCatalog = [
  { id: 'demo-express', courier: 'Demo Express', basePrice: 82, extraKg: 8, estimatedDelivery: '3–4 days' },
  { id: 'demo-priority', courier: 'Demo Priority', basePrice: 96, extraKg: 10, estimatedDelivery: '2–3 days' },
  { id: 'demo-economy', courier: 'Demo Economy', basePrice: 65, extraKg: 6, estimatedDelivery: '4–6 days' }
];

const trackingStages = [
  { status: 'SIMULATED_SHIPMENT_CREATED', label: 'Demo shipment created' },
  { status: 'SIMULATED_SHIPPED', label: 'Shipped · simulated' },
  { status: 'SIMULATED_IN_TRANSIT', label: 'Example next stage: in transit' },
  { status: 'SIMULATED_OUT_FOR_DELIVERY', label: 'Example next stage: out for delivery' },
  { status: 'SIMULATED_DELIVERED', label: 'Example next stage: delivered' }
];

class MockCourierProvider {
  constructor() {
    this.name = 'Local mock courier';
    this.mode = 'demo';
  }

  async getRates({ weightKg }) {
    const extraUnits = Math.max(0, Math.ceil(Number(weightKg) - 1));
    return rateCatalog.map((option) => ({
      id: option.id,
      courier: option.courier,
      estimatedCost: option.basePrice + (extraUnits * option.extraKg),
      currency: 'INR',
      estimatedDelivery: option.estimatedDelivery,
      mode: 'demo',
      simulated: true
    }));
  }

  async createShipment({ rate, swapId, pickupLocality, deliveryLocality, packageCategory, weightKg }) {
    if (!rate || !rate.id) throw new Error('A valid simulated rate is required.');
    const seed = swapId || JSON.stringify([pickupLocality, deliveryLocality, packageCategory, weightKg, rate.id]);
    const trackingSuffix = crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 16).toUpperCase();
    return {
      provider: 'local-mock',
      mode: 'demo',
      trackingNumber: `DEMO-SL-${trackingSuffix}`,
      status: 'SIMULATED_SHIPPED',
      courierId: rate.id,
      courierName: rate.courier,
      estimatedCost: rate.estimatedCost,
      currency: 'INR',
      estimatedDelivery: rate.estimatedDelivery
    };
  }

  async getTracking(shipment) {
    const cancelled = shipment.status === 'SIMULATED_CANCELLED';
    const events = trackingStages.map((stage, index) => ({
      status: stage.status,
      label: stage.label,
      state: cancelled ? (index === 0 ? 'complete' : 'not-run') : index === 0 ? 'complete' : index === 1 ? 'current' : 'illustrative',
      occurredAt: index === 0 ? shipment.createdAt : index === 1 && !cancelled ? shipment.createdAt : null
    }));
    if (cancelled) events.push({ status: 'SIMULATED_CANCELLED', label: 'Demo shipment cancelled', state: 'current', occurredAt: shipment.cancelledAt || shipment.updatedAt });
    return {
      mode: 'demo',
      simulated: true,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status === 'SIMULATED_SHIPPED' ? 'Shipped · simulated' : shipment.status,
      statusCode: shipment.status,
      label: 'SIMULATED TRACKING — NO REAL SHIPMENT',
      events
    };
  }

  async cancelShipment(shipment) {
    if (shipment.status === 'SIMULATED_DELIVERED') throw new Error('A completed demo tracking sequence cannot be cancelled.');
    return { status: 'SIMULATED_CANCELLED', cancelledAt: new Date() };
  }
}

module.exports = { MockCourierProvider };
