fetch("https://www.hopline.hu/shop_logincheck.php", {
  "body": "file_back=%2F&login_redir=&shop_user_login=kogerr%40hotmail.com&shop_pass_login=Tunde1995",
  "method": "POST",
  "headers": { "Content-Type": "application/x-www-form-urlencoded" },
  "redirect": "manual"
}).then((response) => {
  const cookies = response.headers.getSetCookie();
  console.log(JSON.stringify({
    status: response.status,
    location: response.headers.get("location"),
    cookies
  }, null, 2));
}).catch(console.error);
