const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from client directory
app.use(express.static(path.join(__dirname, 'client')));

// API proxy to Python backend
if (process.env.BACKEND_URL) {
    const { createProxyMiddleware } = require('http-proxy-middleware');
    app.use('/api', createProxyMiddleware({
        target: process.env.BACKEND_URL,
        changeOrigin: true,
        pathRewrite: { '^/api': '' },
        logLevel: 'debug'
    }));
}

// All other routes serve the main HTML file
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Static server running on port ${PORT}`);
    if (process.env.BACKEND_URL) {
        console.log(`Proxying API requests to: ${process.env.BACKEND_URL}`);
    }
});
