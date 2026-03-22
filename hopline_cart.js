const sku = process.argv[2];
const qty = process.argv[3] || "1";
const cookie = process.argv[4];
if (!sku || !cookie) {
    console.error("Usage: node hopline_cart.js <sku> <qty> <cookie>");
    process.exit(1);
}

fetch("https://www.hopline.hu/shop_ajax/ajax_cart.php", {
  "headers": {
    "cookie": cookie
  },
  body: `get_ajax=1&result_type=json&lang_master=hu&action=add&sku=${sku}&qty=${qty}&variant_name1=Roppant%C3%A1s&variant_list1=Roppantva&product_param=&item_random_number=3455&is_last_package_offer=false`,
  method: "POST"
}).then((response) => response.text()).then(console.log).catch(console.error);
