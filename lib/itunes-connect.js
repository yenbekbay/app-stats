var inquirer = require('inquirer');
var keychain = require('keychain');
var Rx = require('rx');
var pkg = require('../package.json');
var Configstore = require('configstore');
var config = new Configstore(pkg.name);
var itc = require('itunesconnect');
var logger = require('./logger');
var moment = require('moment');

/*
PUBLIC
*/

function ItunesConnect() {
  this.email = config.get('appleId');
  this.password = '';
}

module.exports = ItunesConnect;

ItunesConnect.prototype.getCredentials = function() {
  var self = this;
  return self.restorePassword().concat(Rx.Observable.create(function(observer) {
    if (!self.email || !self.password) {
      Rx.Observable.concat(
        self.getEmail(),
        self.getPassword(),
        self.saveCredentials()
      ).subscribe(observer);
    } else {
      observer.onCompleted();
    }
  }));
};

ItunesConnect.prototype.getApps = function(since) {
  var self = this;
  return Rx.Observable.create(function(observer) {
    if (self.apps) {
      observer.onNext(self.apps);
      observer.onCompleted();
      return;
    }
    if (!self.itunesConnect) {
      self.itunesConnect = new itc.Connect(self.email, self.password);
    }
    if (!moment(since).isValid ||
      moment(since).isAfter(moment().subtract(1, 'month'))) {
      // if start date is invalid or less than 1 month ago,
      // set is to one month ago
      since = moment().subtract(1, 'month').format('YYYY-MM-DD');
    }
    self.itunesConnect.request(itc.Report.ranked({ start: since }),
      function(error, result) {
      if (error) {
        observer.onError(error);
      } else {
        self.apps = result.filter(function(item) {
          return item.rptgDesc === 'App';
        }).map(function(item) {
          return {
            type: item.contentSpecificTypeName,
            title: item.title,
            id: parseInt(item.key, 10)
          };
        });
        observer.onNext(self.apps);
        observer.onCompleted();
      }
    });
  });
};

ItunesConnect.prototype.getStats = function(since) {
  var self = this;
  return Rx.Observable.create(function(observer) {
    if (self.stats) {
      observer.onNext(self.stats);
      observer.onCompleted();
      return;
    }
    if (!self.itunesConnect) {
      self.itunesConnect = new itc.Connect(self.email, self.password);
    }
    if (!moment(since).isValid ||
      moment(since).isAfter(moment().subtract(1, 'day'))) {
      // if start date is invalid or is after yesterday,
      // set is to yesterday
      since = moment().subtract(1, 'day').format('YYYY-MM-DD');
    }
    self.itunesConnect.request(itc.Report.ranked({ start: since }),
      function(error, result) {
      if (error) {
        observer.onError(error);
      } else {
        self.stats = result.map(function(item) {
          return {
            type: item.contentSpecificTypeName,
            title: item.title,
            id: parseInt(item.key, 10),
            units: item.units
          };
        });
        observer.onNext(self.stats);
        observer.onCompleted();
      }
    });
  });
};

/*
PRIVATE
*/

ItunesConnect.prototype.getEmail = function() {
  var self = this;
  return Rx.Observable.create(function(observer) {
    if (!self.email) {
      inquirer.prompt([{
        type: 'input',
        name: 'email',
        message: 'What\'s your Apple ID:',
        validate: function(value) {
          var emailRegex = new RegExp('^[-a-z0-9~!$%^&*_=+}{\'?]+(\.[-a-z0-9~' +
            '!$%^&*_=+}{\'?]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.(aero|' +
            'arpa|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|pro|' +
            'travel|mobi|[a-z][a-z])|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.'+
            '[0-9]{1,3}))(:[0-9]{1,5})?$', 'i');
          if (value.match(emailRegex)) {
            return true;
          } else {
            return 'Please enter a valid email';
          }
        }
      }], function(answers) {
        self.email = answers.email;
        observer.onCompleted();
      });
    } else {
      observer.onCompleted();
    }
  });
};

ItunesConnect.prototype.getPassword = function() {
  var self = this;
  return Rx.Observable.create(function(observer) {
    if (!self.password) {
      inquirer.prompt([{
        type: 'password',
        name: 'password',
        message: 'What\'s the password for your Apple ID:',
        validate: function(value) {
          var done = this.async();
          self.itunesConnect = new itc.Connect(self.email, value, {
            loginCallback: function(cookies) {
              done(true);
            }
          });
          self.itunesConnect.request(itc.Report.ranked(),
            function(error, result) {});
          setTimeout(function() {
            done('Please try again');
          }, 3000);
        }
      }], function(answers) {
        self.password = answers.password;
        observer.onCompleted();
      });
    } else {
      observer.onCompleted();
    }
  });
};

ItunesConnect.prototype.restorePassword = function() {
  var self = this;
  return Rx.Observable.create(function(observer) {
    if (self.email) {
      keychain.getPassword({
        account: self.email,
        service: pkg.name
      }, function(err, password) {
        if (err) {
          logger.error('Error occured while accessing the keychain');
        }
        self.password = password;
        observer.onCompleted();
      });
    } else {
      observer.onCompleted();
    }
  });
};

ItunesConnect.prototype.saveCredentials = function() {
  var self = this;
  return Rx.Observable.create(function(observer) {
    if (self.password) {
      config.set('appleId', self.email);
      keychain.setPassword({
        account: self.email,
        service: pkg.name,
        password: self.password
      }, function(err) {
        if (err) {
          logger.error('Error occured while accessing the keychain');
        }
        observer.onCompleted();
      });
    } else {
      observer.onCompleted();
    }
  });
};
