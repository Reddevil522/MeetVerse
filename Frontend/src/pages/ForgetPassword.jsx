import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEnvelope, FaArrowLeft } from "react-icons/fa";
import { server_url } from "../config";
import { useToast } from "../hooks/useToast";
import "../public/CSS/ForgetPassword.css";

export default function ForgetPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const toast = useToast();
    const navigate = useNavigate();

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(`${server_url}/api/v1/users/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await response.json();

            if (data.success) {
                toast.success("Reset link generated!");
                // In a real app we wouldn't navigate automatically, but since it's simulated,
                // let's give the user a moment to see the toast, then navigate to the reset page
                setTimeout(() => {
                    navigate(`/reset-password/${data.resetToken}`);
                }, 3000);
            } else {
                toast.error(data.message || "Failed to generate reset link");
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

                <h1>Forgot Password?</h1>

                <p>
                    Enter your email address and we'll send you a password reset link.
                </p>

                <form onSubmit={handleForgotPassword}>
                    <div className="input-group">
                        <FaEnvelope className="input-icon" />

                        <input
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="reset-btn" disabled={loading}>
                        {loading ? "Sending..." : "Send Reset Link"}
                    </button>
                </form>

                <div className="auth-footer">
                    Remember your password?
                    <Link to="/login"> Login</Link>
                </div>

            </div>
        </div>
    );
}