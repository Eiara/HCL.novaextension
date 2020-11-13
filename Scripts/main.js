var onWillSaveHandler = null;
var commandRegister = null;
var configChangeObserver = null;
var configChangeObserverPath = null;
var formatterBinPath = null;

function setTerraformBinPath() {
	try {
		formatterBinPath = findTerraformBinary();
	} catch (err) {
		let request = new NotificationRequest("terraform-not-found");
		request.title = nova.localize("Terraform Not Found");
		request.body = nova.localize(err.message);
		nova.notifications.add(request);
		formatterBinPath = null;
	}
}

exports.activate = function() {
	setTerraformBinPath();

	commandRegister = nova.commands.register("hcl.terraform-format", (editor) =>{
		format(editor);
	});
	
	if (nova.config.get("hcl.terraform-format-on-save")) {
		onWillSaveHandler = configureFormatOnSave();
	}
	
	configChangeObserver = nova.config.observe("hcl.terraform-format-on-save", (newVal, oldVal) => {
		if (newVal && !oldVal) {
			onWillSaveHandler = configureFormatOnSave();
		}
		
		if (!newVal && oldVal && onWillSaveHandler !== null) {
			onWillSaveHandler.dispose();
		}
	});
	
	configChangeObserverPath = nova.config.observe("hcl.terraform-binary", (newVal, oldVal) => {
		let request = new NotificationRequest("terraform-path-changed");
		request.title = nova.localize("Terraform Path Changed");
		request.body = "Using system default for Terraform binary path."
		if (newVal != "") {
			request.body = nova.localize(`Terraform binary path updated to ${newVal} in config.  Validating binary exists...`);
		}
		nova.notifications.add(request);
		setTerraformBinPath();
	});
}

exports.deactivate = function() {
	if (onWillSaveHandler !== null) {
		onWillSaveHandler.dispose();
	}
	if (commandRegister !== null) {
		commandRegister.dispose();
	}
	if (configChangeObserver !== null) {
		configChangeObserver.dispose();
	}
	if (configChangeObserverPath !== null) {
		configChangeObserverPath.dispose();
	}
}

// Locate the Terraform binary in the following way:
// 1. If the binary is provided by the user configuration, use that.
// 2. Search the users PATH for the Terraform binary.  
// 3. If all else fails and the binary can't be found, error.
function findTerraformBinary() {
	var pathFromConfig = nova.config.get("hcl.terraform-binary");
	if (pathFromConfig != "") {
		if (!nova.fs.stat(pathFromConfig)) {
			throw new Error(`Cannot find Terraform binary at ${pathFromConfig}.  Please ensure the Terraform binary exists on your PATH environment variable.`);
		}
		return pathFromConfig;
	}
	var paths = nova.environment.PATH.split(":");
	for (let path of paths) {
		if (nova.fs.stat(`${path}/terraform`)){
			return `${path}/terraform`;
		}
	}
	throw new Error("Cannot find Terraform binary.  Please ensure the Terraform binary exists on your PATH environment variable.");
}

// This was originally written such that terraform fmt overwrote the file contents directly but
// Nova had a several second delay before updating the UI.  To get around this, the fmt command
// outputs to stdout, read into a temporary string and upon process exit a replace edit operation 
// overwrites the existing file with the new contents.
function format(editor) {
	var options = {
		args: ["fmt", "-write=false", "-list=false", editor.document.path]
	};

	if (formatterBinPath == null) {
		let request = new NotificationRequest("terraform-not-found");
		request.title = nova.localize("Terraform Not Found");
		request.body = nova.localize("Cannot find Terraform binary.  Please ensure the Terraform binary exists on your PATH environment variable.");
		nova.notifications.add(request);
		return;
	}
	var process = new Process(formatterBinPath, options);
	process.start();
	var finalText = "";
	process.onStdout((result) => {
		finalText += result;

	})
	process.onDidExit(() => {
		editor.edit((edit) => {
			edit.replace(new Range(0,editor.document.length),finalText);
		});
	});
}

function configureFormatOnSave() {
	return nova.workspace.activeTextEditor.onWillSave((editor) => {
		format(editor, formatterBinPath);
	});
}