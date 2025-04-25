import express from 'express';

import { onCancelMiddleware } from '../middlewares/onCancelValidationMiddleware.js'; 

import { handleOnCancel } from '../handlers/onCancelHandler.js';

const router = express.Router();

router.post(
  '/on_cancel',
  onCancelMiddleware,
  handleOnCancel
);

export { router as onCancelRouter };