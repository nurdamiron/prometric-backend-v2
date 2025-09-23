import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './controllers/ai.controller';
import { AiService } from './services/ai.service';
import { User, Organization } from '../auth/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization]),
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}