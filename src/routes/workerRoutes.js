import express from 'express';
import {  getAllStaffList, getBinAnalytics, getDashboardStats, getMorningTasks, getOptimizedTasks, getWorkerProfile } from '../controllers/workerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Worker aur Admin dono access kar sakte hain
router.get('/tasks', protect, authorize('worker', 'admin'), getMorningTasks);
router.get('/getAllWorkers', protect, authorize('worker', 'admin'), getAllStaffList);
router.get('/PredictedList', protect, authorize('worker', 'admin'), getOptimizedTasks);
router.get('/dashboard-stats', protect, authorize('worker', 'admin'), getDashboardStats);
router.get('/getWorkerFromToken', protect, getWorkerProfile);
router.get('/getBinAnalytics/:binId', protect, getBinAnalytics);


export default router;