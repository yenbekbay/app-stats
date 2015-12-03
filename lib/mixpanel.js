var inquirer = require('inquirer');
var MixpanelExport = require('mixpanel-data-export');
var Rx = require('rx');
var logger = require('./logger');
var pkg = require('../package.json');
var Configstore = require('configstore');
var config = new Configstore(pkg.name);
var moment = require('moment');

function Mixpanel(apps) {
  this.apps = apps;
}

module.exports = Mixpanel;

/*
PUBLIC
*/

Mixpanel.prototype.trySetUp = function() {
  var self = this;
  return Rx.Observable.create(function(observer) {
    inquirer.prompt([{
      type: 'confirm',
      name: 'setUp',
      message: 'Would you like to set up Mixpanel?'
    }], function(answers) {
      if (answers.setUp === true) {
        self.setUp().subscribe(observer);
      } else {
        observer.onCompleted();
      }
    });
  });
};

Mixpanel.prototype.setUp = function() {
  var self = this;
  return Rx.Observable.create(function(observer) {
    self.getAppTitle().concatMap(function(appTitle) {
      return self.setUpWithAppTitle(appTitle);
    }).subscribeOnCompleted(function() {
      var stop = false;
      Rx.Observable.while(function() {
        return !stop && self.apps.filter(function(app) {
          return !app.mixpanelApiKey && !app.mixpanelApiSecret;
        }).length > 0;
      }, self.setUpAnotherApp().doOnNext(function(continueSetUp) {
        stop = !continueSetUp;
      })).subscribe(observer);
    });
  });
};

Mixpanel.prototype.getStats = function(app, since) {
  var self = this;
  return Rx.Observable.create(function(observer) {
    var apiKey = app.mixpanelApiKey;
    var apiSecret = app.mixpanelApiSecret;
    var keyEventName = app.mixpanelKeyEventName;
    if (!apiKey || !apiSecret) {
      app.keyEventCount = '–';
      observer.onCompleted();
      return;
    }
    var appExport = new MixpanelExport({
      /* jshint camelcase: false */
      api_key: apiKey,
      api_secret: apiSecret
    });
    var toDate = moment().format('YYYY-MM-DD');
    var fromDate = toDate;
    if (moment(since).isValid) {
      fromDate = moment(since).format('YYYY-MM-DD');
    }
    if (keyEventName === 'people') {
      appExport.engage({
        where: 'properties["$last_seen"] > datetime("' +
          fromDate + '")'
      }, function(data) {
        app.keyEventCount = data.total + ' active users';
        observer.onCompleted();
      });
    } else {
      appExport.segmentation({
        event: keyEventName,
        from_date: fromDate,
        to_date: toDate,
        type: 'unique'
      }, function(data) {
        var total = 0;
        for (var date in data.data.values[keyEventName]) {
          total += data.data.values[keyEventName][date];
        }
        app.keyEventCount = keyEventName + ': ' + total;
        observer.onCompleted();
      });
    }
  });
};

/*
PRIVATE
*/

Mixpanel.prototype.setUpAnotherApp = function() {
  var self = this;
  return Rx.Observable.create(function(observer) {
    inquirer.prompt([{
      type: 'confirm',
      name: 'continueSetUp',
      message: 'Would you like to set up another app?'
    }], function(answers) {
      var continueSetUp = answers.continueSetUp;
      if (continueSetUp) {
        self.getAppTitle().concatMap(function(appTitle) {
          return self.setUpWithAppTitle(appTitle);
        }).subscribeOnCompleted(function() {
          observer.onNext(true);
          observer.onCompleted();
        });
      } else {
        observer.onNext(false);
        observer.onCompleted();
      }
    });
  });
};

Mixpanel.prototype.setUpWithAppTitle = function(appTitle) {
  var self = this;
  return Rx.Observable.create(function(observer) {
    inquirer.prompt([{
      type: 'input',
      name: 'apiKey',
      message: 'What\'s the project\'s API key? Look it up on ' +
        'mixpanel.com/account',
      validate: function(value) {
        if (value.match(/^(?=.*[a-z])[a-z0-9]{20,40}$/)) {
          return true;
        } else {
          return 'Please enter a valid API key';
        }
      }
    }, {
      type: 'input',
      name: 'apiSecret',
      message: 'What\'s the project\'s API secret? Look it up on ' +
        'mixpanel.com/account',
      validate: function(value) {
        if (value.match(/^(?=.*[a-z])[a-z0-9]{20,40}$/)) {
          return true;
        } else {
          return 'Please enter a valid API secret';
        }
      }
    }], function(answers) {
      var appExport = new MixpanelExport({
        /* jshint camelcase: false */
        api_key: answers.apiKey,
        api_secret: answers.apiSecret
      });
      appExport.topEvents({
        type: 'unique'
      }, function(data) {
        if (data.error) {
          logger.error('You entered something wrong. Please try again');
          self.setUpWithAppTitle(appTitle).subscribe(observer);
        } else {
          if (data.events.length === 0) {
            logger.warning('You have no events yet. Try again when you have ' +
              'events with `app-stats setup`');
            observer.onCompleted();
            return;
          }
          self.getKeyEventName(data.events).subscribe(function(eventName) {
            for (var i = 0; i < self.apps.length; i++) {
              if (self.apps[i].title === appTitle) {
                self.apps[i].mixpanelApiKey = answers.apiKey;
                self.apps[i].mixpanelApiSecret = answers.apiSecret;
                self.apps[i].mixpanelKeyEventName = eventName;
                config.set('apps', self.apps);
                logger.success('Configured mixpanel for ' + self.apps[i].title);
                break;
              }
            }
            observer.onCompleted();
          });
        }
      });
    });
  });
};

Mixpanel.prototype.getKeyEventName = function(events) {
  return Rx.Observable.create(function(observer) {
    inquirer.prompt([{
      type: 'confirm',
      name: 'usePeople',
      message: 'Do you want to count the number of users instead of events?\n' +
        '(only say yes if you have the People feature turned on)',
    }, {
      type: 'list',
      name: 'eventName',
      message: 'Which of these would you like to be the key event?',
      choices: events.sort(function(a, b) {
        return b.amount - a.amount;
      }).map(function(event) {
        return event.event + ' - ' + event.amount;
      }),
      when: function(answers) {
        return !answers.usePeople;
      }
    }], function(answers) {
      observer.onNext(answers.usePeople ? 'people' :
        answers.eventName.split('-')[0].trim());
      observer.onCompleted();
    });
  });
};

Mixpanel.prototype.getAppTitle = function() {
  var self = this;
  return Rx.Observable.create(function(observer) {
    inquirer.prompt([{
      type: 'list',
      name: 'appTitle',
      message: 'What app would you like to configure?',
      choices: self.apps.filter(function(app) {
        return !app.mixpanelApiKey && !app.mixpanelApiSecret;
      }).map(function(app) {
        return app.title;
      })
    }], function(answers) {
      observer.onNext(answers.appTitle);
      observer.onCompleted();
    });
  });
};
