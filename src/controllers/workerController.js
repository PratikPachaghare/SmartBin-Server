import User from '../models/user.model.js';
import Dustbin from '../models/Dustbin.js';

export const getMorningTasks = async (req, res) => {
  try {
    // 1. Filter: Level >= 70, isActive must be true
    // 2. Selection: Include location (lat/lng), level, and bin info
    const tasks = await Dustbin.find({
      isActive: true,
      currentLevel: { $gte: 70 }
    })
    .select('name area location currentLevel lastSeenAt size') // Fetching specific info for the worker
    .sort({ currentLevel: -1 }); // Priority: Fullest bins first

    // Check if tasks exist
    if (!tasks || tasks.length === 0) {
      return res.status(200).json({ 
        message: 'No high-level bins detected. Enjoy your morning!', 
        tasks: [] 
      });
    }

    res.status(200).json({
      count: tasks.length,
      timestamp: new Date(),
      tasks
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to retrieve morning tasks', 
      error: error.message 
    });
  }
};


export const getAllStaffList = async (req, res) => {
  try {
    // 1. Database se saare users fetch karte hain (password skip karke)
    const allUsers = await User.find({}).select('-password').sort({ createdAt: -1 });

    if (!allUsers || allUsers.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Database mein koi bhi user nahi mila." 
      });
    }

    // 2. JavaScript filter use karke Admin aur Worker ko alag alag karte hain
    // Maan lijiye aapke roles 'admin' aur 'worker' hain
    const admins = allUsers.filter(user => user.role === 'admin');
    const workers = allUsers.filter(user => user.role === 'worker');

    // 3. Organised data return karte hain
    res.status(200).json({
      success: true,
      totalCount: allUsers.length,
      stats: {
        adminCount: admins.length,
        workerCount: workers.length
      },
      data: {
        admins: admins.map(admin => ({
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          joinedAt: admin.createdAt
        })),
        workers: workers.map(worker => ({
          id: worker._id,
          name: worker.name,
          email: worker.email,
          area: worker.area || "Not Assigned",
          role: worker.role,
          rank: worker.rank || "N/A",
          tasksCompleted: worker.tasksCompletedToday || 0,
          isOnDuty: worker.isOnDuty || false, // Dashboard filtering ke liye helpful hai
          joinedAt: worker.createdAt
        }))
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Staff list fetch karne mein error.', 
      error: error.message 
    });
  }
};


export const getWorkerById = async (req, res) => {
  try {
    const worker = await User.findById(req.params.id)
      .select('-password'); // Password ko security ke liye hide rakhein

    if (!worker || worker.role !== 'worker') {
      return res.status(404).json({ success: false, message: 'Worker nahi mila.' });
    }

    res.status(200).json({ success: true, worker });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Invalid ID format ya server error.' });
  }
};


import axios from 'axios';

export const getOptimizedTasks = async (req, res) => {
  try {
    // 1. Worker ka area nikalein (Auth middleware se req.user milega)
    const workerArea = req.user.area; 

    // 2. Worker ke area ke dustbins fetch karein
    const allBins = await Dustbin.find({ isActive: true });

    if (allBins.length === 0) {
      return res.status(404).json({ message: "Aapke area mein koi dustbins nahi mile." });
    }

    // 3. 50% fill level se upar wale bins filter karein
    const filteredBins = allBins.filter(bin => bin.currentLevel >= 0);

    if (filteredBins.length === 0) {
      return res.status(200).json({ message: "Sabhi bins 50% se niche hain. Chill karein!", data: [] });
    }

    // 4. Flask Model ke liye data format karein
    const now = new Date();
    const isWeekend = (now.getDay() === 6 || now.getDay() === 0) ? 1 : 0;
    const currentHour = now.getHours();

    const modelInput = filteredBins.map(bin => {
      // 🔥 SAFETY CHECK: Ensure location_type is a word your AI model recognizes
      // If bin.size is something like "Small", force it to "Residential" so Python doesn't crash
      const validLocations = ["Residential", "Commercial", "Industrial"];
      let locType = bin.size || "Residential"; 
      
      if (!validLocations.includes(locType)) {
         locType = "Residential"; 
      }

      return {
        bin_id: bin._id.toString(), 
        fill_percent: bin.currentLevel,
        location_type: locType,
        is_weekend: isWeekend,
        hour: currentHour
      };
    });

    // 5. Flask API call karein (Request to ML Model)
    const flaskResponse = await axios.post('http://127.0.0.1:5000/predict_multiple', modelInput);
    
    // Flask se list of IDs aayi
    const optimizedIds = flaskResponse.data.optimized_ids; 

    // 6. Un IDs ka pura data database se fetch karein
    const finalTaskData = await Dustbin.find({
      '_id': { $in: optimizedIds }
    });

    res.status(200).json({
      success: true,
      total_filtered: filteredBins.length,
      optimized_count: finalTaskData.length,
      tasks: finalTaskData
    });

  } catch (error) {
    // 🔥 BETTER ERROR HANDLING: Extracts the exact error message sent from Flask!
    const flaskError = error.response ? error.response.data : error.message;
    
    console.error("Worker Task Error:", flaskError);
    
    res.status(500).json({ 
      message: 'Model processing mein error aaya.', 
      error: flaskError 
    });
  }
};


export const getDashboardStats = async (req, res) => {
  try {
    // 1. Filhal pure city ka data fetch karne ke liye filter khali rakha hai
    const globalFilter = {}; 

    const totalDustbins = await Dustbin.countDocuments(globalFilter);
    const activeDustbins = await Dustbin.countDocuments({ ...globalFilter, isActive: true });
    
    // 2. Level Based Stats (Pure city ke liye)
    const fullDustbins = await Dustbin.countDocuments({ ...globalFilter, currentLevel: { $gte: 90 } });
    const warningDustbins = await Dustbin.countDocuments({ ...globalFilter, currentLevel: { $gte: 70, $lt: 90 } });
    
    // 3. Collection Priority
    const tasksToCollect = await Dustbin.countDocuments({ 
      ...globalFilter, 
      currentLevel: { $gt: 50 },
      isActive: true 
    });

    const systemHealth = totalDustbins > 0 ? (activeDustbins / totalDustbins) * 100 : 0;

    // Response JSON hona chahiye, HTML nahi!
    res.status(200).json({
      success: true,
      workerArea: "All Areas (Global View)", 
      stats: {
        summary: {
          totalBins: totalDustbins,
          activeBins: activeDustbins,
          needsCollection: tasksToCollect,
          systemHealth: `${systemHealth.toFixed(1)}%`
        },
        levels: {
          critical: fullDustbins,
          warning: warningDustbins,
          normal: activeDustbins - (fullDustbins + warningDustbins)
        },
        performance: {
          areaRank: "N/A",
          tasksCompletedToday: 0
        }
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error in dashboard stats.', 
      error: error.message 
    });
  }
};


// Sirf Worker ki details fetch karne ke liye function
export const getWorkerProfile = async (req, res) => {
  try {
    // 1. req.user middleware se ID nikalte hain
    const workerId = req.user.id; 

    // 2. Database se worker ka full data fetch karte hain (password skip karke)
    const worker = await User.findById(workerId).select('-password');

    if (!worker) {
      return res.status(404).json({ 
        success: false, 
        message: "Worker profile database mein nahi mili." 
      });
    }

    // 3. Worker details return karte hain
    res.status(200).json({
      success: true,
      data: {
        id: worker._id,
        name: worker.name,
        email: worker.email,
        area: worker.area || "Not Assigned", //
        role: worker.role,
        rank: worker.rank || "#1", //
        tasksCompleted: worker.tasksCompletedToday || 0,
        joinedAt: worker.createdAt
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Worker data fetch karne mein error.', 
      error: error.message 
    });
  }
};


import BinHistory from '../models/BinHistory.js';

export const getBinAnalytics = async (req, res) => {
  try {
    const { binId } = req.params;

    // 1. Search using 'bin_id' to match your MongoDB screenshot
    const history = await BinHistory.find({ bin_id: binId })
      .sort({ timestamp: -1 }) // Sort by your 'timestamp' field
      .limit(20);

    if (!history || history.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          graphData: [],
          stats: { avgFillingRate: "No Data", lastUpdated: "Never" }
        }
      });
    }

    // 2. Map fields: 'fill_percent' -> 'level' and 'timestamp' -> 'time'
    const graphData = history.reverse().map(entry => ({
      level: entry.fill_percent, // Use 'fill_percent' from DB
      time: new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: entry.timestamp
    }));

    // 3. Calculation logic remains the same
    let avgFillingRate = "Stable";
    if (graphData.length > 1) {
      const first = graphData[0];
      const last = graphData[graphData.length - 1];
      
      const levelDiff = last.level - first.level;
      const timeDiffHours = (new Date(last.timestamp) - new Date(first.timestamp)) / (1000 * 60 * 60);
      
      if (levelDiff > 0 && timeDiffHours > 0) {
        const rate = levelDiff / timeDiffHours;
        avgFillingRate = `${rate.toFixed(1)}% per hour`;
      } else if (levelDiff < 0) {
        avgFillingRate = "Emptying";
      }
    }

    res.status(200).json({
      success: true,
      data: {
        graphData,
        stats: {
          avgFillingRate,
          lastUpdated: graphData[graphData.length - 1]?.time
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};