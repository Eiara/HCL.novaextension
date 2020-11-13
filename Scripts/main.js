var onWillSaveHandler = null;
exports.activate = function() {
	var formatterBinPath = null;
	try {
		formatterBinPath = findTerraformBinary();
	} catch (err) {
		let request = new NotificationRequest("terraform-not-found");
		request.title = nova.localize("Terraform Not Found");
		request.body = nova.localize(err.message);
		nova.notifications.add(request);
	}
	
	// This was originally written such that terraform fmt overwrote the file contents directly but
	// Nova had a several second delay before updating the UI.  To get around this, the fmt command
	// outputs to stdout, read into a temporary string and upon process exit a replace edit operation 
	// overwrites the existing file with the new contents.
	onWillSaveHandler = nova.workspace.activeTextEditor.onWillSave((editor) => {
		var options = {
			args: ["fmt", "-write=false", "-list=false", editor.document.path]
		};

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
	});
}

exports.deactivate = function() {
	if (onWillSaveHandler !== null) {
		onWillSaveHandler.dispose();
	}
	// Clean up state before the extension is deactivated
}

// Search the users PATH for the Terraform binary.  If it can't be found, error.
function findTerraformBinary() {
	var paths = nova.environment.PATH.split(":");
	for (let path of paths) {
		if (nova.fs.stat(`${path}/terraform`)){
			return `${path}/terraform`;
		}
	}
	throw new Error("Cannot find Terraform binary.  Please ensure the Terraform binary exists on your PATH environment variable.");
}