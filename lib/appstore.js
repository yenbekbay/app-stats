'use strict';

const request = require('request');
const Rx = require('rx');

module.exports.getRating = function(app) {
  return Rx.Observable.create(observer => {
    const options = {
      url: 'http://itunes.apple.com/lookup?id=' + app.id,
      gzip: true,
      encoding: null
    };

    request(options, (err, response, body) => {
      const rating = {
        average: 0.0,
        votersCount: 0
      };

      if (!err && response.statusCode === 200) {
        const result = JSON.parse(body)['results'][0];

        if (result) {
          rating.average = result.averageUserRating;
          rating.votersCount = result.userRatingCount;
        }
      }

      app.rating = rating;

      observer.onCompleted();
    });
  });
};
