var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

var {HUDService, HeadsUpDisplay, ConsoleUtils} = Cu.import(serviceUrl);
var {Services} = Cu.import("resource://gre/modules/Services.jsm");
var {XPIProvider} = Cu.import("resource://gre/modules/XPIProvider.jsm");
var {AddonManager} = Cu.import("resource://gre/modules/AddonManager.jsm");

// Setup the window
document.documentElement.style.background = "white";
window.resizeTo(740, 400);

// Create a vbox container for the HUD
var nbox = document.createElement("hbox");
nbox.setAttribute("flex", "1");
document.documentElement.appendChild(nbox);

//hud.reattachConsole(context);
function createConsoleForContext(context) {
  // We need to set location attribute, otherwise, some HUDService code will fail
  // but in order to to so, because exports are frozen, we need to clone this object
  context = Object.create(context);
  context.location = "foo";
  // Needed for evaluation:
  context.wrappedJSObject = context;
  
  var config = {
    parentNode: nbox,
    contentWindow: context
  };

  nbox.setAttribute("id", "browserconsole");

  var hudId = "hud_browserconsole";

  // Setup storage
  HUDService.wakeup();

  // Setup default filterPrefs
  HUDService.registerDisplay(hudId);

  var hud = new HeadsUpDisplay(config);

  HUDService.registerHUDReference(hud);
}

const obsService = Cc["@mozilla.org/observer-service;1"].
                 getService(Ci.nsIObserverService);
function hackAddonConsole(addonId, consoleScope) {
  var original = consoleScope.message;
  consoleScope.message = function (print, level, args) {
    
    var consoleEvent = {
      ID: -1,
      innerID: -1,
      level: level,
      filename: "?", //Components.stack.caller.fileName || "?",
      lineNumber: 1,
      functionName: "?",//arguments.callee.name || "?",
      arguments: args,
      addon: {
        id: addonId,
        module: "---"
      }
    };

    consoleEvent.wrappedJSObject = consoleEvent;
    obsService.notifyObservers(consoleEvent, "jetpack-api-log-event", -1);
    original.apply(null, arguments);
  }
}

function getAddonModules(addon) {
  var bootstrapScope = XPIProvider.bootstrapScopes[addon.id];
  if (!bootstrapScope)
    return null;
  var harness = bootstrapScope.gHarness.service;
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

var addonId = arguments[0];
var addonName = arguments[1];

if (addonName == "addonbuilder-hack") {
  // Awful hack to dig into Addonbuilder helper in order to retrieve the
  // global scope of main module of launched addon
  // 1) Dig into ABH module called bootstrap.js
  //    Get a reference to `gServices` that hold a list of all harness instances
  //    (on instance per addon executed via ABH)
  // 2) Now that we have an harness instance of the executed addon,
  //    a/ Hack its console module
  //    b/ Get a reference to its main module global scope
  // 3) Open a console!
  const AddonBuilderID = "jid0-t3eeRQgGANLCH9c50lPqcTDuNng@jetpack";
  AddonManager.getAddonByID(AddonBuilderID, function(addon) {
      var modules = getAddonSandboxes(addon).modules;
      if (!modules)
        return;
      for(var uri in modules) {
        if (uri.indexOf("bootstrap.js") == -1)
          continue;
        var bootstrap = modules[uri].globalScope;
        for(var classID in bootstrap.gServices) {
          var harness = bootstrap.gServices[classID];
          if (harness.options.jetpackID != addonId)
            continue;
          document.title = "Addon builder project - "+harness.options.name;
          var main = harness.options.main;
          var loader = harness.loader;
          var modules = loader.sandboxes;
          for(var uri in modules) {
            var module = modules[uri];
            if (uri.indexOf("plain-text-console.js"))
              hackAddonConsole(addonId, module.globalScope);
            if (uri.indexOf(main)==-1)
              continue;
            
            createConsoleForContext(module.globalScope);
            break;
          }
        }
      }
    });
}
else {
  document.title = "Addon console - " + addonName;
  AddonManager.getAddonByID(addonId, function(addon) {
    try {
      var modules = getAddonModules(addon);
      for(var uri in modules.sandboxes) {
        var module = modules.sandboxes[uri];
        if (uri.indexOf("plain-text-console.js"))
          hackAddonConsole(addonId, module.globalScope);
        if (uri.indexOf(modules.main)==-1)
          continue;
        createConsoleForContext(module.globalScope);
        break;
      }
    } catch(e) {
      Cu.reportError(e);
    }
  });
}
