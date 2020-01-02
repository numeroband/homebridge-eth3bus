import E3BConnection from './E3BConnection.mjs'

const PacketType = Object.freeze({
  ACTIVE: 0,
  MODE: 1,
  TARGET_TEMP: 2,
  CURRENT_TEMP: 3,
});

const FanSpeed = Object.freeze({
  OFF: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  AUTO: 4,
});

const Active = Object.freeze({
  DISABLED: 0,
  OFF: 2,
  ON: 3,
});

const Mode = Object.freeze({
  COOL: 1,
  HEAT: 2,
  FAN_HEAT: 4,
  FLOOR_COOL: 5,
  FLOOR_HEAT: 6,
});

const State = Object.freeze({
  OFF: 0,
  HEAT: 1,
  COOL: 2,
  AUTO: 3,
});

const NUM_PACKETS = 4;

export default class E3BThermostat {
  constructor(bus, addr) {
    this.bus = bus;
    this.addr = addr;
    this.log = bus.log;
    this.zones = new Map();
  }

  addZone(zone, name) {
    this.zones.set(zone, new E3BThermostatZone(this, zone, name));
  }

  getDevices() {
    return [...this.zones.values()];
  }

  processPacket(packet) {
    if (packet.cmd != E3BConnection.Command.WRITE) {
      return;
    }
    const zone = Math.floor(packet.data1 / NUM_PACKETS);
    const thermostatZone = this.zones.get(zone);
    if (thermostatZone) {
      thermostatZone.processPacket(packet);
    }
  }

  sendPacket(cmd, data1, data2) {
    return this.bus.sendPacket(this.addr, cmd, data1, data2);
  }
}

class E3BThermostatZone {
  constructor(thermostat, zone, name) {
    this.zone = zone;
    this.thermostat = thermostat;
    this.log = thermostat.log;
    this.name = name;
    this.currentTemp = 0;
    this.targetTemp = 0;
    this.currentState = 0;
    this.targetState = 0;
    this.active = false;
    this.fanSpeed = 0;
  }

  getType() {
    return "Thermostat";
  }

  processPacket(packet) {
    const packetType = packet.data1 % NUM_PACKETS;
    const data = packet.data2;
    switch (packetType) {
      case PacketType.ACTIVE:
        this.processActive(data);
        break;
      case PacketType.MODE:
        this.processMode(data);
        break;
      case PacketType.TARGET_TEMP:
        this.processTargetTemp(data);
        break;
      case PacketType.CURRENT_TEMP:
        this.processCurrentTemp(data);
        break;
      }
  }

  processActive(data) {
    this.active = (data == Active.ON);
  }

  processMode(data) {
    this.fanSpeed = (data >> 4) & 0x0F;
    const mode = data & 0x0F;
    if (this.fanSpeed == FanSpeed.OFF) {
      this.currentState = State.OFF;
    } else {
      switch (mode) {
        case Mode.COOL:
        case Mode.FLOOR_COOL:
          this.currentState = State.COOL;
          break;
        case Mode.HEAT:
        case Mode.FAN_HEAT:
        case Mode.FLOOR_HEAT:
          this.currentState = State.HEAT;
          break;      
      }  
    }
    if (this.currentState == State.OFF || this.targetState != State.AUTO) {
      this.targetState = this.currentState;
    }
  }

  processCurrentTemp(data) {
    this.currentTemp = (162 - data) / 2;
  }

  processTargetTemp(data) {
    this.targetTemp = data / 2;
  }

  async getCurrentHeatingCoolingState() {
    const value = this.active ? this.currentState : 0
    this.log(this.name, "getCurrentHeatingCoolingState", value);
    return value;
  }

  async getTargetHeatingCoolingState() {
    const value = this.active ? this.targetState : 0
    this.log(this.name, "getTargetHeatingCoolingState", value);
    return value;
  }

  async setTargetHeatingCoolingState(value) {
    this.log(this.name, "setTargetHeatingCoolingState", value);
    const active = (value != State.OFF);
    const currentState = (value == State.AUTO) ? this.currentState : value;
    let mode = undefined;
    switch (currentState) {
      case State.HEAT:
        mode = Mode.HEAT;
        break;        
      case State.COOL:
        mode = Mode.COOL;
        break;        
    }
    await this.write(PacketType.ACTIVE, active ? Active.ON : Active.OFF);
    if (mode !== undefined) {
      this.fanSpeed = FanSpeed.AUTO;
      await this.write(PacketType.MODE, (this.fanSpeed << 4) | mode);
    }
    this.active = active;
    this.currentState = currentState;
    this.targetState = value;
  }

  async getCurrentTemperature() {
    this.log(this.name, "getCurrentTemperature", this.currentTemp);
    return this.currentTemp;
  }

  async getTargetTemperature() {
    this.log(this.name, "getTargetTemperature", this.targetTemp);
    return this.targetTemp;
  }

  async setTargetTemperature(value) {    
    this.log(this.name, "setTargetTemperature", value);
    await this.write(PacketType.TARGET_TEMP, Math.floor(value * 2));
    this.targetTemp = value;
  }

  async read(packetType) {
    const cmd = E3BConnection.Command.READ;
    const data1 = NUM_PACKETS * this.zone + packetType;
    const packet = await this.thermostat.sendPacket(cmd, data1);
    return packet.data1;
  }

  write(packetType, data) {
    const cmd = E3BConnection.Command.WRITE;
    const data1 = NUM_PACKETS * this.zone + packetType;
    return this.thermostat.sendPacket(cmd, data1, data);
  }
}