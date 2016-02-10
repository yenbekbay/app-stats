'use strict';

const Configstore = require('configstore');
const inquirer = require('inquirer');
const itc = require('itunesconnect');
const keychain = require('keychain');
const moment = require('moment');
const Rx = require('rx');

const pkg = require('../package.json');

const config = new Configstore(pkg.name);

class ItunesConnect {
  constructor(logger) {
    this.logger = logger;
  }

  getCredentials() {
    const self = this;

    return Rx.Observable.concat(
      self.getEmail(),
      self.getPassword()
    ).toArray();
  }

  getApps(since) {
    const self = this;

    if (this.apps) {
      return Rx.Observable.return(this.apps);
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

    return Rx.Observable
      .fromNodeCallback(self.itunesConnect.request, self.itunesConnect)(
        itc.Report.ranked({
          start: since
        })
      ).map(result => {
        self.apps = result[0].filter(item => {
          return item.rptgDesc === 'App';
        }).map(item => {
          return {
            type: item.contentSpecificTypeName,
            title: item.title,
            id: parseInt(item.key, 10)
          };
        });

        return self.apps;
      });
  }

  getStats(since) {
    const self = this;

    if (this.stats) {
      return Rx.Observable.return(this.stats);
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

    return Rx.Observable
      .fromNodeCallback(self.itunesConnect.request, self.itunesConnect)(
        itc.Report.ranked({
          start: since
        })
      ).map(result => {
        self.stats = result[0].map(item => {
          return {
            type: item.contentSpecificTypeName,
            title: item.title,
            id: parseInt(item.key, 10),
            units: item.units
          };
        });

        return self.stats;
      });
  }

  getEmail() {
    const self = this;

    if (this.email) {
      return Rx.Observable.return(this.email);
    }

    const savedEmail = config.get('appleId');
    if (savedEmail) {
      this.email = savedEmail;

      return Rx.Observable.return(savedEmail);
    }

    const emailRegex = new RegExp('^[-a-z0-9~!$%^&*_=+}{\'?]+(\.[-a-z0-9~' +
      '!$%^&*_=+}{\'?]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.(aero|' +
      'arpa|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|pro|' +
      'travel|mobi|[a-z][a-z])|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.' +
      '[0-9]{1,3}))(:[0-9]{1,5})?$', 'i');

    return Rx.Observable.fromCallback(inquirer.prompt)([{
      type: 'input',
      name: 'email',
      message: 'What\'s your Apple ID:',
      validate: function(value) {
        return !!value.match(emailRegex) || 'Please enter a valid email';
      }
    }]).map(answers => {
      self.email = answers.email;
      config.set('appleId', self.email);

      return self.email;
    });
  }

  getPassword() {
    const self = this;

    if (this.password) {
      return Rx.Observable.return(this.password);
    }

    const restorePassword = self.email ? Rx.Observable
      .fromNodeCallback(keychain.getPassword, keychain)({
        account: self.email,
        service: pkg.name
      }).catch(err => {
        self.logger.error(err.message);

        return Rx.Observable.return();
      }) : Rx.Observable.return();

    return restorePassword.flatMap(savedPassword => {
      if (savedPassword) {
        self.password = savedPassword;

        return Rx.Observable.return(savedPassword);
      }

      return Rx.Observable.fromCallback(inquirer.prompt)([{
        type: 'password',
        name: 'password',
        message: 'What\'s the password for your Apple ID:',
        validate: function(value) {
          const done = this.async();
          self.itunesConnect = new itc.Connect(self.email, value, {
            loginCallback: function(cookies) {
              done(true);
            }
          });

          /*eslint-disable */
          self.itunesConnect.request(itc.Report.ranked(), (err, result) => {});
          /*eslint-enable */

          setTimeout(() => {
            done('Please try again');
          }, 3000);
        }
      }]).flatMap(answers => {
        self.password = answers.password;

        return Rx.Observable.fromNodeCallback(keychain.setPassword, keychain)({
          account: self.email,
          service: pkg.name,
          password: self.password
        });
      });
    });
  }
}

module.exports = ItunesConnect;
