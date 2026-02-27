import express from 'express';
// IMPORT the new getPendingReports function here
import { 
  uploadAndStoreReport, 
  verifyReportByWorker, 
  getPendingReports, 
  loginOrRegister,
  getUserReports
} from '../controllers/wasteController.js';
import { upload } from '../middleware/multer.middlewares.js';

const router = express.Router();

// 1. Upload route

router.post('/public-user-auth', loginOrRegister);

router.post('/upload-waste', upload.single('image'), uploadAndStoreReport);

// 2. Fetch pending reports route (NEW)
router.get('/reports/pending', getPendingReports);

// 3. Worker verification route
router.post('/verify-report', verifyReportByWorker);

router.get('/reports/user/:userId', getUserReports);

export default router;