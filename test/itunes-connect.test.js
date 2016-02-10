'use strict';

const Configstore = require('configstore');
const expect = require('chai').expect;

const ItunesConnect = require('../lib/itunes-connect');
const Logger = require('../lib/logger');
const pkg = require('../package.json');

const config = new Configstore(pkg.name);
const apps = config.get('apps');
let itunesConnect;

before(done => {
  const logger = new Logger(true);
  itunesConnect = new ItunesConnect(logger);
  itunesConnect.getCredentials().subscribe(() => {}, done, done);
});

describe('iTunes Connect', function() {
  this.timeout(4000);

  it('retrieves list of apps', done => {
    itunesConnect.getApps().subscribe(apps => {
      expect(apps).to.be.an('array').that.is.not.empty;

      apps.forEach(app => {
        expect(app).to.have.all.keys('type', 'title', 'id');
        expect(app.type).to.be.a('string');
        expect(app.title).to.be.a('string');
        expect(app.id).to.be.a('number');
      });

      done();
    }, done);
  });

  it('retrieves stats for apps', done => {
    itunesConnect.getStats().subscribe(stats => {
      expect(stats).to.be.an('array').that.is.not.empty;

      stats.forEach(stat => {
        expect(stat).to.have.all.keys('type', 'title', 'id', 'units');
        expect(stat.type).to.be.a('string');
        expect(stat.title).to.be.a('string');
        expect(stat.id).to.be.a('number');
        expect(stat.units).to.be.a('number');
      });

      done();
    });
  });
});
