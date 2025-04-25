import axios from "axios";

export default async function onSearchHandler(req, res) {
    console.log("onSearch handler executed");
    try {
        const payload = req.body;
    
        const opencartApiUrl =
          "http://127.0.0.1/opencart-3/index.php?route=api/allproducts&json";
        const response = await axios.get(opencartApiUrl);
        const opencartProducts = response.data.shop_products;
    
        const opencartApiStoreInfo =
          "http://localhost/opencart-3/index.php?route=api/allproducts/contact";
        const store = await axios.get(opencartApiStoreInfo);
        const storeInfo = store.data;
    
        const opencartApiCategories =
          "http://localhost/opencart-3/index.php?route=api/allproducts/categories&json";
        const categories = await axios.get(opencartApiCategories);
        const categoriesInfo = categories.data;
    
        if (!opencartProducts || opencartProducts.length === 0) {
          return res.status(404).json({ error: "No products found" });
        }
        if (!categoriesInfo || categoriesInfo.length === 0) {
          return res.status(404).json({ error: "No categories found" });
        }
        if (!storeInfo || storeInfo.length === 0) {
          return res.status(404).json({ error: "No store info found" });
        }
    
        const ondcCatalog = {
          context: {
            domain: payload.context.domain,
            country: payload.context.country,
            city: payload.context.city,
            action: payload.context.action,
            core_version: payload.context.core_version,
            bap_id: payload.context.bap_id,
            bap_uri: payload.context.bap_uri,
            bpp_id: payload.context.bpp_id,
            bpp_uri: payload.context.bpp_uri,
            transaction_id: payload.context.transaction_id,
            message_id: payload.context.message_id,
            timestamp: payload.context.timestamp,
            ttl: payload.context.ttl,
          },
          message: {
            "bpp/fulfillments": [
              {
                id: "F1",
                type: "Delivery",
              },
            ],
            "bpp/descriptor": {
              name: "Opencart Store",
              symbol: storeInfo.image,
              short_desc: "Online eCommerce Store",
              long_desc: "Online eCommerce Store",
              images: [
                "https://img.crofarm.com/images/product-feed-banners/f6f5e323302a.png",
              ],
              tags: [
                {
                  code: "bpp_terms",
                  list: [
                    {
                      code: "np_type",
                      value: "ISN",
                    },
                  ],
                },
              ],
            },
            "bpp/providers": [
              {
                id: "4410",
                time: {
                  label: "enable",
                  timestamp: new Date().toISOString(),
                },
                fulfillments: [
                  {
                    id: "F1",
                    type: "Delivery",
                    contact: {
                      phone: storeInfo.telephone,
                      email: "abc@xyz.com",
                    },
                  },
                ],
                descriptor: {
                  name: storeInfo.store,
                  symbol: storeInfo.image,
                  short_desc: storeInfo.comment || "Opencart store",
                  long_desc: "Opencart store_",
                  images: [
                    "https://img.crofarm.com/images/product-feed-banners/f6f5e323302a.png",
                  ],
                },
                ttl: "PT24H",
                locations: [
                  {
                    id: "L1",
                    gps: "28.5500962,77.2443268",
                    address: {
                      locality: storeInfo.address,
                      street: storeInfo.address,
                      city: "Delhi",
                      area_code: storeInfo.geocode,
                      state: "DL",
                    },
                    circle: {
                      gps: "28.5500962,77.2443268",
                      radius: {
                        unit: "km",
                        value: "3",
                      },
                    },
                    time: {
                      label: "enable",
                      timestamp: new Date().toISOString(),
                      days: "1,2,3,4,5,6,7",
                      schedule: {
                        holidays: [],
                      },
                      range: {
                        start: "0000",
                        end: "2359",
                      },
                    },
                  },
                ],
                categories: [], // Initialize categories array here
                items: [], // Initialize items array here
              },
            ],
          },
        };
    
        // Map opencart categories and items *directly* into the provider
    
        categoriesInfo.forEach((category) => {
          ondcCatalog.message["bpp/providers"][0].categories.push({
            id: category.category_id,
            descriptor: {
              name: category.name,
            },
            tags: [
              {
                code: "type",
                list: [
                  {
                    code: "type",
                    value: "variant_group",
                  },
                ],
              },
              {
                code: "attr",
                list: [
                  {
                    code: "name",
                    value: "item.quantity.unitized.measure",
                  },
                  {
                    code: "seq",
                    value: "1",
                  },
                ],
              },
            ],
          });
        });
    
        opencartProducts.forEach((product) => {
          const item = {
            id: product.product_id,
            time: {
              label: "enable",
              timestamp: "2024-01-12T11:41:25.969Z",
            },
            descriptor: {
              name: product.name,
              code: `5:${product.product_id}`,
              symbol: product.image,
              short_desc: product.name,
              long_desc: product.name,
              images: [product.image],
            },
            quantity: {
              unitized: {
                measure: {
                  unit: "unit",
                  value: "1",
                },
              },
              available: {
                count: product.quantity,
              },
              maximum: {
                count: "5",
              },
            },
            price: {
              currency: "INR",
              value: product.price,
              maximum_value: product.price,
            },
            category_id: "dummy_category", // You might want to map the actual category ID
            fulfillment_id: "F1",
            location_id: "L1",
            "@ondc/org/returnable": false,
            "@ondc/org/cancellable": true,
            "@ondc/org/seller_pickup_return": false,
            "@ondc/org/time_to_ship": "PT12H",
            "@ondc/org/available_on_cod": false,
            "@ondc/org/return_window": "P0D",
            "@ondc/org/contact_details_consumer_care":
              "Otipy, help@crofarm.com,18004254444",
            tags: [
              {
                code: "origin",
                list: [
                  {
                    code: "country",
                    value: "IND",
                  },
                ],
              },
              {
                code: "veg_nonveg",
                list: [
                  {
                    code: "veg",
                    value: "yes",
                  },
                ],
              },
            ],
          };
          ondcCatalog.message["bpp/providers"][0].items.push(item);
        });
    
        // res.json(ondcCatalog);
        const callbackUrl = req.body.context.bap_uri + "/on_search";
        console.log('callback url', callbackUrl);

        try {
            const callbackResponse = await axios.post(callbackUrl, ondcCatalog, {
                headers: { 'Content-Type': 'application/json' }
            });
            console.log("Successfully sent /on_search callback:", callbackResponse.status);
            console.log("/on_search callback message:", callbackResponse.data.message);
            // log the callback response status
        } catch (error) {
            console.error("Error sending /on_search callback:", error.message, error.response?.data);
            // Handle errors during the callback (e.g., logging, retries)
        }
    
        
        return; // Indicate that the handler has completed its asynchronous task
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "An error occurred" });
      }

};
