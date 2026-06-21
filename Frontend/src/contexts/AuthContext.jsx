import axios from "axios";
import { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import httpStatus from "http-status";
import server_url from "../environment.js";

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext({});

const client = axios.create({
    baseURL: `${server_url}/api/v1/users`
});

export const AuthProvider = ({ children }) => {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem("token");
            if (token) {
                try {
                    const request = await client.get("/profile", {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (request.status === httpStatus.OK) {
                        setUserData(request.data.user);
                    }
                } catch (err) {
                    console.error("Token verification failed:", err);
                    localStorage.removeItem("token");
                    setUserData(null);
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    const handleRegister = async (fullName, email, password) => {
        const request = await client.post("/register", {
            fullName,
            email,
            password
        });

        if (request.status === httpStatus.CREATED) {
            return request.data.message;
        }
    };

    const handleLogin = async (email, password) => {
        const request = await client.post("/login", {
            email,
            password
        });

        if (request.status === httpStatus.OK) {
            localStorage.setItem("token", request.data.token);
            setUserData(request.data.user);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        setUserData(null);
        window.location.href = "/";
    };

    const data = {
        userData,
        setUserData,
        handleRegister,
        handleLogin,
        handleLogout,
        loading
    };

    return (
        <AuthContext.Provider value={data}>
            {/* Render children immediately — don't block on auth loading.
                Pages that need auth should check the `loading` flag from context. */}
            {children}
        </AuthContext.Provider>
    );
};