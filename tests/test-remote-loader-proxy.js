let {Cu} = require("chrome");
let proxy = require("remote-loader-proxy");
let {AddonManager} = Cu.import("resource://gre/modules/AddonManager.jsm");
let {XPIProvider} = Cu.import("resource://gre/modules/XPIProvider.jsm");

let global = this;

exports.testIt = function(test) {
  test.waitUntilDone();
  
  // First retrieve a reference to current addon's loader
  AddonManager.getAddonByID(require("@packaging").jetpackID + "@jetpack", function(addon) {
    let bootstrapScope = XPIProvider.bootstrapScopes[addon.id];
    let loader = bootstrapScope.loader;
    test.assert(loader, "Got chrome/bootstrap.js loader");
    
    // Then build a proxy to the remote loader instanciated in a remote process
    let remoteLoader = proxy.get(loader);
    
    // Check if this proxy works correctly
    /*
    test.assert(remoteLoader, "Got proxy to the remote/addon loader");
    test.assert("modules" in remoteLoader, "This proxy has an 'modules' attribute");
    let mainPath = require("@packaging").mainPath;
    test.assert(mainPath in remoteLoader.modules, "Main module is registered in this remote loader,");
    test.assert(!(mainPath in loader.modules), "But, main module is *not* registered in bootstrap loader!");
    */
    console.log("A");
    let selfProxy = remoteLoader.require(mainPath);
    test.assert(selfProxy, "We can access attributes through proxy");
    test.assert(selfProxy.testAttribute, "We can access attributes through proxy");
    /*
    test.assert(selfProxy.testAttribute, "We can access attributes through proxy");
    test.assert(selfProxy.testFunction(), "We can call method through proxy");
    selfProxy.testRemoteAttribute = true;
    test.assert(global.testRemoteAttribute, "We can register attributes through proxy");
    selfProxy.testRemoteMethod = function () true;
    test.assert(global.testRemoteMethod(), "We can register methods through proxy");
    */
    test.done();
  });
  
};

let testAttribute = true;

function testCallback() {

}
