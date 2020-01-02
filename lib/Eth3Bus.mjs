import E3BConnection from './E3BConnection.mjs'
import request from 'request-promise-native'
import E3BThermostat from './E3BThermostat.mjs'

const ENUM_PERIOD_MS = 60 * 1000

const DeviceType = Object.freeze({
  THERMOSTAT: 49,
});

export default class Eth3Bus {
  constructor(log, ip) {
    this.log = log;
    this.ip = ip;
    this.conn = new E3BConnection(ip, log);
    this.conn.on('data', packet => this.processPacket(packet))
    this.devices = new Map();
    this.interval = setInterval(() => this.conn.enum(), ENUM_PERIOD_MS)
  }

  async getDevices() {
    await this.parseInstal();
    await this.conn.connect();
    await this.conn.enum();
    return [...this.devices.values()].map(dev => dev.getDevices()).reduce((prev, cur) => prev.concat(cur), [])
  }

  async parseInstal() {
    const body = await request.get(`http://${this.ip}:8000/Instal.dat`);
    const lines = body.trim().split('\n').map(line => line.trim());
    let idx = 0;
    while (idx < lines.length) {
      const footprint = parseInt(lines[idx++]);
      const name = lines[idx++];
      const x = parseInt(lines[idx++]);
      const y = parseInt(lines[idx++]);
      const addr = parseInt(lines[idx++]);
      const zone = parseInt(lines[idx++]);
      const devType = parseInt(lines[idx++]);
      const iconId = parseInt(lines[idx++]);
      
      switch (devType) {
        case DeviceType.THERMOSTAT:
          this.addThermostatZone(addr, zone, name);
          break;
      }
    }
  }

  addThermostatZone(addr, zone, name) {
    let thermostat = this.devices.get(addr);
    if (!thermostat) {
      thermostat = new E3BThermostat(this, addr);
      this.devices.set(addr, thermostat);
    }
    thermostat.addZone(zone, name);
  }

  processPacket(packet) {
    const device = this.devices.get(packet.dst);
    if (device) {
      device.processPacket(packet);
    }
  }

  sendPacket(dst, cmd, data1, data2) {
    return this.conn.sendPacket(dst, cmd, data1, data2);
  }
}
