export default class ThermostatAccessory {
  constructor(log, api, accessory, device) {
    log("ThermostatAccessory init");
    const Service = api.hap.Service;
    const Characteristic = api.hap.Characteristic;
    this.log = log;
    this.device = device;
    this.unit = Characteristic.TemperatureDisplayUnits.CELSIUS;
    this.service = accessory.getService(Service.Thermostat);

    accessory.on('identify', (paired, callback) => {
      this.log(accessory.displayName, "Identify!!!");
      callback();
    });

    if (this.service) {
      log("Reusing cached service");
    } else {
      log("Creating service");
      this.service = accessory.addService(Service.Thermostat, device.name, device.id);
    } 
    this.service
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .on('get', this.getPromise(this.getCurrentHeatingCoolingState));

    this.service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on('get', this.getPromise(this.getTargetHeatingCoolingState))
      .on('set', this.setPromise(this.setTargetHeatingCoolingState));

    this.service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this.getPromise(this.getCurrentTemperature));

    this.service
      .getCharacteristic(Characteristic.TargetTemperature)
      .on('get', this.getPromise(this.getTargetTemperature))
      .on('set', this.setPromise(this.setTargetTemperature));

    this.service
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .on('get', this.getPromise(this.getTemperatureDisplayUnits))
      .on('set', this.setPromise(this.setTemperatureDisplayUnits));

    this.service
      .getCharacteristic(Characteristic.Name)
      .on('get', this.getPromise(this.getName));
  }

  getPromise(method) {
    const binded = method.bind(this);
    return callback => {
      binded()
      .then(val => callback(null, val))
      .catch(err => callback(err));      
    }
  }

  setPromise(method) {
    const binded = method.bind(this);
    return (value, callback) => {
      binded(value)
      .then(() => callback())
      .catch(err => callback(err));
    }
  }

  async getCurrentHeatingCoolingState() {
    return this.device.getCurrentHeatingCoolingState();
  }

  async getTargetHeatingCoolingState() {
    return this.device.getTargetHeatingCoolingState();
  }

  async setTargetHeatingCoolingState(value) {    
    this.device.setTargetHeatingCoolingState(value);
  }

  async getCurrentTemperature() {
    return this.device.getCurrentTemperature();
  }

  async getTargetTemperature() {
    return this.device.getTargetTemperature();
  }

  async setTargetTemperature(val) {
    this.device.setTargetTemperature(val);
  }

  async getTemperatureDisplayUnits() {
    return this.unit;
  }

  async setTemperatureDisplayUnits(val) {    
    this.unit = unit;
  }

  async getName() {
    return this.device.name;
  }
}
