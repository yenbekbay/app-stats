#! /usr/bin/env node

var MixpanelExport = require('mixpanel-data-export');
var Rx = require('rx');
var ItunesConnect = require('./itunes-connect');
var itc = new ItunesConnect();
var pkg = require('../package.json');
var Configstore = require('configstore');
var config = new Configstore(pkg.name);
var logger = require('./logger');
var appstore = require('./appstore');
var Mixpanel = require('./mixpanel');
var Table = require('cli-table2');
var argv = require('yargs')
    .help('help')
    .usage('Usage: app-stats <command> [options]')
    .command('setup', 'Set up Mixpanel for selected apps')
    .argv;
var command = argv._[0];
var mixpanel;

itc.getCredentials().subscribeOnCompleted(function() {
  logger.startSpinner('Updating the list of apps');
  itc.getApps().subscribe(function(apps) {
    logger.stopSpinner();
    var savedApps = config.get('apps');
    var mixpanelSetup = false;
    if (!savedApps) {
      savedApps = [];
      mixpanelSetup = apps.length > 0;
    }
    for (var i = 0; i < apps.length; i++) {
      var app = apps[i];
      var saved = false;
      for (var j = 0; j < savedApps.length; j++) {
        var savedApp = savedApps[j];
        if (savedApp.id === app.id) {
          savedApp.title = app.title;
          saved = true;
          break;
        }
      }
      if (!saved) {
        savedApps.push(app);
      }
    }
    config.set('apps', savedApps);
    mixpanel = new Mixpanel(savedApps);
    if (command === 'setup') {
      mixpanel.setUp().subscribeOnCompleted(function() {
        showStats(savedApps);
      });
    } else if (mixpanelSetup) {
      mixpanel.trySetUp().subscribeOnCompleted(function() {
        showStats(savedApps);
      });
    } else {
      showStats(savedApps);
    }
  }, function(err) {
    logger.error('Something went wrong: ' + err.message);
  });
});

function showStats(apps) {
  logger.startSpinner('Getting stats for today');
  Rx.Observable.merge(
    apps.map(function(app) {
      return [mixpanel.getStats(app), appstore.getRating(app)];
    }).reduce(function(a, b) {
      return a.concat(b);
    })
  ).concat(itc.getStats()).subscribe(function(itcStats) {
    logger.stopSpinner();
    var usingMixpanel = true;
    for (var i = 0; i < apps.length; i++) {
      if (apps[i].mixpanelApiKey) {
        usingMixpanel = true;
        break;
      }
    }
    var today = new Date();
    logger.success('Stats for ' + today.toISOString().split('T')[0] + ':');
    var table = new Table({
      head: ['', '# of downloads', 'average rating', '# of unique events']
        .slice(0, usingMixpanel ? 4 : 3)
    });
    apps = apps.map(function(app) {
      for (var i = 0; i < itcStats.length; i++) {
        var itcStat = itcStats[i];
        if (itcStat.id === app.id) {
          app.units = itcStat.units;
          break;
        }
      }
      return app;
    });
    for (i = 0; i < apps.length; i++) {
      var rating = apps[i].rating.average ?
        apps[i].rating.average.toFixed(1).bold + ' - ' +
        apps[i].rating.votersCount + ' votes' : '-';
      table.push([apps[i].title, apps[i].units || 0, rating,
        apps[i].keyEventCount].slice(0, usingMixpanel ? 4 : 3));
    }
    console.log(table.toString());
  }, function(err) {
    logger.error('Something went wrong: ' + err.message);
  });
}
