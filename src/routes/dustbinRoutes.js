import express from 'express';
import { collectBin, createBulkDustbins, createDustbin, getCityBins, getMapDustbins, updateDustbinLevel } from '../controllers/dustbinController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Map data koi bhi login user dekh sakta hai
router.get('/map', protect, getMapDustbins);

// Dustbin sirf Admin add kar sakta hai
router.post('/add', protect, authorize('admin'), createDustbin);
router.post('/add/bulk', protect, authorize('admin'), createBulkDustbins);

router.post('/update/level/automatic', updateDustbinLevel);
router.post('/update/level/manual', protect, updateDustbinLevel);

router.post('/update/collectBin', protect, collectBin);

router.post('/getDustbinArea', protect, getCityBins);

export default router;