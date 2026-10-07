const { MockCourierProvider } = require('./mock-provider');

class CourierService {
  constructor(provider = new MockCourierProvider()) {
    this.provider = provider;
  }

  getMode() {
    return process.env.COURIER_MODE || 'demo';
  }

  assertDemoMode() {
    if (this.getMode() !== 'demo') {
      const error = new Error('Only the local demo courier provider is available; no live provider is configured.');
      error.status = 503;
      throw error;
    }
  }

  async getRates(details) {
    this.assertDemoMode();
    return this.provider.getRates(details);
  }

  async createShipment(details) {
    this.assertDemoMode();
    return this.provider.createShipment(details);
  }

  async getTracking(shipment) {
    this.assertDemoMode();
    return this.provider.getTracking(shipment);
  }

  async cancelShipment(shipment) {
    this.assertDemoMode();
    return this.provider.cancelShipment(shipment);
  }

  async createLiveShipment() {
    if (process.env.LIVE_SHIPMENTS !== 'true') {
      const error = new Error('Live shipment booking is disabled because LIVE_SHIPMENTS is not true.');
      error.status = 403;
      throw error;
    }
    const error = new Error('No live courier provider is configured.');
    error.status = 503;
    throw error;
  }
}

module.exports = { CourierService };
