import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, _: Response, next: NextFunction) {
    const info =
      req.method +
      ' ' +
      req.url +
      '   ' +
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    console.log('API HIT -------------->', info, '\n|\nv\n|\nv\n');
    console.log('Request body :- ', req.body);
    console.log('Request query :- ', req.query);
    console.log('Request params :- ', req.params);
    next();
  }
}
