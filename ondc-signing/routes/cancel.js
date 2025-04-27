import express from "express";
const cancelrouter = express.Router();

import { processCancelRequest } from "../middlewares/cancelMiddleware.js";
import { handleCancel } from "../handlers/cancelHandler.js";

cancelrouter.post('/cancel', processCancelRequest, handleCancel);

export default cancelrouter;