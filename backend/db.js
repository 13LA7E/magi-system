const mongoose = require('mongoose');

const deliberationSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  query: String,
  mode: String,
  testerId: String,
  classification: String,
  searchUsed: Boolean,
  stage1: {
    melchior: { verdict: String, confidence: Number },
    balthasar: { verdict: String, confidence: Number },
    casper: { verdict: String, confidence: Number }
  },
  stage2: {
    melchior: { verdict: String, confidence: Number, decision: String },
    balthasar: { verdict: String, confidence: Number, decision: String },
    casper: { verdict: String, confidence: Number, decision: String }
  },
  assumptions: {
    melchior: String,
    balthasar: String,
    casper: String
  },
  consensus: String,
  weightedScore: Number,
  escalate: Boolean,
  duration: Number
});

const Deliberation = mongoose.model('Deliberation', deliberationSchema);

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/magi';
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

async function logDeliberation(data) {
  const doc = new Deliberation(data);
  await doc.save();
}

async function getRecentLogs(n = 10) {
  return Deliberation.find()
    .sort({ timestamp: -1 })
    .limit(n)
    .lean();
}

async function getDailyCount() {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const start = new Date(`${todayUtc}T00:00:00.000Z`);
  return Deliberation.countDocuments({
    timestamp: { $gte: start }
  });
}

module.exports = { connectDB, logDeliberation, getRecentLogs, getDailyCount };
