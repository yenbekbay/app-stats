var expect = require('chai').expect;
var ItunesConnect = require('../lib/itunes-connect');
var pkg = require('../package.json');
var Configstore = require('configstore');
var config = new Configstore(pkg.name);

var apps = config.get('apps');
var itunesConnect;

describe('iTunes Connect', function() {
  this.timeout(4000);
  it('is created successfully', function(done) {
    itunesConnect = new ItunesConnect();
    expect(itunesConnect).to.have.property('email').that.is.a('string').and
      .is.not.empty;
    itunesConnect.restorePassword().subscribeOnCompleted(function() {
      expect(itunesConnect).to.have.property('password').that.is.a('string').and
        .is.not.empty;
      done();
    });
  });
  it('retrieves list of apps', function(done) {
    itunesConnect.getApps().subscribe(function(apps) {
      expect(apps).to.be.an('array').that.is.not.empty;
      for (var i = 0; i < apps.length; i++) {
        var app = apps[i];
        expect(app).to.have.all.keys('type', 'title', 'id');
        expect(app.type).to.be.a('string');
        expect(app.title).to.be.a('string');
        expect(app.id).to.be.a('number');
      }
      done();
    }, done);
  });
  it('retrieves stats for apps', function(done) {
    itunesConnect.getStats().subscribe(function(stats) {
      expect(stats).to.be.an('array').that.is.not.empty;
      for (var i = 0; i < stats.length; i++) {
        var stat = stats[i];
        expect(stat).to.have.all.keys('type', 'title', 'id', 'units');
        expect(stat.type).to.be.a('string');
        expect(stat.title).to.be.a('string');
        expect(stat.id).to.be.a('number');
        expect(stat.units).to.be.a('number');
      }
      done();
    });
  });
});
