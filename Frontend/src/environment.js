// const server = {
//     dev: "http://localhost:8000",
//     prod: "https://meetverse-backend-e5vr.onrender.com"
// }

// export default server;



const server_url =
    import.meta.env.VITE_API_URL ||
    "https://meetverse-backend-e5vr.onrender.com";

export default server_url;