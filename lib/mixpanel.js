'use strict';

const Configstore = require('configstore');
const inquirer = require('inquirer');
const MixpanelExport = require('mixpanel-data-export');
const moment = require('moment');
const Rx = require('rx');

const pkg = require('../package.json');

const config = new Configstore(pkg.name);

class Mixpanel {
  constructor(logger, apps) {
    this.logger = logger;
    this.apps = apps;
  }

  trySetUp() {
    const self = this;

    return Rx.Observable.fromCallback(inquirer.prompt)([{
      type: 'confirm',
      name: 'setUp',
      message: 'Would you like to set up Mixpanel?'
    }]).flatMap(answers => {
      return answers.setUp ? self.setUp() : Rx.Observable.return(self.apps);
    });
  }

  setUp() {
    const self = this;

    return this.getAppTitle().flatMap(appTitle => {
      return self.setUpWithAppTitle(appTitle);
    }).concat(Rx.Observable.create(observer => {
      let stop = false;

      Rx.Observable.while(() => {
        return !stop && self.apps.filter(app => {
          return !app.mixpanelApiKey && !app.mixpanelApiSecret;
        }).length > 0;
      }, self.setUpAnotherApp().flatMap(continueSetUp => {
        stop = !continueSetUp;

        return Rx.Observable.empty();
      })).subscribe(observer);
    })).concat(Rx.Observable.return(self.apps));
  }

  getStats(app, since) {
    const apiKey = app.mixpanelApiKey;
    const apiSecret = app.mixpanelApiSecret;
    const keyEventName = app.mixpanelKeyEventName;

    if (!apiKey || !apiSecret) {
      app.keyEventCount = '–';

      return Rx.Observable.empty();
    }

    const appExport = new MixpanelExport({
      api_key: apiKey,
      api_secret: apiSecret
    });

    const toDate = moment().format('YYYY-MM-DD');
    let fromDate = toDate;
    if (moment(since).isValid) {
      fromDate = moment(since).format('YYYY-MM-DD');
    }

    if (keyEventName === 'people') {
      return Rx.Observable.fromCallback(appExport.engage, appExport)({
        where: 'properties["$last_seen"] > datetime("' + fromDate + '")'
      }).flatMap(data => {
        app.keyEventCount = data.total + ' active users';

        return Rx.Observable.empty();
      });
    } else {
      return Rx.Observable.fromCallback(appExport.segmentation, appExport)({
        event: keyEventName,
        from_date: fromDate,
        to_date: toDate,
        type: 'unique'
      }).flatMap(data => {
        let total = 0;
        for (const date in data.data.values[keyEventName]) {
          total += data.data.values[keyEventName][date];
        }

        app.keyEventCount = keyEventName + ': ' + total;

        return Rx.Observable.empty();
      });
    }
  }

  setUpAnotherApp() {
    const self = this;

    return Rx.Observable.fromCallback(inquirer.prompt)([{
      type: 'confirm',
      name: 'continueSetUp',
      message: 'Would you like to set up another app?'
    }]).flatMap(answers => {
      if (!answers.continueSetUp) {
        return Rx.Observable.return(false);
      }

      return self.getAppTitle().flatMap(appTitle => {
        return self.setUpWithAppTitle(appTitle);
      }).concat(Rx.Observable.return(true));
    });
  }

  setUpWithAppTitle(appTitle) {
    const self = this;

    return Rx.Observable.fromCallback(inquirer.prompt)([{
      type: 'password',
      name: 'apiKey',
      message: 'What\'s the project\'s API key? Look it up on ' +
        'mixpanel.com/account',
      validate: function(value) {
        return !!value.match(/^(?=.*[a-z])[a-z0-9]{20,40}$/) ||
          'Please enter a valid API key';
      }
    }, {
      type: 'password',
      name: 'apiSecret',
      message: 'What\'s the project\'s API secret? Look it up on ' +
        'mixpanel.com/account',
      validate: function(value) {
        return !!value.match(/^(?=.*[a-z])[a-z0-9]{20,40}$/) ||
          'Please enter a valid API secret';
      }
    }]).flatMap(answers => {
      const appExport = new MixpanelExport({
        api_key: answers.apiKey,
        api_secret: answers.apiSecret
      });

      return Rx.Observable.fromCallback(appExport.topEvents, appExport)({
        type: 'unique'
      }).flatMap(data => {
        if (data.error) {
          self.logger.error('You entered something wrong. Please try again');

          return self.setUpWithAppTitle(appTitle);
        }

        if (data.events.length === 0) {
          self.logger.warning('You have no events yet. Try again when you ' +
            'have events with `app-stats setup`');

          return Rx.Observable.empty();
        }

        return self.getKeyEventName(data.events).flatMap(eventName => {
          self.apps = self.apps.map(app => {
            if (app.title === appTitle) {
              app.mixpanelApiKey = answers.apiKey;
              app.mixpanelApiSecret = answers.apiSecret;
              app.mixpanelKeyEventName = eventName;
            }

            return app;
          });

          config.set('apps', self.apps);
          self.logger.success('Configured Mixpanel for ' + appTitle);

          return Rx.Observable.empty();
        });
      });
    });
  }

  getKeyEventName(events) {
    return Rx.Observable.fromCallback(inquirer.prompt)([{
      type: 'confirm',
      name: 'usePeople',
      message: 'Do you want to count the number of users instead of ' +
        'events?\n(only say yes if you have the People feature turned on)'
    }, {
      type: 'list',
      name: 'eventName',
      message: 'Which of these would you like to be the key event?',
      choices: events.sort((a, b) => {
        return b.amount - a.amount;
      }).map(event => {
        return event.event + ' - ' + event.amount;
      }),
      when: function(answers) {
        return !answers.usePeople;
      }
    }]).map(answers => {
      return answers.usePeople ? 'people' : answers.eventName.split('-')[0]
        .trim();
    });
  }

  getAppTitle() {
    const self = this;

    return Rx.Observable.fromCallback(inquirer.prompt)([{
      type: 'list',
      name: 'title',
      message: 'What app would you like to configure?',
      choices: self.apps.filter(app => {
        return !app.mixpanelApiKey && !app.mixpanelApiSecret;
      }).map(app => {
        return app.title;
      })
    }]).map(answers => {
      return answers.title;
    });
  }
}

module.exports = Mixpanel;
