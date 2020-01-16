export default class TaskQueue {
  constructor() {
    this.first = undefined;
    this.last = undefined;
  }

  enqueue(timeout, runCallback) {
    const task = new Task(this, timeout, runCallback);
    if (this.last) {
      this.last.next = task;
      this.last = task;
    } else {
      this.first = task;
      this.last = task;
      task.run();
    }

    return task.promise;
  }

  dequeue() {
    if (!this.first) {
      return;
    }

    this.first = this.first.next;
    if (!this.first) {
      this.last = undefined;
    }

    if (this.first) {
      this.first.run();
    }
  }

  cancel(err) {
    if (this.first) { 
      this.first.finish(err); 
    }
  }

  check(...args) {
    if (this.first) {
      this.first.check(...args);
    }    
  }
}

class Task {
  constructor(queue, timeoutMs, runCallback) {
    this.queue = queue;
    this.runCallback = runCallback;
    this.checkCallback = undefined;
    this.timeoutMs = timeoutMs;
    this.timeout = undefined;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    this.next = undefined;
  }

  async run() {
    this.timeout = setTimeout(() => this.finish(new Error("Task timeout")), this.timeoutMs)
    this.checkCallback = await this.runCallback();
    if (!this.checkCallback) {
      this.finish();
    }
  }

  finish(error, result) {
    if (!this.queue) {
      return;
    }

    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    if (error) {
      this.reject(error);
    } else {
      this.resolve(result);
    }

    this.queue.dequeue();
  }

  check(...args) {
    this.checkCallback(...args, this.finish.bind(this));
  }
}