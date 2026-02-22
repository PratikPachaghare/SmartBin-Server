import express from 'express';
import { collectBin, createBulkDustbins, createDustbin, getMapDustbins, updateDustbinLevel } from '../controllers/dustbinController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Map data koi bhi login user dekh sakta hai
router.get('/map', protect, getMapDustbins);

// Dustbin sirf Admin add kar sakta hai
router.post('/add', protect, authorize('admin'), createDustbin);
router.post('/add/bulk', protect, authorize('admin'), createBulkDustbins);

router.post('/update/level/automatic', protect, updateDustbinLevel);
router.post('/update/level/manual', protect, updateDustbinLevel);

router.post('/update/collectBin', protect, collectBin);

export default router;