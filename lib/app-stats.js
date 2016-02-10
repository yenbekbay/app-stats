#! /usr/bin/env node

'use strict';

const moment = require('moment');

const Logger = require('./logger');
const Reporter = require('./reporter');

const argv = require('yargs')
  .help('help')
  .usage('Usage: app-stats <command> [options]')
  .command('setup', 'Set up Mixpanel for selected apps')
  .option('since', {
    alias: 's',
    // taken from node-itunesconnect
    describe: 'Specify since date. You can use format YYYY-MM-DD or simply ' +
      '1day, 3months, 5weeks, 2years ...',
    default: '0days',
    type: 'string'
  })
  .argv;

const command = argv._[0];
const since = sinceDate(argv.since);
const logger = new Logger();
const reporter = new Reporter(logger, since, command === 'setup');

reporter.report().subscribeOnError(err => {
  logger.stopSpinner();
  logger.error('Something went wrong: ' + err.message);
  console.error(err.stack);

  process.exit(1);
});

function sinceDate(value) {
  if (!value.match(new RegExp(/([0-9]{4})-([0-9]{2})-([0-9]{2})/))) {
    const descMatch = value.match(new RegExp(/([0-9]+)([a-zA-Z]+)/));

    if (descMatch) {
      value = moment().subtract(descMatch[1], descMatch[2])
        .format('YYYY-MM-DD');
    } else {
      value = moment().format('YYYY-MM-DD');
    }
  }

  if (moment(value).isAfter(moment())) {
    // is given value is in the future, return today
    return moment().format('YYYY-MM-DD');
  } else {
    return value;
  }
}
