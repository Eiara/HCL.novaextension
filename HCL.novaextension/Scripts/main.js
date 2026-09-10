/*
* Terraform LSP manager for Nova.
* 
* Some code taken from the Laravel LSP Nova extension project, licensed under
*   MIT.
* https://github.com/aprivette/nova-laravel-lsp/
*/

const helpers = require("helpers.js");

var langserver = null;
var prefix = "nz.eiara.hcl";

// default paths
var defaultTerraformPath = "/opt/homebrew/bin/terraform";
var terraformLsPath = "/opt/homebrew/bin/terraform-ls";

// terraform path
var terraformPath = null;

// Taken from the Laravel LSP extension, to guard against different servers for
// different projects as well as within this project being restarted.
var clientSerial = 0;
var instanceSerial = 0;

// Taken from the Laravel LSP extension.
/*
 * Clients this extension has intentionally stopped.
 * Tracked so that we can distinguish between a crashed server (if necessary),
 * and when we intentionally restart the server.
*/
var deliberateStops = new WeakSet();

exports.activate = function() {
    // Do work when the extension is activated
    console.log("Activating Terraform LSP extension");
    
    // In case there's an existing language server running, we need to shut it
    // down
    if (langserver) {
      langserver.deactivate();
    }
    langserver = null;
    langserver = new TerraformLanguageServer();
    
    nova.subscriptions.add(
      nova.commands.register(`${prefix}.terraformls.restart`, function() {
        if (langserver) {
          langserver.queueStart(true);
        }
      })
    );
    nova.subscriptions.add(
      nova.commands.register(`${prefix}.terraform.format`, function(editor) {
        format(editor);
      })
    );
    
    nova.subscriptions.add(
      nova.workspace.activeTextEditor.onWillSave((editor) => {
        if (editor.document.syntax !== "terraform") {
          // Ignore anything that's not terraform regardless
          return;
        }
        var enabled = getPreference("terraform.formatOnSave");
        // If the feature is disabled, ignore the callback.
        // while this does add a small amount of overhead to each save call,
        // save calls are going to be really infrequent.
        if (!enabled) {
          return false;
        }
        return format(editor);
      })
    );
    // add the path observers that update the currently used Terraform path
    setTerraformBinary();
    addPathObservers();
}

exports.deactivate = function() {
    console.log("Deactivating Terraform extension");
    // Clean up state before the extension is deactivated
    if (langserver) {
        langserver.deactivate();
        langserver = null;
    }
}

function addPathObservers() {
  var combinedKey = `${prefix}.terraform.path`
  let confs = [nova.config, nova.workspace.config];
  for (var conf of confs) {
    nova.subscriptions.add(
      conf.onDidChange(
        combinedKey,
        function (newValue, oldValue) {
          debug(`${combinedKey}: ${oldValue} => ${newValue}`);
          setTerraformBinary();
        }
      )
    );
  }
}

function setTerraformBinary() {
  var preferencePath = getPreference("terraform.path");
  
  if (preferencePath) {
    if (helpers.isExecutableFile(preferencePath)) {
      debug(`Setting terraformPath to ${preferencePath}`);
      terraformPath = preferencePath;
      return;
    }
    else {
      throw new Error(`Cannot find Terraform binary at ${preferencePath}. Please set a valid preference path.`);
    }
  }
  
  if (helpers.isExecutableFile(defaultTerraformPath)) {
    debug(`Setting terraformPath to ${defaultTerraformPath}`);
    terraformPath = defaultTerraformPath;
  }
  // otherwise, use the find functionality to set the binary
  terraformPath = findTerraformBinary();
}

// Returns either the workspace preference, or the global preference
function getPreference(preference) {
  var localPref;
  var globalPref;
  var combinedKey = `${prefix}.${preference}`;
  debug("getPreference: " + combinedKey);
  try {
    switch(preference) {
      case "terraformls.enabled":
      case "terraform.formatOnSave":
        localPref = helpers.booleanEnum(nova.workspace.config.get(combinedKey));
        break;
      default:
        localPref = nova.workspace.config.get(combinedKey);
        break;
    }
    globalPref = nova.config.get(combinedKey);
  }
  catch (err) {
    console.log("Missing preference: " + preference);
    return null;
  }
  // force the array to null, so that it gets ignored properly by consumers
  if (Array.isArray(localPref) || Array.isArray(globalPref)) {
    if (localPref.length == 0) {
      localPref = null;
    }
    if (globalPref.length == 0) {
      globalPref = null;
    }
  }
  // prefer local preference, otherwise global
  var pref = localPref ?? globalPref;
  
  // Blank values should be cast to null
  if (pref === "") {
    pref = null;
  }
  
  debug("local: " + localPref);
  debug("global: " + globalPref);
  debug("returning " + pref);
  return pref;
}


function getSettings() {
  var settings = [
      {
        name: "terraform",
        values: {
          logFilePath: getPreference("terraformls.logfile"),
          timeout: helpers.toTime(getPreference("terraformls.timeout")),
          path: getPreference("terraform.path")
        }
      },
      // What extra directories we should be ignoring
      { 
        name: "indexing",
        values: {
          ignoreDirectoryNames: getPreference("terraformls.ignoredDirectories"),
          ignorePaths: getPreference("terraformls.ignoredPaths")
        }
      },
      {
        name: "validation",
        values: {
          enableEnhancedValidation: getPreference("terraformls.enableEnhancedValidation")
        }
      }
  ];
  // this could obviously be better.
  var ret = {}
  for (let set of settings) {
    var obj = {}
    for (let [key, value] of Object.entries(set.values)) {
      if (value !== null && value !== "") {
        obj[key] = value;
      }
    }
    if (Object.keys(obj).length >= 1) {
      ret[set.name] = obj;
    }
  }
  return ret;
}

class TerraformLanguageServer {
    constructor() {
      
      // Increment our own id each time we're recreated
      this.id = ++instanceSerial;
      
      this.languageClient = null;
      
      // So we can de-register observers on shutdown.
      this.observers = new CompositeDisposable();
      // whether or not we've disposed of our observers
      this.disposed = true;
      
      // keep track of our current settings
      this.currentSettings = null;
      
      // Restart management
      this.stopping = false;
      this.starting = false;
      // we're not started
      this.hasStarted = false;
      // So we can pause before we let a restart happen
      this.restartTimer = null;
      
      // so we can queue sending preferences
      
      this.preferencesTimer = null;
      
      // Observe the configuration setting for the server's location, and restart the server on change
      this.addObservers();
      this.queueStart();
    }
    
    addObservers() {
      // keys where we'll stop and (possibly) restart the server language
      //  server
      let restartKeys = [
        "terraformls.path",
        "terraformls.enabled",
      ]
      // Keys where we send the configuration update to the server
      let updateKeys = [
        "terraformls.logfile",
        "terraformls.timeout",
        "terraformls.ignoredPaths",
        "terraformls.ignoredDirectories",
        "terraformls.enableEnhancedValidation"
      ]
        
      // Set up monitoring to stop and restart the extension
      let confs = [nova.config, nova.workspace.config];
      for (var config of confs) {
        for (var key of restartKeys) {
          var combinedKey = `${prefix}.${key}`
          debug(`observing ${combinedKey}`);
          var disp = config.onDidChange(combinedKey,
              function(newValue, oldValue) {
                console.log(`Restart ${combinedKey}: ${oldValue} => ${newValue}`);
                // Force a restart
                this.queueStart(true);
              }, 
            this);
            this.observers.add(disp);
        }
        for (var key of updateKeys) {
          // These send a language server update when they're changed.
          // Settings changes don't require a server restart.
          var combinedKey = `${prefix}.${key}`
          var disp = config.onDidChange(combinedKey,
            function(newValue, oldValue) {
              console.log(`Update Key: ${combinedKey}: ${oldValue} => ${newValue}`);
              if (this.currentSettings.get(combinedKey) !== newValue) {
                // should this do a timer? Hmm.
                this.sendPreferences();
              }
            },
          this);
          
          this.observers.add(disp);
        }
      }
      this.disposed = false;
    }
    
    deactivate() {
      
      this.stopping = true;
      
      // Clear out our observers
      this.observers.dispose();
      this.disposed = true;
      
      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
        this.restartTimer = null;
      }
      if (this.preferencesTimer) {
        clearTimeout(this.preferencesTimer);
        this.preferencesTimer = null;
      }
      
      this.stop();
    }
    // Queue a restart
    queueStart(force = false) {
      if (this.disposed || !this.isCurrent()) {
        console.log(`Ignoring a queued start on closed instance ${this.id}`);
        return;
      }
      if (this.starting) {
        console.log("terraform-ls already starting; ignoring queued start");
        return;
      }
      if (this.languageClient && !force) {
        console.log("Start queued with a running server?");
        return;
      }
      // We already had a live timer, so, the user might've just twiddled two
      // settings simultaneously. We can no-op as a result.
      if (this.restartTimer) {
        return;
      }
      // Stop the server here, so that we're not trying to start a new server
      // as the old one is shutting down.
      this.stop();
      
      // Start up in half a second or so.
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        this.start();
      }, 500);
    }
    
    /*
    Taken from the Laravel LSP nova extension.
    Used to determine if this instance of the class is the one that Nova is
    using, or not, as Nova apparently does not call `deactivate` reliably.
    */
    isCurrent() {
      return langserver === null || langserver === this;
    }
    
    sendPreferences() {
      if (this.disposed || !this.isCurrent()) {
        console.log(`cannot send preferences from a dead instance`);
        return;
      }
      
      /* there's two states we'll be in:
       * 1. The server is fully started. We can just queue up a send.
       * 2. The server is starting but not fully started yet. In that case,
       *    we still want to queue up the send, since it'll *probably* be ready
       *    at some point, or, it'll be dead.
      */
      
      if (this.starting) {
        // we're starting, so, we can queue up
        console.log("Preference change queued during startup");
      }
      
      if (this.preferencesTimer) {
        // We can ignore the need to re-queue, since we fetch settings when
        // we get to the callback function
        console.log("Preference timer already queued; requeuing");
        clearTimeout(this.preferencesTimer);
        this.preferencesTimer = null;
      }
      
      if (this.stopping || !this.languageClient) {
        console.log("Cannot send preferences from dead instance");
        return;
      }
      // finally, queue set up a timer for actually syncing the prefrences.
      // This lets the server start up fully with the original configuration
      // before we start yeeting changes at it.
      
      this.preferencesTimer = setTimeout(() => {
        if (!this.hasStarted) {
          console.log("Server not yet started; resetting preferencesTimer");
          this.sendPreferences();
          return;
        }
        // Force a restart to update the settings object in the server.
        // This is because workspace/didChangeConfiguration is not supported
        //  by the underlying LS.
        this.queueStart(true);
        
        // var currentSettings = getSettings();
        // this.languageClient.sendNotification("workspace/didChangeConfiguration", currentSettings);
        // this.currentSettings = new Map(Object.entries(currentSettings));
      }, 500);
    }
    
    start() {
      
      if (this.disposed || !this.isCurrent()) {
        log("Ignoring a start on superceded instance " + this.id);
        return;
      }
      
      if (this.starting) {
        console.log("terraform-ls already starting");
        return;
      }
      
      if (this.hasStarted) {
        console.log(`Instance ${this.id} already started?`);
      }
      // fetch current settings
      // If we're already running, just force a stop and we'll restart from
      // here.
      this.stop();
      
      if (this.stopping === true) {
        this.stopping = false;
      }
      
      var enable = getPreference("terraformls.enabled");
      
      console.log("enabled?: " + enable);
      
      if (enable !== true) {
        console.log("Terraform language server disabled");
        return;
      }
      notify("starting terraform-ls");
      
      var path = getPreference("terraformls.path");
      // Use the default server path, assuming Homebrew
      if (!path) {
        path = '/opt/homebrew/bin/terraform-ls';
      }
      
      // Set up the server options
      // there appears to be a blank `workdir` value here as well?
      var serverOptions = {
        path: path,
        args: ["serve"],
        workdir: nova.workspace.path
      };
      
      
      var clientOptions = {
          // The set of document syntaxes for which the server is valid
          syntaxes: [
            'terraform',
            'terraform-vars',
            'terraform-stack',
            'terraform-deploy',
            'terraform-search',
            'terraform-policy',
            'terraform-policytest'
          ],
          debug: getPreference("terraformls.debug"),
          initializationOptions: currentSettings
      };
      // Create an identifier so that more than one server can be run
      // simultaneously, one per workspace, as necessary.
      
      var currentSettings = getSettings();
      debug(Object.entries(currentSettings));
      
      const identifier = `terraform-ls-${Date.now()}-${++clientSerial}`;
      var client = new LanguageClient(
        identifier,
        'Terraform Language Server',
        serverOptions,
        clientOptions
      );
      
      // set up the shutdown handler
      this.stopHandler = client.onDidStop((error) => {
        const deliberateClient = deliberateStops.delete(client);
        
        console.log(`Client ${identifier} stopped${error ? ` with: ${error}` : ' cleanly'}.`);
        
        release(client);
        // Is the in-scope client the same as the client that's currently
        // bound to the object? If not, we're closing an old/dangling server
        // instance.
        const wasCurrent = this.languageClient === client;
        
        // If yes, we're closing our current server instance.
        if (wasCurrent) {
          this.languageClient = null;
        }
        
        /**
         * Taken from Laravel LSP project.
         * Nova can deliver this seconds after the fact, and it describes a
         * client it tore down for us as invalidated rather than as stopped.
         * So an error here does not mean the user lost their server: for one
         * we replaced, or shut down ourselves, it is the expected report, and
         * the live server is answering requests the whole time.
         * 
         * Interrupting anyone over that trains them to ignore the notification
         * that matters.
         */
        if (deliberate || !wasCurrent) {
          console.log(`Ignoring the stop of superseded client ${identifier}: ${error}`);
          return;
        }
        log(`terraform-ls stopped unexpectedly: ${error}`);
        // And finally, we can notify the user that the server stopped and 
        // how to restart it.
        if (this.hasStarted) {
          notify(
            'terraform-ls stopped',
            `${error}\n\nRun Extensions -> Restart terraform-ls to try again.`
          );
        }
      });
      
      // Finally, we can start the client.
      
      this.starting = true;
      try {  
        // Start the client
        client.start();
        // Add the client to the subscriptions to be cleaned up
        nova.subscriptions.add(client);
        this.hasStarted = true;
        this.currentSettings = new Map(Object.entries(currentSettings));
        this.languageClient = client;
        // Finally, send the current preferences to the server.
      }
      catch (error) {
        // If the .start() method throws, it's likely because the path to the language server is invalid
        
        if (this.languageClient === client) {
          this.languageClient = null;
        }
        this.hasStarted = false;
        this.currentSettings = null;
        
        // Drop the client
        nova.subscriptions.remove(client);
        
        if (nova.inDevMode()) {
          console.error(err);
        }
        notify(
          "Failed to start terraform-ls",
          `${error}`
        );
      }
      finally {
        this.starting = false;
      }
    }
    
    stop() {
      const client = this.languageClient;
      
      // No-op if we don't have a client to work with
      if (!client) {
        return;
      }
      
      // So we know we shut ourselves down
      deliberateStops.add(client);
      // clear the client so that handlers stop firing 
      this.languageClient = null;
      
      this.stopping = true;
      this.hasStarted = false;
      nova.subscriptions.remove(client);
      client.stop();
    }
}

function notify(title, body, requestName = null) {
  
  const reqName = requestName ?? "terraform-ls-message";
  
  const request = new NotificationRequest(reqName);

  request.title = nova.localize(title);
  request.body = nova.localize(body);

  nova.notifications.add(request);
}

function format(editor) {
  /*
  There's a couple of ways to approach this.
  
  One is that we just shell out to `terraform fmt` like normal, which
  really only works if it's being run on-save.
  Otherwise, we can call out to the terraform language server,
  if it's running, to do the format call for us using
  `source.formatAll.terraform`.
  TODO: Implement the LS version of formatting
    Requires reviewing the VSCode codeAction system to understand how 
    terraform-ls gets used to 
    
  */
  
  const documentSpan = new Range(0, editor.document.length);
  const documentText = editor.document.getTextInRange(documentSpan);
  return process(documentText)
    .then((finalText) => {
      editor.edit((edit) => {
        edit.replace(new Range(0, editor.document.length), finalText);
      });
    })
    .catch((errorText) => {
      notify(
        "Terraform Format Error",
        errorText,
        "terraform-fmt-error"
      );
      return;
    });
}

function process(inputText) {
  var options = {
    args: ["fmt", "-no-color", "-"],
    stdio: "pipe",
  };
  
  const path = terraformPath;
  debug(`Terraform path: ${path}`);
  
  if (path === null) {
    notify(
      "Terraform Not Found",
      "Cannot find Terraform binary.  Please ensure the Terraform binary exists on your PATH environment variable.",
      "terraform-not-found"
    );
    return;
  }
  return new Promise((resolve, reject) => {
    try {
      var process = new Process(path, options);
      const writer = process.stdin.getWriter();
      writer.ready.then(() => {
        writer.write(inputText);
        writer.close();
      });
      var finalText = "";
      var errorText = "";
      process.onStdout((result) => {
        finalText += result;
      })
      process.onStderr((result) => {
        errorText += result;
      })
      process.onDidExit((status) => {
        if (status == 0) {
          resolve(finalText);
        } else {
          reject(errorText)
        }
      });
      process.start();
    } catch (err) {
      reject(err);
    }
  })
}

function debug(value) {
  if (nova.inDevMode()) {
    console.log(`DEBUG: ${value}`);
  }
}

// Locate the Terraform binary in the following way:
// 1. If the binary is provided by the user configuration, use that.
// 2. Search the users PATH for the Terraform binary.  
// 3. If all else fails and the binary can't be found, error.
function findTerraformBinary() {
  // Otherwise, search for a valid terraform binary in $PATH
  var paths = nova.environment.PATH.split(":");
  for (let path of paths) {
    if (nova.fs.stat(`${path}/terraform`)) {
      if (helpers.isExecutableFile(`${path}/terraform`)) {
        return `${path}/terraform`;
      }
    }
  }
  throw new Error("Cannot find Terraform binary.  Please ensure the Terraform binary exists on your PATH environment variable.");
}