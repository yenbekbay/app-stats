var request = require('request');
var Rx = require('rx');

module.exports.getRating = function(app) {
  return Rx.Observable.create(function(observer) {
    var options = {
      url: 'http://itunes.apple.com/lookup?id=' + app.id,
      gzip: true,
      encoding: null
    };
    var errorCount = 0;
    request(options, function(err, response, body) {
      var rating = {
        average: 0.0,
        votersCount: 0
      };
      if (!err && response.statusCode === 200) {
        var result = JSON.parse(body)['results'][0];
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
