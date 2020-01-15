import net from "net"
import EventEmitter from "events"
import { log } from "util";

export default class SocketConnection extends EventEmitter {
  constructor(address, port, timeoutMs, readBytes, log) {
    super();
    this.log = log;
    this.socket = undefined;
    this.address = address;
    this.port = port;
    this.readBuffer = Buffer.alloc(readBytes);
    this.bytesRead = 0;
    this.writeReject = undefined;
    this.timeoutMs = timeoutMs;
    this.timeout = undefined;
  }

  async write(buf) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }

    await this._connect();

    return new Promise((resolve, reject) => {
      this.writeReject = reject;
      this.socket.write(buf, () => {
        if (this.writeReject) {
          resolve();
          this.writeReject = undefined;
          this.timeout = setTimeout(() => this.close(new Error("Write timeout")), this.timeoutMs);
        }
      });
    });
  }

  close(err) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }

    if (!this.socket) {
      return;
    }
    
    this.log(`SocketConnection disconnected from ${this.address}:${this.port}`);
    this.socket.destroy();
    this.socket = undefined;
    if (this.writeReject) {
      this.writeReject(err);
    }
  }

  _connect() {
    if (this.socket ) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.bytesRead = 0;
      this.socket = new net.Socket();
      this.socket.once('error', err => reject(err));
      this.socket.connect(this.port, this.address, () => {
        this.log(`SocketConnection connected to ${this.address}:${this.port}`);
        this.socket.on('data', data => this._onData(data));
        this.socket.on('close', () => this.close(new Error('Socket closed')));
        this.socket.on('error', err => this.close(err));
        resolve();      
      });
    });
  }

  _onData(data) {
    for (const b of data) {
      this.readBuffer[this.bytesRead++] = b;
      if (this.bytesRead == this.readBuffer.length) {
        this.emit('data', this.readBuffer);
        this.bytesRead = 0;
      }
    }
  }
}
