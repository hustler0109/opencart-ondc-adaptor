// /middlewares/cancelMiddleware.js

import { verifyOndcSignature } from "../utils/ondcUtils.js";

const processCancelRequest = async (req, res, next) => {
    const { context, message } = req.body;

    if (!context || !message || !message.order_id || !message.cancellation_reason_id) {
        console.error("Validation Error: Missing required fields in /cancel request.");
        return res.status(400).json({
            message: { ack: { status: "NACK" } },
            error: {
                code: "40002",
                message: "Invalid cancel payload. 'context', 'message', 'order_id', and 'cancellation_reason_id' are required."
            }
        });
    }

    const isSignatureValid = await verifyOndcSignature(req);
    if (!isSignatureValid) {
        console.error("Security Error: Invalid ONDC signature for /cancel request.");
        return res.status(401).json({
            message: { ack: { status: "NACK" } },
            error: {
                type: "SECURITY_ERROR",
                code: "30010",
                message: "Authentication failed: Invalid signature"
            }
        });
    }

    next();
};

export default processCancelRequest;
