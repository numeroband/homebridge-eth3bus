import TaskQueue from "./TaskQueue.mjs"
import SocketConnection from "./SocketConnection.mjs"
import EventEmitter from "events"

const ETH3BUS_PORT = 12347;
const SERVER_PACKET_SIZE = 9;
const CLIENT_PACKET_SIZE = 7;
const WRITE_TIMEOUT_MS = 500
const ACK_TIMEOUT_MS = WRITE_TIMEOUT_MS + 1000
const ENUM_TIMEOUT_MS = WRITE_TIMEOUT_MS + 2000
const DISCONNECT_TIMEOUT_MS = 30 * 1000

export default class E3BConnection extends EventEmitter {
  static Command = Object.freeze({
    ACK : 1,
    NACK: 2,
    READ: 3,
    WRITE: 4,
    READ_EEPROM: 5,
    WRITE_EEPROM: 6,
    READ_ADDR: 7,
    WRITE_ADDR: 8,
    READ_TYPE: 9,
    ENUM: 10,
  });

  constructor(address, log, timeoutMs) {
    super();
    this.log = log;
    this.socket = new SocketConnection(address, ETH3BUS_PORT, timeoutMs || DISCONNECT_TIMEOUT_MS, SERVER_PACKET_SIZE, log);
    this.socket.on('data', (data) => this._onData(data));
    this.taskQueue = new TaskQueue(this);
  }

  enum() {
    // If we are connected we're supposed to receive updates
    if (this.socket.connected()) {
      return Promise.resolve();
    } 

    this.enumAcks = 0;
    return this._sendPacket(ENUM_TIMEOUT_MS, 0xFFFF, 0x0A, 0, 0, this._checkEnumAck);
  }
  
  sendPacket(dst, cmd, data1, data2) {
    return this._sendPacket(ACK_TIMEOUT_MS, dst, cmd, data1, data2, this._checkAck);
  }

  sendAsyncPacket(dst, cmd, data1, data2) {
    return this._sendPacket(WRITE_TIMEOUT_MS, dst, cmd, data1, data2);
  }

  _sendPacket(timeout, dst, cmd, data1, data2, ackCallback) {
    return this.taskQueue.enqueue(
      timeout, 
      {dst, cmd, data1, data2}, 
      this._writePacket.bind(this), 
      ackCallback ? ackCallback.bind(this) : undefined);
  }

  _writePacket(packet) {
    this.log.debug(`E3BConnection SEND dst:${packet.dst} cmd:${packet.cmd} data1:${packet.data1 || 0} data2:${packet.data2 || 0}`);
    const buf = Buffer.alloc(CLIENT_PACKET_SIZE);
    const src = 0xFFFF;
    buf[0] = (src >> 8) & 0xFF;
    buf[1] = src & 0xFF;
    buf[2] = (packet.dst >> 8) & 0xFF;
    buf[3] = packet.dst & 0xFF;
    buf[4] = packet.cmd;
    buf[5] = packet.data1 || 0;
    buf[6] = packet.data2 || 0;

    return this.socket.write(buf);
  }

  _checkAck(sent, received, callback) {
    if (received.cmd == E3BConnection.Command.ACK && received.dst == sent.dst) {
      callback(undefined, received);
    } else if (received.cmd == E3BConnection.Command.NACK && received.dst == sent.dst) {
      callback(new Error("NACK"));
    }  
  }

  _checkEnumAck(sent, received, callback) {
    if (received.cmd == E3BConnection.Command.ACK && received.dst == 0xFF) {
      if (++this.enumAcks == 2) {
        callback();
      }
    } else if (received.cmd == E3BConnection.Command.NACK && received.dst == 0xFF) {
      callback(new Error("NACK"));
    }  
  }

  _onData(buffer) {
    const src = (buffer[3] << 8) | buffer[4];
    const dst = (buffer[5] << 8) | buffer[6];
    const cmd = buffer[2];
    const data1 = buffer[7];
    const data2 = buffer[8];
    const packet = {src, dst, cmd, data1, data2};
    
    this.log.debug(`E3BConnection RECV src: ${src} dst:${dst} cmd:${cmd} data1:${data1} data2:${data2}`);
    
    this.taskQueue.check(packet);
    this.emit('data', packet);
  }
}
