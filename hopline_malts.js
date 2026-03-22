// category: malatak, komlok, elesztok
const category = process.argv[2];
if (!category) { console.error("Usage: node hopline_malts.js <category>"); process.exit(1); }

fetch(`https://www.hopline.hu/alapanyagok/${category}?action=cat_art_list&ajax=1&prefix=false&infinite_page=100&filter=product_status%3Ain_stock&source_is_cat_page=1&page=1&cat_art_list_filter_loaded=0`)
  .then((res) => res.json())
  .then((data) => {
    const html = data.product_list_content;
    const regex = /data-sku="(\d+(?:-cs)?)".*?product__name[^"]*"[^>]*>([^<]+)/gs;
    const products = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      const name = match[2].trim().replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      if (name) products.push({ id: match[1], name });
    }
    console.log(JSON.stringify(products, null, 2));
  })
  .catch(console.error);
