exports.booleanEnum = function(value) {
  // Cast an enum to a boolean, or null
  switch (value) {
    case "enabled":
      return true
    case "disabled":
      return false
    default:
      return null
  }
}

exports.toTime = function (value) {
  return `${value}s`;
}

exports.isExecutableFile = function(path) {
  // does the path exist, and is it executable?
  var access = nova.fs.access(
    path, 
    nova.fs.constants.F_OK | nova.fs.constants.X_OK
  );
  var stat = nova.fs.stat(path);
  
  return stat && access;
}