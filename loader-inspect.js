let {Cu} = require("chrome");
let {XPIProvider} = Cu.import("resource://gre/modules/XPIProvider.jsm");
let remoteProxy = require("remote-loader-proxy");

function getModulesWithNewLoader(bootstrapLoader) {
  let remoteAddonLoader = remoteProxy.get(bootstrapLoader);
  
  function loaderToModules(loader) {
    let modules = {};
    for(let uri in loader.sandboxes) {
      modules[uri] = loader.sandboxes[uri].sandbox;
    }
    return modules;
  }
  
  // Try to retrieve tests modules, if we are running tests.
  // They are loaded in a seperate Loader instance, created in 
  // `test-harness/run-tests.js` module; this module is the main module
  // used when we are running tests.
  // This loader instance is set into `sandbox` global
  let tests = {};
  let mainPath = bootstrapLoader.require("@packaging").mainPath;
  if (mainPath.indexOf("/run-tests.js") != -1) {
    let main = remoteAddonLoader.sandboxes[mainPath].sandbox;
    for(let id in remoteAddonLoader.sandboxes) {
      if (id.indexOf("/harness.js") != -1) {
        let harness = remoteAddonLoader.sandboxes[id].sandbox;
        if ("sandbox" in harness && "sandboxes" in harness.sandbox) {
          tests = loaderToModules(harness.sandbox);
          break;
        }
      }
    }
  }
  let chrome = loaderToModules(bootstrapLoader);
  let addon = loaderToModules(remoteAddonLoader);
  let all = {};
  for(let i in tests)
    all["tests-" + i] = tests[i];
  for(let i in chrome)
    all["chrome-"+i] = chrome[i];
  for(let i in addon)
    all[i] = addon[i];
  return {
    get modules() {
      return {
        chrome: chrome,
        addon: addon,
        content: {},
        tests: tests,
        all: all
      }
    },
    main: remoteAddonLoader.sandboxes[mainPath].sandbox
  };
}

function getModulesWithOldLoader(gHarness) {
  var harness = gHarness.service;
  if (!harness)
    return null;
  var loader = harness.loader;
  if (!loader)
    return null;
  return {
    sandboxes: loader.sandboxes,
    main: harness.options.main
  };
}

exports.getAddonInfo = function getAddonInfo(addon) {
  var bootstrapScope = XPIProvider.bootstrapScopes[addon.id];
  if (!bootstrapScope)
    throw new Error("Unable to retrieve bootstrap scope for addon '" + addon.id + "'");

  // New loader
  if ("loader" in bootstrapScope)
    return getModulesWithNewLoader(bootstrapScope.loader);
  // Old loader - securable-module
  else if ("gHarness" in bootstrapScope)
    return getModulesWithOldLoader(bootstrapScope.gHarness);

  // Unable to detect any known version of jetpack loader
  // It may be a older/newer jetpack version or a xul addon
  return null;
}
