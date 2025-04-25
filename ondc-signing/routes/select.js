import express from "express";
import selectHandler from "../handlers/select.js";
import selectMiddleware from "../middlewares/selectMiddleware.js";

const router = express.Router();
router.post("/select", selectMiddleware, selectHandler);

export default router;
