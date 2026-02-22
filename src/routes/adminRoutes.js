import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { getAllWorkers, getWorkerById } from '../controllers/workerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Sabhi routes sirf Admin ke liye
router.use(protect, authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/workers', getAllWorkers);
router.get('/workers/:id', getWorkerById);

export default router;