import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLine = `${req.method} ${req.path} ${res.statusCode} ${duration}ms`;
    
    if (res.statusCode >= 500) {
      console.error(`❌ ${logLine}`);
    } else if (res.statusCode >= 400) {
      console.warn(`⚠️ ${logLine}`);
    } else {
      console.log(`✓ ${logLine}`);
    }
  });
  
  next();
}
