const express = require("express");
const onUpdateMiddleware = require("../middleware/onUpdateMiddleware");
const logger = require("../utils/logger");

const router = express.Router();

// POST /on_update
router.post("/", onUpdateMiddleware, async (req, res) => {
    const transactionId = req.body?.context?.transaction_id;
    const messageId = req.body?.context?.message_id;
    const snpId = req.verified_snp_id;

    try {
        // Example: Log the payload and SNP identity
        logger.info({
            message: "Processing /on_update payload",
            snpId,
            transactionId,
            messageId,
            payload: req.body,
        });

        // TODO: Implement your domain-specific business logic here.
        // This could include updating order status, notifying downstream systems, etc.

        res.status(200).json({
            message: "on_update processed successfully",
        });
    } catch (error) {
        logger.error({
            message: "Error processing /on_update",
            error: error.message,
            stack: error.stack,
            transactionId,
            messageId,
        });
        res.status(500).json({
            error: "Failed to process /on_update",
        });
    }
});

module.exports = router;
