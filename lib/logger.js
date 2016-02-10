'use strict';

const Spinner = require('cli-spinner').Spinner;
require('colors');

Spinner.setDefaultSpinnerString('|/-\\');

class Logger {
  constructor(mute) {
    this.mute = mute;
  }

  startSpinner(message) {
    this.stopSpinner();

    if (this.mute) {
      return;
    }

    this.spinnerMessage = message;

    this.spinner = new Spinner(message + ' %s');
    this.spinner.start();
  }

  stopSpinner() {
    if (this.spinner) {
      this.spinner.stop(true);
      this.spinner = undefined;
    }
  }

  log(message, type) {
    if (this.mute) {
      return;
    }

    if (!message || message.length === 0) {
      return;
    }

    if (this.spinner) {
      this.spinner.stop(true);
    }

    switch (type) {
      case 'error':
        console.error(message.red);
        break;
      case 'warning':
        console.error(message.yellow);
        break;
      case 'success':
        console.log(message.green);
        break;
      default:
        console.log(message);
        break;
    }

    if (this.spinner && this.spinnerMessage) {
      this.spinner = new Spinner(this.spinnerMessage + ' %s');
      this.spinner.start();
    }
  }

  error(message) {
    this.log(message, 'error');
  }

  warning(message) {
    this.log(message, 'warning');
  }

  success(message) {
    this.log(message, 'success');
  }
}

module.exports = Logger;
