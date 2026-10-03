const express = require('express');
const router = express.Router();
const enquiryController = require('../controllers/enquiryController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Enquiries CRUD
router.get('/', enquiryController.getEnquiries);
router.post('/bulk', enquiryController.bulkCreateEnquiries);
router.post('/', enquiryController.createEnquiry);
router.patch('/:id', enquiryController.updateEnquiry);
router.delete('/:id', enquiryController.deleteEnquiry);
router.post('/:id/confirm', enquiryController.confirmEnquiry);

// Enquiries remarks
router.get('/:id/remarks', enquiryController.getRemarks);
router.post('/:id/remarks', enquiryController.addRemark);

module.exports = router;
