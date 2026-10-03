const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const { requireFeesRole } = require('../middleware/auth');

router.get('/', requireFeesRole, feeController.getFees);
router.post('/', requireFeesRole, feeController.createFee);
router.delete('/:id', requireFeesRole, feeController.deleteFee);

module.exports = router;
