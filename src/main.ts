import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';



async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');


  // ValidationPipe:
  //   whitelist: strips properties not in the DTO (security)
  //   forbidNonWhitelisted: rejects requests with unknown fields
  //   transform: converts query/body strings to declared types (e.g. "3" → 3)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
  console.log(`🚀 BookSlot API running at http://localhost:${port}/api/v1`);
}

void bootstrap();
