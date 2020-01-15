export default class TaskQueue {
  constructor() {
    this.first = undefined;
    this.last = undefined;
  }

  enqueue(timeout, context, runCallback, checkCallback) {
    const task = new Task(this, timeout, context, runCallback, checkCallback);
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

  check(result) {
    if (this.first) {
      this.first.check(result);
    }    
  }
}

class Task {
  constructor(queue, timeoutMs, context, runCallback, checkCallback) {
    this.queue = queue;
    this.context = context;
    this.runCallback = runCallback;
    this.checkCallback = checkCallback;
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
    await this.runCallback(this.context);
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

  check(result) {
    this.checkCallback(this.context, result, this.finish.bind(this));
  }
}