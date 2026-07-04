import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface ControlJwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class ControlJwtStrategy extends PassportStrategy(Strategy, 'control-jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.CONTROL_JWT_SECRET || 'control-jwt-fallback-secret',
    });
  }

  validate(payload: ControlJwtPayload) {
    return { id: payload.sub, username: payload.username };
  }
}
