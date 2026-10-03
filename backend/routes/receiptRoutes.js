const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');
const { requireFeesRole } = require('../middleware/auth');

router.post('/', requireFeesRole, receiptController.issueReceipt);

module.exports = router;
