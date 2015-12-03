var expect = require('chai').expect;
var Mixpanel = require('../lib/mixpanel');
var pkg = require('../package.json');
var Configstore = require('configstore');
var config = new Configstore(pkg.name);

var apps = config.get('apps');
var mixpanel;

describe('Mixpanel', function() {
  it('is created successfully', function() {
    expect(apps).to.be.an('array').that.is.not.empty;
    mixpanel = new Mixpanel(apps);
    expect(mixpanel).to.have.property('apps').that.is.an('array');
    expect(mixpanel.apps).to.not.be.empty;
  });
  it('retrieves stats for people', function(done) {
    var appWithPeople;
    for (var i = 0; i < apps.length; i++) {
      var app = apps[i];
      if (app.mixpanelKeyEventName && app.mixpanelKeyEventName === 'people') {
        appWithPeople = app;
        break;
      }
    }
    expect(appWithPeople).to.be.ok;
    mixpanel.getStats(appWithPeople).subscribeOnCompleted(function() {
      expect(app).to.have.property('keyEventCount').that.is.a('string');
      expect(app.keyEventCount).to.not.equal('–');
      expect(app.keyEventCount).to.contain('active users');
      expect(parseInt(app.keyEventCount.split(' ')[0], 10)).to.be.a('number');
      done();
    });
  });
  it('retrieves stats for an event', function(done) {
    var appWithEvent;
    for (var i = 0; i < apps.length; i++) {
      var app = apps[i];
      if (app.mixpanelKeyEventName && app.mixpanelKeyEventName !== 'people') {
        appWithEvent = app;
        break;
      }
    }
    expect(appWithEvent).to.be.ok;
    mixpanel.getStats(appWithEvent).subscribeOnCompleted(function() {
      expect(app).to.have.property('keyEventCount').that.is.a('string');
      expect(app.keyEventCount).to.not.equal('–');
      expect(app.keyEventCount).to.not.contain('active users');
      expect(app.keyEventCount).to.contain(appWithEvent.mixpanelKeyEventName);
      expect(parseInt(app.keyEventCount.split(':')[1].trim(), 10))
        .to.be.a('number');
      done();
    });
  });
  it('returns empty stats for an invalid app', function(done) {
    var app = {};
    mixpanel.getStats(app).subscribeOnCompleted(function() {
      expect(app).to.have.property('keyEventCount').that.is.a('string');
      expect(app.keyEventCount).to.equal('–');
      done();
    });
  });
});
