// /handlers/cancelHandler.js

import axios from "axios";

const processedMessages = new Set();

function mapReasonToStatus(reasonCode) {
    const statusMap = {
        "001": 7,
        "002": 7,
        "003": 7,
        "004": 7,
        "005": 7,
    };
    return statusMap[reasonCode] || 7;
}

async function updateOrderStatusInOpenCart(orderId, statusId, reasonCode, messageId) {
    console.log(`Background Task: Starting update for Order ID: ${orderId}, Message ID: ${messageId}`);

    if (processedMessages.has(messageId)) {
        console.warn(`Background Task: Message ${messageId} already processed. Skipping.`);
        return;
    }

    try {
        console.log(`Background Task: Calling OpenCart API for Order ID: ${orderId}, Status ID: ${statusId}`);
        const response = await axios.post("http://localhost/opencart/api/update-order-status", {
            order_id: orderId,
            order_status_id: statusId,
            comment: `ONDC Cancel Request. Reason: ${reasonCode}. Message ID: ${messageId}`
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENCART_API_KEY}`
            }
        });

        if (response.status === 200 && response.data && response.data.success) {
            console.log(`Background Task: Successfully updated OpenCart status for order ${orderId} (Message: ${messageId})`);
            processedMessages.add(messageId);
        } else {
            console.error(`Background Task: OpenCart API error for Order ID: ${orderId} (Message: ${messageId}). Status: ${response.status}, Data:`, response.data);
        }
    } catch (err) {
        console.error(`Background Task: Axios error calling OpenCart API for Order ID: ${orderId} (Message: ${messageId}):`, err.message);
        let errorDetails = err.message;
        if (err.response) {
            errorDetails = `Status: ${err.response.status}, Data: ${JSON.stringify(err.response.data)}`;
        } else if (err.request) {
            errorDetails = "No response received from OpenCart API";
        }
        console.error(`Background Task: Detailed Error: ${errorDetails}`);
    }
}

const handleCancel = async (req, res) => {
    const { context, message } = req.body;
    const { order_id, cancellation_reason_id } = message;
    const message_id = context.message_id;

    console.log(`Received /cancel request for order ${order_id}, reason: ${cancellation_reason_id}, messageId: ${message_id}`);

    res.status(200).json({ message: { ack: { status: "ACK" } } });

    const statusId = mapReasonToStatus(cancellation_reason_id);

    setTimeout(() => {
        updateOrderStatusInOpenCart(order_id, statusId, cancellation_reason_id, message_id)
            .catch(err => {
                console.error(`Background Task UNHANDLED error for messageId ${message_id}:`, err);
            });
    }, 0);

    console.log(`Cancellation task for order ${order_id} (messageId: ${message_id}) scheduled for background processing.`);
};

export default handleCancel;
