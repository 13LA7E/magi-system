const crypto = require('crypto');
const { exec } = require('child_process');

// Admin middleware: verify admin token
const adminToken = process.env.ADMIN_TOKEN;

const requireAdmin = (req, res, next) => {
  if (!adminToken) {
    return res.status(503).json({ error: 'Admin token not configured' });
  }
  
  const token = req.headers['x-admin-token'];
  const tokenValid = typeof token === 'string' &&
    token.length === adminToken.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(adminToken));
  
  if (!tokenValid) {
    console.log(`[MAGI] Unauthorized admin access attempt — IP: ${req.ip} — ${new Date().toISOString()}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Admin endpoint: control PM2 processes and deployment
const setupAdminRoutes = (app) => {
  app.post('/admin/restart', requireAdmin, (req, res) => {
    const { action } = req.body;

    if (!action || typeof action !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid action parameter' });
    }

    if (action === 'restart-pm2') {
      // Restart all PM2 processes
      exec('pm2 restart all', (err, stdout, stderr) => {
        if (err) {
          console.error('[MAGI] PM2 restart failed:', err.message);
          return res.status(500).json({ error: err.message });
        }
        console.log('[MAGI] PM2 restart executed successfully');
        res.json({ success: true, message: 'PM2 restarted', output: stdout });
      });
    } else if (action === 'status') {
      // Check PM2 status
      exec('pm2 status', (err, stdout, stderr) => {
        if (err) {
          console.error('[MAGI] PM2 status check failed:', err.message);
          return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, status: stdout });
      });
    } else if (action === 'pull-and-deploy') {
      // Pull latest code and restart
      exec('cd /root/magi-system && git pull && pm2 restart all', (err, stdout, stderr) => {
        if (err) {
          console.error('[MAGI] Deployment failed:', err.message);
          return res.status(500).json({ error: err.message });
        }
        console.log('[MAGI] Deployment executed successfully');
        res.json({ success: true, message: 'Deployed and restarted', output: stdout });
      });
    } else {
      res.status(400).json({ error: 'Unknown action. Allowed actions: restart-pm2, status, pull-and-deploy' });
    }
  });
};

module.exports = { setupAdminRoutes, requireAdmin };
