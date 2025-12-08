function toastMessage(text, success = true) {
  // Get the snackbar DIV
  var x = document.getElementById("snackbar");

  x.textContent = text;
  // Add the "show" class to DIV
  x.className = success ? "showSuccess" : "showError";

  // After 3 seconds, remove the show class from DIV
  setTimeout(function(){ x.className = x.className.replace(success ? "showSuccess" : "showError", ""); }, 3999);
}