const PLUGIN_NAME = "homebridge-eth3bus";
const PLATFORM_NAME = "Eth3BusPlatform";

module.exports = homebridge => {
  homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, Eth3BusPlatform, true);
}

class Eth3BusPlatform {
  constructor(log, config, api) {
    log("Eth3BusPlatform Init");
    this.log = log;
    this.config = config;
    this.oldAccessories = new Map();
    this.newAccessories = new Map();
    this.api = api;
    this.name = PLATFORM_NAME;

    this.api.on('didFinishLaunching', async () => {
      this.log("DidFinishLaunching");
      this.createAccessories();
    });  
  }

  configureAccessory(accessory) {
    this.log(accessory.displayName, "Configure Accessory");
    this.oldAccessories.set(accessory.displayName, accessory);
  }

  async createAccessories() {
    const ThermostatAccessory = (await import('./lib/ThermostatAccessory.mjs')).default;
    const Eth3Bus = (await import('./lib/Eth3Bus.mjs')).default;
    const bus = new Eth3Bus(this.log, this.config.ip);
    const devices = await bus.getDevices();
    devices.forEach(device => new ThermostatAccessory(this.log, this.api, this.accessoryFromDevice(device), device));
    this.registerAccessories();
  }

  accessoryFromDevice(device) {
    let accessory = this.oldAccessories.get(device.name);
    if (accessory) {
      this.log("Reusing accessory " + accessory.displayName);
      this.oldAccessories.delete(device.name);
    } else {
      const Categories = this.api.hap.Accessory.Categories;
      accessory = new this.api.platformAccessory(device.name, this.api.hap.uuid.generate(device.name), Categories.THERMOSTAT);
      this.log("Created accessory " + accessory.displayName);
      this.newAccessories.set(device.name, accessory);
    }
    return accessory;
  }

  registerAccessories() {
    if (this.oldAccessories.size > 0) {
      this.log(this.name, "Unregistering cached accessories " + [...this.oldAccessories.keys()]);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, this.name, [...this.oldAccessories.values()]);
    }
    delete this.oldAccessories;

    if (this.newAccessories.size > 0) {
      this.log(this.name, "Registering platform accessories " + [...this.newAccessories.keys()]);
      this.api.registerPlatformAccessories(PLUGIN_NAME, this.name, [...this.newAccessories.values()]);
    }
    delete this.newAccessories;
  }
}