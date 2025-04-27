import express from 'express';
const updateRouter = express.Router(); // correctly named

import updateMiddleware from '../middlewares/updateMiddleware.js';
import updateHandler from '../handlers/updateHandler.js';

// POST /update route
updateRouter.post("/update", updateMiddleware, updateHandler); // use updateRouter, not router

export default updateRouter; // Correct for ESM
