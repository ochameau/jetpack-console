let {Cu, Ci, Cc} = require("chrome");

let {AddonManager} = Cu.import("resource://gre/modules/AddonManager.jsm");
let {XPIProvider} = Cu.import("resource://gre/modules/XPIProvider.jsm");

let serviceUrl = require("self").data.url("HUDService.jsm");
let windowJsScript = require("self").data.url("chrome-win.js");

let xulNs = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
let blankXul = ('<?xml version="1.0"?>\n' +
                '<?xml-stylesheet href="chrome://global/skin/webConsole.css" type="text/css"?>\n' +
                '<window xmlns="' + xulNs + '" title="Browser console">' + 
                '<popupset id="mainPopupSet"></popupset>' +
                '<script>var serviceUrl = "' + serviceUrl + '";</script>' +
                '<script src="' + windowJsScript + '"></script></window>');
let url = "data:application/vnd.mozilla.xul+xml," + escape(blankXul);
let features = ["chrome", "width=800", "height=400", "resizable=yes"];

let ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
           .getService(Ci.nsIWindowWatcher);
/*
let win = ww.openWindow(null, url, null, features.join(","), null);
*/
require("timer").setInterval(function() {
  //console.log("Hey!");
}, 1000);


new (require("window-utils").WindowTracker)({
  onTrack: function (window) {
    let document = window.document;
    let webDev = document.getElementById("appmenu_webDeveloper");
    if (!webDev)
      return;
    let mainMenu = document.createElement("menu");
    mainMenu.setAttribute("label", "Addon Developer");
    let mainMenupopup = document.createElement("menupopup");
    let contextsMenu = document.createElement("menu");
    let contextsMenupopup = document.createElement("menupopup");
    contextsMenu.setAttribute("label", "Addon Consoles");
    contextsMenupopup.addEventListener("popupshowing", updateAddonList.bind(contextsMenupopup), false);
    contextsMenupopup.addEventListener("popuphidding", clearPopup.bind(contextsMenupopup), false);
    contextsMenu.appendChild(contextsMenupopup);
    mainMenupopup.appendChild(contextsMenu);
    mainMenu.appendChild(mainMenupopup);
    
    webDev.parentNode.insertBefore(mainMenu, webDev.nextSibling);
  },
  onUntrack: function (window) {
    
  }
});

function clearPopup(event) {
  let popup = event.target;
  if (popup != this)
    return;
  while(popup.firstChild)
    popup.removeChild(popup.firstChild);
}

function updateAddonList(event) {
  Cu.reportError("update..");
  let popup = event.target;
  if (popup != this)
    return;
  while(popup.firstChild)
    popup.removeChild(popup.firstChild);
  
  let document = popup.ownerDocument;
  
  AddonManager.getAddonsByTypes(["extension"], function(addons) {
    try {
      for(let i=0; i<addons.length; i++) {
        let addon = addons[i];
        let modules = getAddonModules(addon);
        if (!modules)
          continue;
        let item = document.createElement("menuitem");
        item.setAttribute("label", addon.name);
        item.addonId = addon.id;
        item.addEventListener("click", function (event) {
          let item = event.target;
          openConsole(item.addonId, item.getAttribute("label"))
        }, false);
        popup.appendChild(item);
      }
    } catch(e) {
      Cu.reportError("ex: "+e);
    }
  });
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

function openConsole(addonId, addonName) {
  // Awful xpcom things to do, in order to have a valid `arguments` 
  // in the opened window!
  let ary = Cc["@mozilla.org/supports-array;1"].
            createInstance(Ci.nsISupportsArray);
  let id = Cc["@mozilla.org/supports-string;1"].
             createInstance(Ci.nsISupportsString);
  id.data = addonId;
  ary.AppendElement(id);
  let name = Cc["@mozilla.org/supports-string;1"].
             createInstance(Ci.nsISupportsString);
  name.data = addonName;
  ary.AppendElement(name);
  
  ww.openWindow(null, url, null, features.join(","), ary);
}

// Automatically open a console to ease testing
AddonManager.getAddonsByTypes(["extension"], function(addons) {
    for(let i=0; i<addons.length; i++) {
      let addon = addons[i];
      let modules = getAddonModules(addon);
      if (!modules)
        continue;
      openConsole(addon.id, addon.name);
      break;
    }
  });


// Hack into Addonbuilder helper
const AddonBuilderID = "jid0-t3eeRQgGANLCH9c50lPqcTDuNng@jetpack";
AddonManager.getAddonByID(AddonBuilderID, function(addon) {
  Cu.reportError("found ABH:"+addon);
    let modules = getAddonModules(addon);
    if (!modules)
      return;
    for(let uri in modules.sandboxes) {
      if (uri.indexOf("addons-builder-helper.js") == -1)
        continue;
      Cu.reportError("found main module of ADB");
      let main = modules.sandboxes[uri].globalScope;
      let old = main.installAndRun;
      main.installAndRun = function () {
        Cu.reportError("Call install and run");
        let data = old.apply(null, arguments);
        openConsole(data.id, "addonbuilder-hack");
        return data;
      }
      Cu.reportError("Sucessfully overload installAndRun");
      break;
    }
  });


