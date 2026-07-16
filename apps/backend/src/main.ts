import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { resolveCorsOrigin, validateProductionEnvironment } from './config/environment.js';
import { AppModule } from './modules/app.module.js';

const port = Number(process.env.BACKEND_PORT ?? 3000);

async function bootstrap() {
  validateProductionEnvironment();
  const app = await NestFactory.create(AppModule, { cors: { origin: resolveCorsOrigin() } });
  await app.listen(port);
}

void bootstrap();
