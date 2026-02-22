import express from 'express';
import { getDashboardStats, getMorningTasks, getOptimizedTasks, getWorkerProfile } from '../controllers/workerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Worker aur Admin dono access kar sakte hain
router.get('/tasks', protect, authorize('worker', 'admin'), getMorningTasks);
router.get('/PredictedList', protect, authorize('worker', 'admin'), getOptimizedTasks);
router.get('/dashboard-stats', protect, authorize('worker', 'admin'), getDashboardStats);
router.get('/getWorkerFromToken', protect, getWorkerProfile);


export default router;