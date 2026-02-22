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