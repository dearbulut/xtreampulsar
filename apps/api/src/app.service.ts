import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRoot(): { name: string; version: string } {
    return { name: 'XtreamPulsar API', version: '0.0.1' };
  }
}
