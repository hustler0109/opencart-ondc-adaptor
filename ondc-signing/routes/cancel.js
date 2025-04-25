const express = require('express');

const cancelMiddleware = require('../middleware/cancelMiddleware.js');
const handleCancel = require('../handlers/cancelHandler.js');

const router = express.Router();

router.post('/cancel', cancelMiddleware, handleCancel);

// Corrected: Export router directly
module.exports = router;