import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENCART_API_URL = process.env.OPENCART_API_URL;
const OPENCART_API_KEY = process.env.OPENCART_API_KEY;
const OPENCART_CANCELLED_STATUS_ID = process.env.OPENCART_CANCELLED_STATUS_ID || 7;

if (!OPENCART_API_URL || !OPENCART_API_KEY) {
  console.error("FATAL ERROR: OPENCART_API_URL or OPENCART_API_KEY environment variables are not set. /on_cancel handler cannot function.");
}

export async function handleOnCancel(req, res) {
  const { context, transactionId } = req;
  const { message, error } = req.body;

  console.log(`[${transactionId}] Received /on_cancel. Sending ACK.`);
  res.status(200).json({
    context: context,
    message: { ack: { status: "ACK" } },
  });

  setImmediate(async () => {
    try {
      if (error) {
        console.warn(`[${transactionId}] /on_cancel received with error payload:`, JSON.stringify(error));
        return;
      }

      if (message && message.order?.state === "CANCELLED") {
        const orderId = message.order?.id;

        if (!orderId) {
          console.error(`[${transactionId}] /on_cancel message received with state CANCELLED but missing order.id.`);
          return;
        }

        console.log(`[${transactionId}] Processing confirmed cancellation for Order ID: ${orderId}. Attempting OpenCart update.`);

        const openCartHistoryData = {
          order_id: orderId,
          order_status_id: OPENCART_CANCELLED_STATUS_ID,
          notify: true,
          comment: `Order cancellation confirmed via ONDC /on_cancel (Txn: ${transactionId})`,
        };

        try {
          const response = await axios.post(
            `${OPENCART_API_URL}/order/history`,
            openCartHistoryData,
            {
              headers: {
                "Content-Type": "application/json",
                "X-Oc-Restadmin-Id": OPENCART_API_KEY,
              },
              timeout: 10000,
            }
          );

          if (response.data && (response.data.success || response.status === 200)) {
             console.log(`[${transactionId}] Successfully updated OpenCart status to Cancelled for Order ID: ${orderId}.`);
          } else {
             console.warn(`[${transactionId}] OpenCart API call for Order ID: ${orderId} returned status ${response.status} but response data indicates potential issue:`, response.data);
          }

        } catch (apiError) {
          console.error(`[${transactionId}] FAILED to update OpenCart status for Order ID: ${orderId}. Error: ${apiError.message}`);
          if (apiError.response) {
            console.error(`[${transactionId}] OpenCart API Error Details: Status=${apiError.response.status}, Data=${JSON.stringify(apiError.response.data)}`);
          } else {
            console.error(`[${transactionId}] OpenCart API Request Error: ${apiError.message}`);
          }
        }

      } else if (message) {
        console.log(`[${transactionId}] /on_cancel received with message, but order state is not CANCELLED (State: ${message.order?.state}). No OpenCart update performed.`);
      } else {
         console.warn(`[${transactionId}] /on_cancel received without error or message payload after validation. This indicates an unexpected state.`);
      }
    } catch (processingError) {
      console.error(`[${transactionId}] Unexpected error during /on_cancel internal processing: ${processingError.message}`, processingError.stack);
    }
  });
}
