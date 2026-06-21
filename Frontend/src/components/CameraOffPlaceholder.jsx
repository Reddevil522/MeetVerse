import React from "react";
import "../public/CSS/VideoCall.css";

export default function CameraOffPlaceholder({ participantName }) {
    const initial = participantName ? participantName.charAt(0).toUpperCase() : "U";

    return (
        <div className="vc-tile-no-video">
            <div className="vc-tile-avatar">
                {initial}
            </div>
        </div>
    );
}
