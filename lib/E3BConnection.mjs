import net from "net"
import EventEmitter from "events"

const ETH3BUS_PORT = 12347;
const SERVER_PACKET_SIZE = 9;
const CLIENT_PACKET_SIZE = 7;
const ACK_TIMEOUT_MS = 300;

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

  constructor(address, log) {
    super();
    this.log = log;
    this.socket = new net.Socket();
    this.address = address;
    this.port = ETH3BUS_PORT;
    this.readBuffer = Buffer.alloc(SERVER_PACKET_SIZE);
    this.bytesRead = 0;
    this.sendQueue = new Array();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket.once('error', (err) => reject(err));
      this.socket.connect(this.port, this.address, () => {
        this.log.debug("E3BConnection connected");
        this.socket.on('data', (data) => this._onData(data));
        this.socket.on('close', () => this.emit('close'));
        this.socket.on('error', (err) => this.emit('error', err));
        resolve();      
      });  
    });
  }

  enum() {
    return this.sendAsyncPacket(0xFFFF, 0x0A);
  }
  
  close() {
    return new Promise((resolve) => {
      this.log.debug("E3BConnection disconnected");
      this.socket.end(() => {
        this.socket.destroy();
        resolve();
      });
    });
  }

  sendPacket(dst, cmd, data1, data2) {
    const waitForAck = true;
    return this._sendPacket({dst, cmd, data1, data2, waitForAck});
  }

  sendAsyncPacket(dst, cmd, data1, data2) {
    const waitForAck = false;
    return this._sendPacket({dst, cmd, data1, data2, waitForAck});
  }

  _sendPacket(packet) {
    return new Promise((resolve, reject) => {
      packet.resolve = resolve;
      packet.reject = reject;
      this.sendQueue.push(packet);
      if (this.sendQueue.length == 1) {
        this._sendFromQueue();
      }
    });
  }

  _sendFromQueue() {
    if (this.sendQueue.length == 0) {
      return;
    }
    const packet = this.sendQueue[0];
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
    this.socket.write(buf, () => {
      if (packet.waitForAck) {
        packet.timeout = setTimeout(() => this._ackFromQueue(new Error("timeout")), ACK_TIMEOUT_MS);
      } else {
        this._ackFromQueue();
      }
    });
  }

  _ackFromQueue(error, packet) {
    const sentPacket = this.sendQueue.shift();
    if (sentPacket.timeout) {
      clearTimeout(sentPacket.timeout);
    }
    if (error) {
      this.log("NACK: ", error);
      sentPacket.reject(error);
    } else {
      sentPacket.resolve(packet);
    }

    this._sendFromQueue();
  }

  _onData(data) {
    for (const b of data) {
      this.readBuffer[this.bytesRead++] = b;
      if (this.bytesRead == this.readBuffer.length) {
        this._emitCommand();
      }
    }
  }

  _emitCommand() {
    const src = (this.readBuffer[3] << 8) | this.readBuffer[4];
    const dst = (this.readBuffer[5] << 8) | this.readBuffer[6];
    const cmd = this.readBuffer[2];
    const data1 = this.readBuffer[7];
    const data2 = this.readBuffer[8];
    const packet = {src, dst, cmd, data1, data2};
    this.bytesRead = 0;
    
    this.log.debug(`E3BConnection RECV src: ${src} dst:${dst} cmd:${cmd} data1:${data1} data2:${data2}`);
    
    if (this.sendQueue.length > 0) {
      const sentPacket = this.sendQueue[0];
      if (cmd == E3BConnection.Command.ACK && dst == sentPacket.dst) {
        this._ackFromQueue(undefined, packet);
      } else if (cmd == E3BConnection.Command.NACK && dst == sentPacket.dst) {
        this._ackFromQueue(new Error("NACK"));
      }  
    }

    this.emit('data', packet);
  }
}