import { Meeting } from "../models/Meeting.js";
import { User } from "../models/Users.js";
import { wrapAsync } from "../utils/wrapAsync.js";

export const getMeetingHistory = wrapAsync(async (req, res, next) => {
        const userId = req.user._id;
        const meetings = await Meeting.find({ 
            $or: [{ host: userId }, { participants: userId }],
            deletedBy: { $ne: userId }
        })
        .populate("host", "fullName email avatar")
        .populate("participants", "fullName email avatar")
        .sort({ createdAt: -1 })
        .lean(); // lean() returns plain JS objects — faster deserialization for read-only data

        return res.status(200).json({ success: true, meetings });
});

export const addToHistory = wrapAsync(async (req, res, next) => {
        const { meetingCode } = req.body;
        const userId = req.user._id;

        let meeting = await Meeting.findOne({ meetingCode });
        
        if (!meeting) {
            meeting = new Meeting({
                meetingCode,
                host: userId,
                participants: [userId]
            });
            await meeting.save();
        } else {
            // Add participant if not already there
            if (!meeting.participants.includes(userId)) {
                meeting.participants.push(userId);
            }
            // Remove user from deletedBy if they rejoin
            if (meeting.deletedBy && meeting.deletedBy.includes(userId)) {
                meeting.deletedBy = meeting.deletedBy.filter(id => id.toString() !== userId.toString());
            }
            await meeting.save();
        }

        return res.status(200).json({ success: true, message: "Meeting saved to history" });
});

export const deleteMeetingHistory = wrapAsync(async (req, res, next) => {
        const { meetingCode } = req.params;
        const userId = req.user._id;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) return res.status(404).json({ success: false, message: "Meeting not found" });

        // Individually mark the meeting as deleted for this user
        if (!meeting.deletedBy) meeting.deletedBy = [];
        if (!meeting.deletedBy.includes(userId)) {
            meeting.deletedBy.push(userId);
            await meeting.save();
        }

        return res.status(200).json({ success: true, message: "Meeting removed from history" });
});
