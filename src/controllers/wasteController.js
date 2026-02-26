import fs from 'fs';
import path from 'path';
import WasteReport from '../models/WasteReport.js';

/**
 * Function 1: Store Report Data
 * Assumes the image is already uploaded via Multer middleware.
 */
export const uploadAndStoreReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image' });
    }

    const { userId, latitude, longitude } = req.body;

    if (!userId || !latitude || !longitude) {
      // Clean up the uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'User ID and location data are required' });
    }

    // Since you save to public/temp, the public URL will likely be /temp/filename
    const imageUrl = `/temp/${req.file.filename}`;

    const newReport = new WasteReport({
      userId,
      imageUrl,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      status: 'pending',
    });

    const savedReport = await newReport.save();

    // Trigger AI verification in the background (fire and forget)
    sendForVerification(savedReport._id).catch(console.error);

    res.status(201).json({
      message: 'Report created successfully, pending verification',
      reportId: savedReport._id,
      imageUrl,
    });
  } catch (error) {
    console.error('Error saving report:', error);
    if (req.file) fs.unlinkSync(req.file.path); // Cleanup on error
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Function 2: Send to AI Model Verification
 * Automatically called after a successful upload.
 */
export const sendForVerification = async (reportId) => {
  try {
    const report = await WasteReport.findById(reportId);
    if (!report) return;

    // Construct the absolute path to the saved image
    const imagePath = path.join(process.cwd(), 'public', report.imageUrl);
    
    // In a real scenario, you'd use native fetch() and FormData to send this to a Python/Flask AI service:
    /*
    const formData = new FormData();
    formData.append('image', new Blob([fs.readFileSync(imagePath)]));
    
    const response = await fetch('YOUR_AI_SERVICE_URL/predict', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    */

    // MOCKING the Garbage/Trash AI Model response:
    const mockModelResponse = {
      detected: true, 
      confidence: 0.88, 
    };

    report.modelResult = {
      garbageStrash: {
        detected: mockModelResponse.detected,
        confidence: mockModelResponse.confidence,
      },
    };

    await report.save();
    console.log(`Report ${reportId} processed by AI. Ready for worker.`);

  } catch (err) {
    console.error(`Error in AI verification for report ${reportId}:`, err);
  }
};

/**
 * Function 3: Final Worker Verification
 * Called by the admin/worker dashboard.
 */
export const verifyReportByWorker = async (req, res) => {
  try {
    const { reportId, workerId, decision, comments } = req.body;

    if (!reportId || !workerId || !decision) {
      return res.status(400).json({ error: 'Report ID, Worker ID, and decision are required.' });
    }

    if (!['valid', 'invalid'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be "valid" or "invalid".' });
    }

    const report = await WasteReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    report.status = decision;
    report.workerFeedback = {
      workerId,
      decision,
      comments: comments || '',
      verifiedAt: new Date(),
    };

    await report.save();

    // TODO: If decision === 'valid', add logic here to increment user points

    res.status(200).json({ 
      message: 'Verification complete.', 
      finalStatus: report.status 
    });
  } catch (err) {
    console.error('Error during worker verification:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getPendingReports = async (req, res) => {
  try {
    // Fetch reports with 'pending' status. 
    // .sort({ createdAt: 1 }) shows the oldest reports first (first in, first out).
    const pendingReports = await WasteReport.find({ status: 'pending' }).sort({ createdAt: 1 });
    
    res.status(200).json({ reports: pendingReports });
  } catch (error) {
    console.error('Error fetching pending reports:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};