// Run this in the browser console on hopline.hu
// Logs in and reloads the page
fetch("/shop_logincheck.php", {
  body: "file_back=%2F&login_redir=&shop_user_login=kogerr%40hotmail.com&shop_pass_login=Tunde1995",
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" }
}).then(() => location.reload());
