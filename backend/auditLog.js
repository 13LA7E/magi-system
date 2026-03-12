const fs = require('fs');
const path = require('path');

const AUDIT_FILE = path.join(__dirname, 'audit.json');
const DAILY_LIMIT = 100;

function readLog() {
  if (!fs.existsSync(AUDIT_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeLog(entries) {
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(entries, null, 2));
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getDailyCount() {
  const today = getTodayKey();
  return readLog().filter((e) => e.timestamp && e.timestamp.startsWith(today)).length;
}

function logDeliberation(entry) {
  const entries = readLog();
  entries.push({ ...entry, timestamp: new Date().toISOString() });
  writeLog(entries);
}

function getRecentLogs(n = 10) {
  const entries = readLog();
  return entries.slice(-n).reverse();
}

module.exports = { getDailyCount, logDeliberation, getRecentLogs, DAILY_LIMIT };
