var expect = require('chai').expect;
var appstore = require('../lib/appstore');
var pkg = require('../package.json');
var Configstore = require('configstore');
var config = new Configstore(pkg.name);

var apps = config.get('apps');

describe('App Store', function() {
  it('retrieves a rating for a valid app', function(done) {
    expect(apps).to.be.an('array').that.is.not.empty;
    var app = apps[0];
    appstore.getRating(app).subscribeOnCompleted(function() {
      expect(app).to.have.property('rating').that.is.an('object');
      expect(app.rating).to.have.all.keys('average', 'votersCount');
      done();
    });
  });
  it('returns an empty rating for an invalid app', function(done) {
    var app = { id: 'loremipsum'};
    appstore.getRating(app).subscribeOnCompleted(function() {
      expect(app).to.have.property('rating').that.is.an('object');
      expect(app.rating).to.have.all.keys('average', 'votersCount');
      expect(app.rating.average).to.equal(0.0);
      expect(app.rating.votersCount).to.equal(0);
      done();
    });
  });
});
