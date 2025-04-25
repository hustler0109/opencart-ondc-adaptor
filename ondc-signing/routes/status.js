const express = require("express");
const router = express.Router();

const { processStatusRequest } = require("../middleware/statusMiddleware"); // Middleware: schema + signature validation
const statusHandler = require("../handlers/statusHandler"); // Main business logic for /status

router.post("/status", processStatusRequest, statusHandler);

module.exports = router;
