'use strict';

const Configstore = require('configstore');
const moment = require('moment');
const Rx = require('rx');
const Table = require('cli-table2');

const appstore = require('./appstore');
const ItunesConnect = require('./itunes-connect');
const Mixpanel = require('./mixpanel');
const pkg = require('../package.json');

const config = new Configstore(pkg.name);

class Reporter {
  constructor(logger, since, setup) {
    this.logger = logger;
    this.since = since;
    this.setup = setup;
    this.itc = new ItunesConnect(logger);
  }

  report() {
    const self = this;

    let mixpanelSetup;

    return this.itc.getCredentials().flatMap(credentials => {
      self.logger.startSpinner('Updating the list of apps');

      return self.itc.getApps(self.since);
    }).map(apps => {
      let savedApps = config.get('apps') || [];
      mixpanelSetup = savedApps.length > 0 ? false : apps.length > 0;

      const savedIds = savedApps.map(app => app.id);
      apps.forEach(app => {
        if (savedIds.indexOf(app.id) === -1) {
          savedApps.push(app);
        }
      });

      config.set('apps', savedApps);

      return savedApps;
    }).flatMap(apps => {
      self.logger.stopSpinner();

      self.mixpanel = new Mixpanel(self.logger, apps);

      if (self.setup) {
        return self.mixpanel.setUp().flatMap(apps => self.showStats(apps));
      } else if (mixpanelSetup) {
        return self.mixpanel.trySetUp().flatMap(apps => self.showStats(apps));
      } else {
        return self.showStats(apps);
      }
    });
  }

  showStats(apps) {
    const self = this;

    return Rx.Observable.create(observer => {
      self.logger.startSpinner('Getting stats for ' +
        moment(self.since).fromNow(true));

      observer.onCompleted();
    }).concat(
      Rx.Observable.merge(
        apps.map(app => [
          self.mixpanel.getStats(app, self.since),
          appstore.getRating(app)
        ]).reduce((a, b) => a.concat(b))
      ),
      self.itc.getStats(self.since)
    ).flatMap(itcStats => {
      const usingMixpanel = apps.map(app => app.mixpanelApiKey).length > 0;
      const dateString = moment(self.since).fromNow(true) + ' (' +
        (moment(self.since).isSame(moment(), 'day') ? self.since : [
          self.since, moment().format('YYYY-MM-DD')
        ].join(' - ')) + ')';

      apps = apps.map(app => {
        for (let i = 0; i < itcStats.length; i++) {
          const itcStat = itcStats[i];

          if (itcStat.id === app.id) {
            app.units = itcStat.units;

            break;
          }
        }
        app.units = app.units || 0;
        app.rating = app.rating.average ? app.rating.average.toFixed(1).bold +
          ' - ' + app.rating.votersCount + ' votes' : '-';

        return app;
      });

      const table = new Table({
        head: [
          '',
          '# of downloads',
          'average rating',
          '# of unique events'
        ].slice(0, usingMixpanel ? 4 : 3)
      });

      apps.forEach(app => {
        table.push([
          app.title,
          app.units,
          app.rating,
          app.keyEventCount
        ].slice(0, usingMixpanel ? 4 : 3));
      });

      self.logger.stopSpinner();
      self.logger.success('Stats for ' + dateString + ':');
      console.log(table.toString());

      return Rx.Observable.empty();
    });
  }
}

module.exports = Reporter;
