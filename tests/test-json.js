const { Widget } = require("widget");
const { Cc, Ci, Cu } = require("chrome");

exports.testIt = function(test) {
  test.waitUntilDone();
  let s = Cu.Sandbox("http://mozilla.org");
  let f = Cu.evalInSandbox("(function test(s) JSON.stringify(s))", s);
  dump( f([1, 2, 3]) +"\n");
};
