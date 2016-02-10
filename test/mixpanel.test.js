'use strict';

const Configstore = require('configstore');
const expect = require('chai').expect;

const Logger = require('../lib/logger');
const Mixpanel = require('../lib/mixpanel');
const pkg = require('../package.json');

const config = new Configstore(pkg.name);
const apps = config.get('apps');
let mixpanel;

before(done => {
  expect(apps).to.be.an('array').that.is.not.empty;

  const logger = new Logger(true);
  mixpanel = new Mixpanel(logger, apps);
  expect(mixpanel).to.have.property('apps').that.is.an('array');
  expect(mixpanel.apps).to.not.be.empty;

  done();
});

describe('Mixpanel', () => {
  it('retrieves stats for people', done => {
    const appsWithPeople = apps.filter(app => {
      return app.mixpanelKeyEventName && app.mixpanelKeyEventName === 'people';
    });

    let app = appsWithPeople.length > 0 ? appsWithPeople[0] : null;
    expect(app).to.be.ok;

    mixpanel.getStats(app).subscribeOnCompleted(() => {
      expect(app).to.have.property('keyEventCount').that.is.a('string');
      expect(app.keyEventCount).to.not.equal('–');
      expect(app.keyEventCount).to.contain('active users');
      expect(parseInt(app.keyEventCount.split(' ')[0], 10)).to.be.a('number');

      done();
    });
  });

  it('retrieves stats for an event', done => {
    const appsWithEvent = apps.filter(app => {
      return app.mixpanelKeyEventName && app.mixpanelKeyEventName !== 'people';
    });

    let app = appsWithEvent.length > 0 ? appsWithEvent[0] : null;
    expect(app).to.be.ok;

    mixpanel.getStats(app).subscribeOnCompleted(() => {
      expect(app).to.have.property('keyEventCount').that.is.a('string');
      expect(app.keyEventCount).to.not.equal('–');
      expect(app.keyEventCount).to.not.contain('active users');
      expect(app.keyEventCount).to.contain(app.mixpanelKeyEventName);
      expect(parseInt(app.keyEventCount.split(':')[1].trim(), 10))
        .to.be.a('number');

      done();
    });
  });

  it('returns empty stats for an invalid app', done => {
    let app = {};

    mixpanel.getStats(app).subscribeOnCompleted(() => {
      expect(app).to.have.property('keyEventCount').that.is.a('string');
      expect(app.keyEventCount).to.equal('–');

      done();
    });
  });
});
