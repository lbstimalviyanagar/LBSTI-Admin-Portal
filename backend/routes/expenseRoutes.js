const express = require('express');
const expenseController = require('../controllers/expenseController');
const { requireAdminRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdminRole);

router.get('/', expenseController.getExpenses);
router.post('/', expenseController.createExpense);
router.put('/:id', expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);
router.get('/categories', expenseController.getCategories);
router.post('/categories', expenseController.createCategory);
router.patch('/categories/:id', expenseController.updateCategory);
router.delete('/categories/:id', expenseController.deleteCategory);
router.get('/:id/receipt', expenseController.getReceipt);

module.exports = router;
