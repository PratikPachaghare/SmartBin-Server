import express from 'express';
import { getDashboardStats, getHotspotAlerts } from '../controllers/dashboardController.js';
import { getAllStaffList, getWorkerById } from '../controllers/workerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Sabhi routes sirf Admin ke liye
router.use(protect, authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/workers', getAllStaffList);
router.get('/workers/:id', getWorkerById);
router.get('/hotspots', getHotspotAlerts);

export default router;