var should = require('should');
var fs = require('fs');
var parser = require('../../lib/lifts/parser');
var parse = require('../../lib/lifts/parse')('mtrose');

/*global describe, it */
describe('parse mtrose', function() {

  it('should return lift status', function(done) {
    var stream = fs.createReadStream(__dirname + '/example/mtrose.html');
    stream.on('error', done);
    stream.pipe(parser(parse, function(err, status) {
      var expected = {
        'Northwest Mag 6': 'hold',
        'Blazing Zephyr 6*': 'hold',
        'Chuter': 'closed',
        'Lakeview': 'open',
        'Galena': 'closed',
        'Wizard': 'open',
        'Magic East': 'scheduled',
        'Magic West': 'scheduled'
      };
      should.exist(status);
      status.should.eql(expected);
      done(err);
    }));
  });
});
