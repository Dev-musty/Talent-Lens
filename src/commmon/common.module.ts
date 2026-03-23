import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envs } from './config/config';
import { validate } from './config/env-validate';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envs],
      validate,
    }),
  ],
})
export class CommonModule {}
