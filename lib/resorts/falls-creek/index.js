const coerce = require('../../tools/coerce');
const debug = require('debug')('liftie:resort:powdr');

module.exports = parse;

function parse({ Lifts: { Lift } }) {
  var liftStatus = {};

  Lift.forEach(function ({ LiftName, LiftStatusMorning }) {
    liftStatus[LiftName] = coerce(LiftStatusMorning);
  });

  debug('Lift Status:', liftStatus);
  return liftStatus;
}
