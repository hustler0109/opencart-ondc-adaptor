// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";
import multer from "multer";
import FormData from "form-data";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import {
  createKeyPair,
  createAuthorizationHeader,
  verifyMessage,
  createSigningString,
} from "./utils/cryptoUtils.js";

import apiHandler from "./handlers/apihandler.js";  
import onselectRoutes from "./routes/on_select.js";
import oninitRoutes from "./routes/on_init.js";
import onsearchRoutes from "./routes/on_search.js";
import searchRoutes from "./routes/search.js";
import selectRoutes from "./routes/select.js";
import initRoutes from "./routes/init.js";
import onIncrementalSearchRoutes from "./routes/on_incremental_search.js";
import incrementalSearchRoutes from "./routes/incremental_search.js";
import { confirmRouter } from './routes/confirm.js';
import { onConfirmRouter } from './routes/on_confirm.js';
// import { cancelRouter } from './routes/cancel.js';
// import { onCancelRouter } from './routes/on_cancel.js';
import { OrderStatus } from './constants.js';
import { onUpdateRouter } from './routes/on_update.js';
import { onCancelRouter } from './routes/on_cancel.js';
import { updateRouter } from "./routes/update.js";
import { cancelRouter } from "./routes/cancel.js";

import {
  addBapOrder,
  getBapOrder,
  resetBapOrder,       
  bapOrders
} from './services/on_confirm_service.js';

dotenv.config();


const stagingDetails = {
  subscriber_id: process.env.SUBSCRIBER_ID || "",
  ukId: process.env.UNIQUE_KEY_ID || "2",
  signing_public_key: process.env.ONDC_SIGNING_PUBLIC_KEY || "",
  encr_public_key: process.env.ONDC_ENCRYPTION_PRIVATE_KEY || "",
};


//const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

const upload = multer();
app.use(upload.any());

const privateKey = process.env.PRIVATE_KEY;
const publicKey = stagingDetails.signing_public_key;

app.get("/", (req, res) => {
  res.send("ONDC Signing Server is running!");
});

// Apply the API middleware globally for all /api routes
app.use("/api", apiHandler);

// Mount individual routes under /api
app.use("/api", onselectRoutes);
app.use("/api", oninitRoutes);
app.use("/api", onsearchRoutes);
app.use("/api", searchRoutes);
app.use("/api", selectRoutes);
app.use("/api", initRoutes);
app.use("/api", incrementalSearchRoutes);
app.use("/api", onIncrementalSearchRoutes);
app.use("/api", updateRouter);
app.use("/api", cancelRouter);
app.use("/api", confirmRouter);
app.use("/api", onConfirmRouter);
app.use("/api", onUpdateRouter);
app.use("/api", onCancelRouter);


//OPENCART LOGIN
app.post("/login", async (req, res) => {
  try {
    const { username = "Default", key } = req.body;

    if (!key) {
      return res.status(400).json({ error: "API key is required" });
    }

    const formData = new FormData();
    formData.append("username", username);
    formData.append("key", key);
    console.log(formData)

    const response = await axios.post(
      `${process.env.OPENCART_SITE}/index.php?route=api/login`,
      formData
    );

    const success = response.data.success;
    const apiToken = response.data.api_token;
    console.log("first response data", response.data);

    if (!apiToken) {
      return res.status(401).json({ error: "Invalid credentials or API key" });
    }

    // Store the api_token in a cookie
    //   res.cookie("api_token", apiToken, {
    //     httpOnly: true,
    //     secure: process.env.NODE_ENV === "production",
    //     sameSite: 'strict', // Or 'lax' if needed, but 'strict' is preferred
    //     maxAge: 24 * 60 * 60 * 1000,
    //     // domain: '.example.com'  // Only if using subdomains!
    // });
    // res.cookie('api_token','apiToken', { httpOnly: true, secure: true, maxAge: 3600000 })
    res.cookie("api_token", apiToken, { httpOnly: true, maxAge: 3600000 });
    const authCookie = req.cookies;
    console.log("first cookies", authCookie);

    // Respond with the api_token
    return res.json({ message: success, api_token: apiToken });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "An error occurred while processing the login" });
  }
});

app.post("/cookie", async (req, res) => {
  try {
    const authCookie = req.cookies;
    console.log("first cookies", authCookie);

    // Respond with the api_token
    return res.json({ message: "success", api_token: authCookie });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the cookiess" });
  }
});

app.get("/getCategoryWiseProducts", async (req, res) => {
  try {
    const api_token = req.cookies.api_token;
    console.log("first cookies", api_token);

    if (!api_token) {
      return res.status(400).json({ error: "API token is required" });
    }
    const { categoryName } = req.body;

    const formData = new FormData();
    formData.append("category", categoryName);

    const response = await axios.get(
      `${process.env.OPENCART_SITE}/index.php?route=api/allproducts/categories&json`,
      formData
    );

    console.log("first category name", categoryName);
    const categories = response.data;
    // console.log('response.data');
    // console.log(categories);
    console.log("dtype:", typeof categories);
    console.log("\n\n\n");

    if (!Array.isArray(categories)) {
      return res
        .status(500)
        .json({ error: "Invalid response format from API" });
    }

    // Find the category by name
    const foundCategory = categories.find(
      (cat) => cat.name.toLowerCase() === categoryName.toLowerCase()
    );

    if (!foundCategory) {
      return res
        .status(404)
        .json({ error: `Category "${categoryName}" not found` });
    }

    const categoryId = foundCategory.category_id;
    console.log(`Category ID for "${categoryName}" is:`, categoryId);

    const products = await axios.get(
      `${process.env.OPENCART_SITE}/index.php?route=api/allproducts/categoryList&json&path=${categoryId}`
    );

    console.log("products: \n ", products.data);

    // res.json({ category_id: categoryId, message: "Category ID found" });
    res.json({ products: products, message: "Category ID found" });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching products" });
  }
});

//select

app.post("/ondc/select", async (req, res) => {
  try {
    const payload = req.body;

    const bapId = payload.context?.bap_id || "default-buyer.com";
    const bapUri = payload.context?.bap_uri || "https://default-buyer.com/ondc";
    const bppId = payload.context?.bpp_id || "default-seller.com";
    const bppUri =
      payload.context?.bpp_uri || "https://default-seller.com/ondc";
    const city = payload.context?.city || "std:080";
    const country = payload.context?.country || "IND";
    const ttl = payload.context?.ttl || "PT30S";
    const transactionId = uuidv4();
    const messageId = Date.now().toString();

    const gps =
      payload.message?.order?.fulfillments?.[0]?.end?.location?.gps ||
      "12.4535445,77.9283792";
    const area_code =
      payload.message?.order?.fulfillments?.[0]?.end?.location?.address
        ?.area_code || "560001";

    const response = {
      context: {
        domain: "nic2004:52110",
        action: "select",
        core_version: "1.1.0",
        bap_id: bapId,
        bap_uri: bapUri,
        bpp_id: bppId,
        bpp_uri: bppUri,
        transaction_id: transactionId,
        message_id: messageId,
        city: city,
        country: country,
        timestamp: new Date().toISOString(),
        ttl: ttl,
      },
      message: {
        order: {
          provider: {
            id: "P1",
            locations: [{ id: "L1" }],
          },
          items: [
            {
              id: "I1",
              location_id: "L1",
              quantity: { count: 1 },
            },
          ],
          fulfillments: [
            {
              end: {
                location: {
                  gps: gps,
                  address: {
                    area_code: area_code,
                  },
                },
              },
            },
          ],
          payment: {
            type: "ON-FULFILLMENT",
          },
          tags: [
            {
              code: "buyer_id",
              list: [
                { code: "buyer_id_code", value: "gst" },
                { code: "buyer_id_no", value: "xxxxxxxxxxxxxxx" },
              ],
            },
          ],
        },
      },
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while processing /select" });
  }
});

app.post("/ondc/cart", async (req, res) => {
  try {
    const { context, message } = req.body;
    const selectedItems = message.order.items;

    if (!selectedItems || selectedItems.length === 0) {
      return res.status(400).json({ error: "No items selected" });
    }

    // Assuming you want to add ALL selected items to the cart
    const opencartCartAddPromises = selectedItems.map(async (item) => {
      const opencartProductId = item.id; // Assuming item.id is the OpenCart product ID
      const quantity = item.quantity.count;

      if (!opencartProductId || !quantity || quantity <= 0) {
        return { error: `Invalid product or quantity for item: ${item.id}` }; // Return error for individual item
      }

      try {
        const opencartResponse = await axios.post(
          `${process.env.OPENCART_SITE}/index.php?route=api/cart/add&api_id=0002a312d4f4776b937c8652db`, // Use session for api_id
          new URLSearchParams({
            // Use URLSearchParams for form-data
            product_id: opencartProductId,
            quantity: quantity,
          }),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded", // Important!
            },
          }
        );

        if (opencartResponse.data.error) {
          return { error: opencartResponse.data.error }; // Return OpenCart error
        }

        return opencartResponse.data; // Return success data
      } catch (error) {
        console.error("Error adding to cart:", error);
        return { error: "Error adding to cart" }; // Return a general error
      }
    });

    const opencartCartAddResults = await Promise.all(opencartCartAddPromises);

    // Check for any errors during cart add operations
    const cartAddErrors = opencartCartAddResults.filter(
      (result) => result.error
    );

    if (cartAddErrors.length > 0) {
      return res.status(500).json({
        error: "Some items could not be added to the cart",
        details: cartAddErrors, // Include details of the errors
      });
    }

    const ondcResponse = {
      context: {
        ...context,
        action: "on_select",
        timestamp: new Date().toISOString(),
        message_id: "unique-message-id", // Generate a unique message ID
      },
      message: {
        order: {
          items: selectedItems.map((item) => ({
            ...item, // Include the original item data
            fulfillment_id: "F1", // Example fulfillment ID
          })),
        },
      },
    };

    res.json(ondcResponse);
  } catch (error) {
    console.error("Error in /ondc/on_select:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});
//confirm starts here

const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const confirmHandler = require('./handlers/confirm'); // adjust the path as needed

//const app = express();
//const PORT = process.env.PORT || 3000;

// Middleware
app.use(morgan('dev')); // Logs HTTP requests
app.use(bodyParser.json({ limit: '10mb' })); // Parse JSON body
app.use(bodyParser.urlencoded({ extended: true }));

// Confirm API Route
app.post('/confirm', confirmHandler);

// Health check route
app.get('/', (req, res) => {
  res.status(200).send(' Confirm API server is up and running!');
});

// Start server
app.listen(PORT, () => {
  console.log(` Server listening on port ${PORT}`);
});



//on_confirm starts here 


const express = require('express');
const onConfirmRoute = require('./routes/onConfirmRoute');

app.use(express.json());
app.use('/ondc', onConfirmRoute); // Final URL: POST /ondc/on_confirm

module.exports = app;



//on_confirm ends here 

//update starts here

const express = require("express");
const app = express();

const updateRoute = require("./routes/update");

app.use(express.json()); // Ensure body parser is used
app.use("/ondc", updateRoute); // Example base path

//const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

//update ends here 


//on_update starts here

const express = require("express");
const onUpdateRouter = require("./routes/onUpdateRouter");

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBodyBuffer = buf;
    }
}));

app.use("/on_update", onUpdateRouter);

//on_update ends here 

//cancel starts here

dotenv.config();


app.use(express.json());

app.use('/api', cancelRouter);
app.use('/api', onCancelRouter);

app.get('/', (req, res) => {
  res.status(200).send('ONDC Integration Server is running.');
});

app.use((req, res, next) => {
  res.status(404).json({
    error: {
      code: '404',
      message: 'Not Found: The requested resource does not exist.'
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack || err);
  res.status(err.status || 500).json({
    error: {
      code: String(err.status || 500),
      message: err.message || 'Internal Server Error'
    }
  });
});

//const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (!process.env.OPENCART_API_URL || !process.env.OPENCART_API_KEY) {
    console.warn('Warning: OPENCART_API_URL or OPENCART_API_KEY environment variables are not set. OpenCart API calls may fail.');
  }
});


// cancel ends here

//on_cancel starts here

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[BAP HTTP] ${req.method} ${req.originalUrl} - Status: ${res.statusCode}, Duration: ${duration}ms`);
  });
  next();
});

// app.use("/", onConfirmRouter);
// app.use("/", onCancelRouter);

app.get("/bap/health", (req, res) => {
 res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error("[BAP Unhandled Error]", err);
  res.status(err.status || 500).json({
      message: { ack: { status: "NACK" } },
      error: {
          type: "CORE-ERROR",
          code: "50000",
          message: err.message || "An unexpected internal BAP server error occurred."
      }
  });
});

//status starts here

const statusRoute = require('./routes/statusRoute');
app.use("/ondc", statusRoute); 

//status ends here


// //const PORT = process.env.BAP_PORT || 5001;
// app.listen(PORT, () => {
// console.log(`BAP Buyer server listening on port ${PORT}`);
// console.log(`BAP_ID: ${process.env.BAP_ID}`);
// console.log(`BAP_URI: ${process.env.BAP_URI}`);
//  if (!process.env.BAP_ID || !process.env.BAP_URI) {
//      console.warn("Warning: BAP_ID or BAP_URI environment variables are not set!");
//  }
// });
//on_cancel ends here
import { signRequest } from "./auth/signatureGenerator.js";
//ONDC ENDPOINTS
app.get("/generate-keys", async (req, res) => {
  const keys = await createKeyPair();
  res.json(keys);
});

app.post("/sign", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required" });

  if (!privateKey)
    return res.status(500).json({ error: "Private key not configured" });

  console.log("Message to be Signed:", message);
  const header = await createAuthorizationHeader(message, privateKey);
  res.json({ authorization: header });
  try {
    const { signature, digest, authHeader } = signRequest(req.body);
    res.json({ signature, digest, authHeader });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.post("/verify", async (req, res) => {
  const { signedString, message } = req.body;
  if (!signedString || !message)
    return res.status(400).json({ error: "Invalid request" });

  console.log("Signed String for Verification:", signedString);
  console.log("Message for Verification:", message);

  const { signingString } = await createSigningString(message);
  const isValid = await verifyMessage(signedString, signingString, publicKey);

  res.json({ valid: isValid });
});

//The /lookup endpoint to call the ONDC registry
app.post("/lookup", async (req, res) => {
  const { subscriber_id, domain, ukId, country, city, type } = req.body;

  console.log("first");
  console.log("subscriber_id", subscriber_id);
  console.log("domain", domain);
  console.log("ukId", ukId);
  console.log("country", country);
  console.log("city", city);
  console.log("type", type);

  // Ensuring all required fields are provided
  if (!subscriber_id || !domain || !ukId || !country || !city || !type) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // Calling ONDC registry using Axios
    const response = await axios.post(
      "https://staging.registry.ondc.org/lookup",
      {
        subscriber_id,
        domain,
        ukId,
        country,
        city,
        type,
      }
    );

    // Forwarding the response from the ONDC registry to the client
    res.json(response.data);
  } catch (error) {
    console.error("Error calling ONDC registry:", error.message);
    res.status(500).json({ error: "Error calling ONDC registry" });
  }
});

// The /vlookup endpoint to call the ONDC registry
app.post("/vlookup", async (req, res) => {
  const {
    sender_subscriber_id,
    request_id,
    timestamp,
    signature,
    search_parameters,
    country,
    domain,
  } = req.body;

  // Validate required fields
  if (
    !sender_subscriber_id ||
    !request_id ||
    !timestamp ||
    !signature ||
    !search_parameters ||
    !country ||
    !domain
  ) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // Prepare data for the ONDC registry lookup request
    const payload = {
      sender_subscriber_id,
      request_id,
      timestamp,
      signature,
      search_parameters,
      country,
      domain,
    };

    // Call the ONDC registry vlookup endpoint using Axios
    const response = await axios.post(
      "https://staging.registry.ondc.org/vlookup",
      payload
    );

    // Forward the response from the ONDC registry to the client
    res.json(response.data);
  } catch (error) {
    console.error("Error calling ONDC registry:", error.message);
    res.status(500).json({ error: "Error calling ONDC registry" });
  }
});
app.post("/test/add-order", (req, res) => {
  const { orderId, context, orderDetails } = req.body;

  if (!orderId || !context || !orderDetails) {
    return res.status(400).json({
      message: { ack: { status: "NACK" } },
      error: {
        type: "JSON-SCHEMA-ERROR",
        code: "40001",
        message: "Missing required fields: orderId, context, or orderDetails"
      }
    });
  }

  addBapOrder(orderId, context, orderDetails);
  // res.status(200).json({ message: "Order added to BAP memory" });
  res.status(200).json({ message: `Order ${orderId} stored in BAP memory` });

});
app.post("/test/reset-order", (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "Missing orderId" });
  }

  if (!bapOrders[orderId]) {
    return res.status(404).json({ error: `Order ID ${orderId} not found` });
  }

  resetBapOrder(orderId);
  res.status(200).json({ message: `Order ${orderId} reset from memory` });
});

// ONDC route for on_confirm

app.get("/health", (req, res) => {
   res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});
app.get("/bap/health", (req, res) => {
  res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
 });
 
app.use((err, req, res, next) => {
    console.error("[Unhandled Error]", err);
    res.status(err.status || 500).json({
        message: { ack: { status: "NACK" } },
        error: {
            type: "CORE-ERROR",
            code: "50000",
            message: err.message || "An unexpected internal server error occurred."
        }
    });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`)
//   logger.info(`Server running on port ${PORT}`);
//   logger.info(`ONDC Connector initialized with endpoints:`);
//   logger.info(`- /ondc/on_select`);
// });
