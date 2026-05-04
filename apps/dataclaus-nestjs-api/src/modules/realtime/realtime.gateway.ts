import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from '../application/entities/application.entity';

interface AuthedSocket extends Socket {
  data: {
    user?: {
      sub: string;
      role?: string;
      developerId?: string;
    };
  };
}

interface SubscribeApplicationDto {
  applicationId: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.emit('error', { message: 'Missing auth token' });
        client.disconnect(true);
        return;
      }

      const secret = this.configService.get<string>('jwt.secret');
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        role?: string;
        developerId?: string;
      }>(token, { secret });

      client.data.user = {
        sub: payload.sub,
        role: payload.role,
        developerId: payload.developerId,
      };

      // Auto-join personal room
      await client.join(`user:${payload.sub}`);
      if (payload.role === 'developer' || payload.developerId) {
        await client.join(`developer:${payload.developerId ?? payload.sub}`);
      }

      this.logger.log(
        `Client ${client.id} connected (sub=${payload.sub}, role=${payload.role ?? 'user'})`,
      );
      client.emit('ready', { ok: true, sub: payload.sub });
    } catch (err) {
      this.logger.warn(
        `Rejected WS connection: ${(err as Error).message}`,
      );
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  /**
   * Subscribe to an application's room. Only the owning developer or
   * an admin may join.
   */
  @SubscribeMessage('subscribe:application')
  async subscribeApplication(
    @MessageBody() body: SubscribeApplicationDto,
    @ConnectedSocket() client: AuthedSocket,
  ): Promise<{ ok: boolean; room?: string; reason?: string }> {
    const user = client.data.user;
    if (!user) {
      throw new WsException('Not authenticated');
    }
    if (!body?.applicationId) {
      return { ok: false, reason: 'applicationId required' };
    }

    const app = await this.applicationRepo.findOne({
      where: { id: body.applicationId },
    });
    if (!app) {
      return { ok: false, reason: 'application_not_found' };
    }

    const isOwner =
      app.developerId === user.developerId || app.developerId === user.sub;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return { ok: false, reason: 'forbidden' };
    }

    const room = `application:${app.id}`;
    await client.join(room);
    return { ok: true, room };
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToDeveloper(
    developerId: string,
    event: string,
    payload: unknown,
  ): void {
    this.server.to(`developer:${developerId}`).emit(event, payload);
  }

  emitToApplication(
    applicationId: string,
    event: string,
    payload: unknown,
  ): void {
    this.server.to(`application:${applicationId}`).emit(event, payload);
  }

  private extractToken(client: AuthedSocket): string | null {
    const authToken = (client.handshake.auth as { token?: string } | undefined)
      ?.token;
    if (authToken) return authToken;
    const headerAuth = client.handshake.headers.authorization;
    if (headerAuth?.startsWith('Bearer ')) {
      return headerAuth.slice('Bearer '.length);
    }
    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string') return queryToken;
    return null;
  }
}
