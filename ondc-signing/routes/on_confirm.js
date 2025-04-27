import express from 'express';
const onConfirmRouter = express.Router();

import onConfirmHandler from '../handlers/onconfirmHandler.js';
import authenticateSnpRequest, { validateOnConfirmSchema } from '../middlewares/onconfirmMiddleware.js'; // Importing both

// Corrected line
onConfirmRouter.post('/on_confirm', authenticateSnpRequest, validateOnConfirmSchema, onConfirmHandler);

export default onConfirmRouter;
