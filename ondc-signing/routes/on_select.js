import express from "express";
import onSelectHandler from "../handlers/onSelect.js";
import onSelectMiddleware from "../middlewares/onSelectMiddleware.js";

const router = express.Router();
router.post("/on_select", onSelectMiddleware, onSelectHandler);

export default router;
