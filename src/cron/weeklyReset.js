// File: backend/cron/weeklyReset.js

import cron from "node-cron";
import { User } from "../models/user.model.js";

// --- RESET LOGIC FUNCTION ---
const runWeeklyReset = async () => {
  console.log("⏰ Weekly Reset Started (Sunday Midnight)...");

  const BATCH_SIZE = 20000;
  let totalReset = 0;

  try {
    while (true) {
      // 1. Sirf Active users (points > 0) dhundo
      const activeUsers = await User.find({ weeklyPoints: { $gt: 0 } })
        .select("_id")
        .limit(BATCH_SIZE);

      if (activeUsers.length === 0) break;

      const idsToUpdate = activeUsers.map((user) => user._id);

      // 2. Update karo
      await User.updateMany(
        { _id: { $in: idsToUpdate } },
        { $set: { weeklyPoints: 0 } }
      );

      totalReset += activeUsers.length;
      console.log(`✅ Reset batch of ${activeUsers.length} users...`);

      // 3. Server ko saans lene do
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    console.log(`🎉 Weekly Reset Complete! Total Users Reset: ${totalReset}`);
  } catch (error) {
    console.error("❌ Error in Weekly Reset:", error);
  }
};

// --- SCHEDULER (Ye function export hoga) ---
export const startCronJobs = () => {
  // CRON SYNTAX: Second(opt) Minute Hour Day Month DayOfWeek
  // "0 0 * * 0" ka matlab: "Har Sunday (0) ko raat 00:00 baje"
  
  cron.schedule("0 0 * * 0", () => {
    runWeeklyReset();
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Apne time zone ke hisab se set karein
  });

  console.log("✅ Cron Job Scheduled: Weekly Leaderboard Reset (Every Sunday 12:00 AM)");
};