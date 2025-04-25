import axios from "axios";

export default async function selectHandler(req, res) {
    console.log("select handler executed");

    // Perform the necessary processing here
    const responseData = {
        "context":{
           "domain":"ONDC:RET10",
           "action":"search",
           "country":"IND",
           "city":"std:011",
           "core_version":"1.2.0",
           "bap_id":"buyer-app-preprod-v2.ondc.org",
           "bap_uri":"https://buyer-app-preprod-v2.ondc.org/protocol/v1",
           "transaction_id":"e9e02ef8-2987-4cf0-b115-4d5b44fb78ac",
           "message_id":"adfec2a0-6c19-449e-bdcd-e9df6308040f",
           "timestamp":"2024-01-12T11:40:01.960Z",
           "ttl":"PT30S"
        },
        "message":{
           "intent":{
              "fulfillment":{
                 "type":"Delivery"
              },
              "payment":{
                 "@ondc/org/buyer_app_finder_fee_type":"percent",
                 "@ondc/org/buyer_app_finder_fee_amount":"3"
              }
           }
        }
     };

     try {
      const { context } = req.body;
      const isValidRequest = req.isValidRequest;
      console.log('isValidRequest',isValidRequest);
  
      // 1. Basic request body validation (example)
      if (!isValidRequest) {
        // ❌ Case 1: Request failed middleware validation
        console.warn("NACK: Request failed middleware validation");
        return res.status(200).json({
          response: {
            context: {
              ...context,
              action: "on_select",
              bpp_id: context?.bpp_id,
              bpp_uri: context?.bpp_uri,
            },
            message: {
              ack: {
                status: "NACK",
              },
            },
            error: {
              type: "AUTH_ERROR",
              code: "10002",
              message: "Authentication failed or missing OpenCart API token/environment variables.",
            },
          },
        });
      } else if (
        !context ||
        !context.transaction_id ||
        !context.message_id ||
        !context.bap_id ||
        !context.bap_uri
      ) {
        console.log("NACK: Missing mandatory context parameters");
        return res.status(200).json({
          response: {
            context: {
              ...context,
              action: "on_select",
              bpp_id: req.body?.context?.bpp_id,
              bpp_uri: req.body?.context?.bpp_uri,
            },
            message: {
              ack: {
                status: "NACK",
              },
            },
            error: {
              type: "REQUEST_ERROR",
              code: "10001",
              message:
                "Missing mandatory parameters in the /search request context.",
            },
          },
        });
      }
  
      // 2. Add more validation checks as needed
  
      // If all initial checks pass, send an ACK
      if (isValidRequest) {
      console.log("ACK: Request seems valid, proceeding to handler");
      res.status(200).json({
        // res.write({
        response: {
          context: {
            ...context,
            action: "on_select",
            bpp_id: req.body?.context?.bpp_id,
            bpp_uri: req.body?.context?.bpp_uri,
          },
          message: {
            ack: {
              status: "ACK",
            },
          },
        },
      });
    }
  
      const ondcRequest = req.body;
      console.log(
        "\n\n\n request body ",
        ondcRequest,
        "-------------------------"
      );
      await axios.post(
        `${process.env.ADAPTOR_SITE}/on_select`,
        ondcRequest
      );
      
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ error: "An error occurred while processing the request" });
    }
}
