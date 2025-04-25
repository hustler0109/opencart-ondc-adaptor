// import axios from "axios";
// import { signRequest } from "../auth/signatureGenerator.js";

// export default async function searchHandler(req, res) {
//   console.log("search handler executed");

//   try {
//     const { context } = req.body;
//     const isValidRequest = req.isValidRequest;
//     console.log('isValidRequest',isValidRequest);

//     // 1. Basic request body validation (example)
//     if (!isValidRequest) {
//       // Case 1: Request failed middleware validation
//       console.warn("NACK: Request failed middleware validation");
//       return res.status(200).json({
//         response: {
//           context: {
//             ...context,
//             action: "on_search",
//             bpp_id: context?.bpp_id,
//             bpp_uri: context?.bpp_uri,
//           },
//           message: {
//             ack: {
//               status: "NACK",
//             },
//           },
//           error: {
//             type: "AUTH_ERROR",
//             code: "10002",
//             message: "Authentication failed or missing OpenCart API token/environment variables.",
//           },
//         },
//       });
//     } else if (
//       !context ||
//       !context.transaction_id ||
//       !context.message_id ||
//       !context.bap_id ||
//       !context.bap_uri
//     ) {
//       console.log("NACK: Missing mandatory context parameters");
//       return res.status(200).json({
//         response: {
//           context: {
//             ...context,
//             action: "on_search",
//             bpp_id: req.body?.context?.bpp_id,
//             bpp_uri: req.body?.context?.bpp_uri,
//           },
//           message: {
//             ack: {
//               status: "NACK",
//             },
//           },
//           error: {
//             type: "REQUEST_ERROR",
//             code: "10001",
//             message:
//               "Missing mandatory parameters in the /search request context.",
//           },
//         },
//       });
//     }

//     // 2. Add more validation checks as needed

//     // If all initial checks pass, send an ACK
//     if (isValidRequest) {
//     console.log("ACK: Request seems valid, proceeding to handler");
//     res.status(200).json({
//       // res.write({
//       response: {
//         context: {
//           ...context,
//           action: "on_search",
//           bpp_id: req.body?.context?.bpp_id,
//           bpp_uri: req.body?.context?.bpp_uri,
//         },
//         message: {
//           ack: {
//             status: "ACK",
//           },
//         },
//       },
//     });
//   }

//     const ondcRequest = req.body;
//     console.log(
//       "\n\n\n request body ",
//       ondcRequest,
//       "-------------------------"
//     );
//     await axios.post(
//       `${process.env.ADAPTOR_SITE}/on_search`,
//       ondcRequest
//     );
    
//   } catch (error) {
//     console.error(error);
//     res
//       .status(500)
//       .json({ error: "An error occurred while processing the search request" });
//   }

//   const ondcRequest = req.body;

// const { signature, digest, authHeader } = signRequest(ondcRequest); // assumes function returns proper values

// await axios.post(
//   `${process.env.ADAPTOR_SITE}/on_search`, // This is the buyer app endpoint
//   ondcRequest,
//   {
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: authHeader,
//       Digest: digest,
//       Signature: signature,
//     },
//   }
// );

// }

import axios from "axios";
import { signRequest } from "../auth/signatureGenerator.js"; // Assuming this is where the signing logic is

export default async function searchHandler(req, res) {
  console.log("search handler executed");

  try {
    const { context } = req.body;
    const isValidRequest = req.isValidRequest;
    console.log('isValidRequest', isValidRequest);

    // 1. Basic request body validation (example)
    if (!isValidRequest) {
      // Case 1: Request failed middleware validation
      console.warn("NACK: Request failed middleware validation");
      return res.status(200).json({
        response: {
          context: {
            ...context,
            action: "on_search",
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
            action: "on_search",
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
        response: {
          context: {
            ...context,
            action: "on_search",
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

    // Prepare the ondcRequest to send to the buyer app
    const ondcRequest = req.body;

    console.log("\n\n\n request body ", ondcRequest, "-------------------------");

    // Sign the request (signature, digest, and auth header)
    const { signature, digest, authHeader } = signRequest(ondcRequest); // Assuming this function returns proper values

    // Send the signed request to the buyer app's /on_search endpoint
    await axios.post(
      `${process.env.ADAPTOR_SITE}/on_search`, // This is the buyer app endpoint
      ondcRequest,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader, // Include the signed authorization header
          Digest: digest, // Include the digest header
          Signature: signature, // Include the signature header
        },
      }
    );

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while processing the search request" });
  }
}
