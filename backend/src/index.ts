import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import expressWs from 'express-ws';
import dotenv from 'dotenv';

import { authRouter } from './routes/auth';
import { domainRouter } from './routes/domains';
import { transactionRouter } from './routes/transactions';
import { disclosureRouter } from './routes/disclosures';
import { commitmentRouter } from './routes/commitments';
import { setupWebSocket } from './websocket';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

dotenv.config();

const app = express();
const wsInstance = expressWs(app);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['*'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow all origins in dev or if wildcard
    if (corsOrigins.includes('*')) return callback(null, true);
    
    // Check if origin is allowed
    if (corsOrigins.some(allowed => origin.includes(allowed.replace('https://', '')))) {
      return callback(null, true);
    }
    
    callback(null, true); // Allow all for now
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'xdc-privacy',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/domains', domainRouter);
app.use('/api/v1/transactions', transactionRouter);
app.use('/api/v1/disclosures', disclosureRouter);
app.use('/api/v1/commitments', commitmentRouter);

// WebSocket setup
setupWebSocket(wsInstance.app);

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🔐 XDC Privacy API running on port ${PORT}`);
  console.log(`📡 WebSocket available at ws://localhost:${PORT}/ws`);
  console.log(`🌐 XDC RPC: ${process.env.XDC_RPC_URL || 'https://rpc.apothem.network'}`);
});

export default app;
