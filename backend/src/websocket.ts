import { Application } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'xdc-privacy-secret';

interface WebSocketClient {
  ws: any;
  partyId: string;
  subscriptions: Set<string>;
}

const clients: Map<string, WebSocketClient> = new Map();

export function setupWebSocket(app: Application) {
  (app as any).ws('/ws', (ws: any, req: any) => {
    let clientId: string | null = null;
    let partyId: string | null = null;

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);

        switch (data.type) {
          case 'auth':
            // Authenticate WebSocket connection
            try {
              const decoded = jwt.verify(data.token, JWT_SECRET) as { partyId: string };
              partyId = decoded.partyId;
              clientId = `${partyId}-${Date.now()}`;
              
              clients.set(clientId, {
                ws,
                partyId,
                subscriptions: new Set()
              });

              ws.send(JSON.stringify({
                type: 'auth_success',
                clientId,
                partyId
              }));
            } catch (err) {
              ws.send(JSON.stringify({
                type: 'auth_error',
                error: 'Invalid token'
              }));
            }
            break;

          case 'subscribe':
            // Subscribe to events (transactions, domains, etc.)
            if (clientId && clients.has(clientId)) {
              const client = clients.get(clientId)!;
              if (data.channel) {
                client.subscriptions.add(data.channel);
                ws.send(JSON.stringify({
                  type: 'subscribed',
                  channel: data.channel
                }));
              }
            }
            break;

          case 'unsubscribe':
            if (clientId && clients.has(clientId)) {
              const client = clients.get(clientId)!;
              client.subscriptions.delete(data.channel);
              ws.send(JSON.stringify({
                type: 'unsubscribed',
                channel: data.channel
              }));
            }
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;

          default:
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Unknown message type'
            }));
        }
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      if (clientId) {
        clients.delete(clientId);
      }
    });

    ws.on('error', (error: any) => {
      console.error('WebSocket error:', error);
      if (clientId) {
        clients.delete(clientId);
      }
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'XDC Canton Privacy WebSocket',
      timestamp: Date.now()
    }));
  });

  console.log('📡 WebSocket server configured');
}

// Broadcast to parties involved in a transaction
export function broadcastToParties(partyIds: string[], event: string, data: any) {
  for (const [, client] of clients) {
    if (partyIds.includes(client.partyId)) {
      client.ws.send(JSON.stringify({
        type: event,
        data,
        timestamp: Date.now()
      }));
    }
  }
}

// Broadcast to all subscribers of a channel
export function broadcastToChannel(channel: string, event: string, data: any) {
  for (const [, client] of clients) {
    if (client.subscriptions.has(channel)) {
      client.ws.send(JSON.stringify({
        type: event,
        channel,
        data,
        timestamp: Date.now()
      }));
    }
  }
}

export function getConnectedClients(): number {
  return clients.size;
}
