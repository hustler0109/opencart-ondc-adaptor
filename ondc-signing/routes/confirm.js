// routes/confirm.js
import express from 'express';
import confirmMiddleware from '../middlewares/confirmMiddleware.js'; // Assuming it's also ESM
import confirmHandler  from '../handlers/confirmHandler.js'; // Assuming it's also ESM
import logger from '../utils/logger.js'; // Assuming it's also ESM

const confirmRouter = express.Router();

confirmRouter.post('/confirm', confirmMiddleware, async (req, res) => {
  try {
    const transactionId = req.body.context?.transaction_id;
    const bapId = req.verified_bap_id;

    const response = await handleConfirm(req.body, bapId);

    logger.info({
      message: 'Confirm processed successfully',
      transaction_id: transactionId,
      bap_id: bapId,
    });

    res.status(200).json(response);
  } catch (error) {
    logger.error({
      message: 'Error in /confirm route handler',
      error: error.message,
      transaction_id: req.body.context?.transaction_id,
    });

    res.status(500).json({
      message: 'Internal Server Error in Confirm Route',
      error: error.message,
    });
  }
});

export default confirmRouter;