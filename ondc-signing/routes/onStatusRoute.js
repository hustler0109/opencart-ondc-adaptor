const express = require("express");
const router = express.Router();
const { processOnStatusRequest } = require("../middleware/onStatusMiddleware");
const onStatusHandler = require("../handlers/onStatusHandler");

// Route for ONDC /on_status (BPP → BAP)
router.post("/on_status", processOnStatusRequest, onStatusHandler);

module.exports = router;
