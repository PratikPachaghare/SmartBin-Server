import Dustbin from '../models/Dustbin.js';
import User from '../models/user.model.js';

export const getDashboardStats = async (req, res) => {
  try {
    // 1. Dustbin Counts (Status wise)
    const totalDustbins = await Dustbin.countDocuments();
    const activeDustbins = await Dustbin.countDocuments({ isActive: true });
    const maintenanceDustbins = await Dustbin.countDocuments({ isActive: false });
    
    // 2. Level Based Stats (Critical vs Empty)
    const fullDustbins = await Dustbin.countDocuments({ currentLevel: { $gte: 90 } });
    const warningDustbins = await Dustbin.countDocuments({ currentLevel: { $gte: 70, $lt: 90 } });
    
    // 3. User/Worker Stats
    const totalWorkers = await User.countDocuments({ role: 'worker' });
    const activeWorkers = await User.countDocuments({ role: 'worker', isActive: true });

    // 4. Area wise distribution (Optional but premium)
    // Yeh har area mein kitne bins hain uska breakdown dega
    const areaStats = await Dustbin.aggregate([
      { $group: { _id: "$area", count: { $sum: 1 }, avgLevel: { $avg: "$currentLevel" } } }
    ]);

    // 5. Overall System Health
    const systemHealth = totalDustbins > 0 ? (activeDustbins / totalDustbins) * 100 : 0;

    res.status(200).json({
      success: true,
      stats: {
        summary: {
          total: totalDustbins,
          active: activeDustbins,
          underMaintenance: maintenanceDustbins,
          systemHealth: `${systemHealth.toFixed(1)}%`
        },
        levels: {
          critical: fullDustbins,   // 90%+
          warning: warningDustbins,  // 70% - 90%
          healthy: activeDustbins - (fullDustbins + warningDustbins)
        },
        workforce: {
          total: totalWorkers,
          onField: activeWorkers
        },
        areaBreakdown: areaStats
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Dashboard data fetch karne mein error.', 
      error: error.message 
    });
  }
};



import BinHistory from '../models/BinHistory.js';

export const getHotspotAlerts = async (req, res) => {
  try {
    const bins = await Dustbin.find({ isActive: true });
    const hotspotAlerts = [];

    for (let bin of bins) {
      // Latest 10 entries check karenge
      const history = await BinHistory.find({ bin_id: bin._id })
        .sort({ timestamp: -1 })
        .limit(10);

      if (history.length < 5) continue;

      const totalHoursToFull = history.reduce((sum, entry) => sum + entry.hours_to_full, 0);
      const avgHoursToFull = totalHoursToFull / history.length;
      const frequentFullCount = history.filter(entry => entry.fill_percent >= 90).length;

      // Threshold: Agar avg filling time 8 ghante se kam hai ya 10 mein se 4 baar full hua
      if (avgHoursToFull < 8 || frequentFullCount >= 4) {
        hotspotAlerts.push({
          bin_id: bin._id,
          name: bin.name,
          area: bin.area,
          // Exact coordinates for Admin Map
          location: {
            lat: bin.location.lat,
            lng: bin.location.lng
          },
          stats: {
            avgFillingTime: avgHoursToFull.toFixed(2),
            timesFullInLast10: frequentFullCount
          }
        });
      }
    }

    res.status(200).json({ success: true, hotspots: hotspotAlerts });
  } catch (error) {
    res.status(500).json({ message: "Error identifying hotspots" });
  }
};