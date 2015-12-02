var colors = require('colors');
var Spinner = require('cli-spinner').Spinner;
Spinner.setDefaultSpinnerString('|/-\\');

var spinner, spinnerMessage;

function startSpinner(message) {
  spinnerMessage = message;
  spinner = new Spinner(message + ' %s');
  spinner.start();
}

function stopSpinner() {
  if (spinner) {
    spinner.stop(true);
    spinner = undefined;
  }
}

function log(message, type) {
  if (!message || message.length === 0) {
    return;
  }
  if (spinner) {
    spinner.stop(true);
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
  }
  if (spinner && spinnerMessage) {
    spinner = new Spinner(spinnerMessage + ' %s');
    spinner.start();
  }
}

module.exports.startSpinner = startSpinner;
module.exports.stopSpinner = stopSpinner;

module.exports.error = function(message) {
  log(message, 'error');
};

module.exports.warning = function(message) {
  log(message, 'warning');
};

module.exports.success = function(message) {
  log(message, 'success');
};
