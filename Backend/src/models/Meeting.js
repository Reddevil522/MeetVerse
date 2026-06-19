import mongoose, { Schema } from "mongoose";

const meetingSchema = new Schema({
    meetingCode: {
        type: String,
        required: true,
    },
    host: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
        required: false, // Make false for guest meetings
    },
    participants: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    }],
    date: {
        type: Date,
        default: Date.now,
        required: true,
    },
    duration: {
        type: Number,
        default: 0
    },
    deletedBy: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    }]
}, { timestamps: true });

// Index meetingCode for fast O(log n) lookups instead of full collection scans
meetingSchema.index({ meetingCode: 1 });

const Meeting = mongoose.model("Meeting", meetingSchema);

export { Meeting };