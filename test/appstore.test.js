'use strict';

const Configstore = require('configstore');
const expect = require('chai').expect;

const appstore = require('../lib/appstore');
const pkg = require('../package.json');

const config = new Configstore(pkg.name);
const apps = config.get('apps');

describe('App Store', () => {
  it('retrieves a rating for a valid app', done => {
    expect(apps).to.be.an('array').that.is.not.empty;
    const app = apps[0];

    appstore.getRating(app).subscribeOnCompleted(() => {
      expect(app).to.have.property('rating').that.is.an('object');
      expect(app.rating).to.have.all.keys('average', 'votersCount');

      done();
    });
  });

  it('returns an empty rating for an invalid app', done => {
    const app = {
      id: 'loremipsum'
    };
    appstore.getRating(app).subscribeOnCompleted(() => {
      expect(app).to.have.property('rating').that.is.an('object');
      expect(app.rating).to.have.all.keys('average', 'votersCount');
      expect(app.rating.average).to.equal(0.0);
      expect(app.rating.votersCount).to.equal(0);

      done();
    });
  });
});
