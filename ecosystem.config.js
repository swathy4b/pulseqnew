module.exports = {
  apps: [
    {
      name: 'python-backend',
      cwd: './server',
      script: 'python',
      args: 'app.py',
      watch: true,
      env: {
        PORT: 5000,
        FLASK_APP: 'app.py',
        FLASK_ENV: 'production'
      }
    },
    {
      name: 'node-frontend',
      cwd: '.',
      script: 'node',
      args: 'server.js',
      watch: true,
      env: {
        PORT: 3000,
        BACKEND_URL: 'http://localhost:5000',
        NODE_ENV: 'production'
      },
      wait_ready: true,
      listen_timeout: 10000
    }
  ]
};
