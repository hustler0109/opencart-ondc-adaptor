import express from "express";
 import searchHandler from "../handlers/Search.js";
 import searchMiddleware from "../middlewares/SearchMiddleware.js";
 
 const router = express.Router();
 router.post("/search", searchMiddleware, searchHandler);
 
 export default router;

