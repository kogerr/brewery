const cikk = process.argv[2];
if (!cikk) { console.error("Usage: node hopline_details.js <cikk>"); process.exit(1); }

fetch(`https://www.hopline.hu/shop_artdet.php?ajax_tooltip=1&get_ajax=1&cikk=${cikk}`)
  .then((response) => response.text())
  .then((html) => {
    const match = html.match(/font-weight-normal">\(<span>(.+?)<\/span>\)/);
    if (match) {
      console.log(match[1]);
    } else {
      console.log("Stock info not found");
    }
  })
  .catch(console.error);
