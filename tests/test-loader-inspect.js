let {Cu} = require("chrome");
let {AddonManager} = Cu.import("resource://gre/modules/AddonManager.jsm");
let inspect = require("loader-inspect");

let global = Math.random();

exports.testIt = function(test) {
  test.waitUntilDone();

  // First retrieve a reference to current addon
  AddonManager.getAddonByID(require("@packaging").jetpackID + "@jetpack", function(addon) {
console.log(require("@packaging").jetpackID+" -->"+addon);
    let info = inspect.getAddonInfo(addon);
    
    test.assertEqual(Object.keys(info.modules).sort().join(", "), 
                     ["chrome", "addon", "all", "content", "tests"].sort().join(", "));
/*
    console.log("---ADDON\n"+Object.keys(info.modules.addon).join("\n")+"---\n");
    console.log("---CHROME\n"+Object.keys(info.modules.chrome).join("\n")+"---\n");
    console.log("---TESTS\n"+Object.keys(info.modules.tests).join("\n")+"---\n");
*/
    test.assert(module.path in info.modules.tests, "this test lives in modules.tests");

    test.assert(info.main.module.path in info.modules.addon, "`main` lives in modules.addon");
    test.assert(info.main.module.path, require("@packaging").mainURI, "`main` is really the main module");

    test.done();
  });
};
