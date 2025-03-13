import { Injectable, NestInterceptor, ExecutionContext, CallHandler, UnauthorizedException, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';
import { Keycloak } from 'keycloak-connect';
import { ConfigService } from '@nestjs/config';

interface DecodedToken {
  clientId: string;
  sub: string;
  [key: string]: any;
}

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  constructor(
    @Inject('KeycloakInstance') private readonly keycloak: Keycloak,
    private readonly configService: ConfigService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const grpcContext = context.switchToRpc().getContext();
    const metadata: Metadata = grpcContext.getMetadata();
    const token = metadata.get('authorization')?.[0] as string;

    if (!token) {
      throw new UnauthorizedException('No authorization token provided');
    }

    const tokenValue = token.startsWith('Bearer ') ? token.split(' ')[1] : token;

    try {
      const isValid = await this.validateToken(tokenValue);
      if (!isValid) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      const decoded = await this.keycloak.grantManager.validateAccessToken(tokenValue);
      if (typeof decoded === 'string') {
        const parsedToken: DecodedToken = JSON.parse(decoded);
        grpcContext['user'] = parsedToken;
      } else {
        throw new UnauthorizedException('Token validation returned invalid result');
      }

      return next.handle();
    } catch (error) {
      throw new UnauthorizedException('Token validation failed: ' + error.message);
    }
  }

  private async validateToken(token: string): Promise<boolean> {
    const authServerUrl = this.configService.get<string>('KEYCLOAK_URL') || 'http://localhost:8080';
    const realm = this.configService.get<string>('KEYCLOAK_REALM') || 'FanClubRealm';
    const clientId = this.configService.get<string>('KEYCLOAK_CLIENT_ID') || 'fanclub-user-membership';

    try {
      const decoded = await this.keycloak.grantManager.validateAccessToken(token);
      if (typeof decoded === 'string') {
        const parsedToken: DecodedToken = JSON.parse(decoded);
        return parsedToken.clientId === clientId;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}