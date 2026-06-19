import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FaLock, FaArrowLeft } from "react-icons/fa";
import { server_url } from "../config";
import { useToast } from "../hooks/useToast";
import "../public/CSS/ForgetPassword.css";

export default function ResetPassword() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    
    const { token } = useParams();
    const toast = useToast();
    const navigate = useNavigate();

    const handleResetPassword = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            return toast.error("Passwords do not match");
        }

        setLoading(true);

        try {
            const response = await fetch(`${server_url}/api/v1/users/reset-password/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password })
            });
            const data = await response.json();

            if (data.success) {
                toast.success("Password reset successfully! Please login.");
                navigate("/login");
            } else {
                toast.error(data.message || "Failed to reset password");
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="forgot-container">
            <div className="forgot-card">

                <Link to="/login" className="back-btn">
                    <FaArrowLeft />
                    Back to Login
                </Link>

                <h1>Reset Password</h1>

                <p>
                    Please enter your new password below.
                </p>

                <form onSubmit={handleResetPassword}>
                    <div className="input-group">
                        <FaLock className="input-icon" />
                        <input
                            type="password"
                            placeholder="Enter new password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div className="input-group">
                        <FaLock className="input-icon" />
                        <input
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="reset-btn" disabled={loading}>
                        {loading ? "Resetting..." : "Reset Password"}
                    </button>
                </form>

            </div>
        </div>
    );
}
