const express = require("express");
const router = express.Router();

const updateMiddleware = require("../middleware/updateMiddleware");
const updateHandler = require("../handlers/updateHandler");

// POST /update route
router.post("/update", updateMiddleware, updateHandler);

module.exports = router;
