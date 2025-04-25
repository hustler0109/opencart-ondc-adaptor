const express = require('express');
const router = express.Router();

const onConfirmHandler = require('../handlers/onConfirmHandler');
const authenticateSnpRequest = require('../middleware/authenticateSnpRequest'); // Signature verification middleware
const validateOnConfirmSchema = require('../middleware/onConfirmMiddleware');   // JSON schema + semantic validator

router.post('/on_confirm', authenticateSnpRequest, validateOnConfirmSchema, onConfirmHandler);

module.exports = router;
