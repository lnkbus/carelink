import { Global, Module } from '@nestjs/common';
import { TracksController } from './controller/tracks.controller';
import { TracksRepository } from './repository/tracks.repository';
import { TracksService } from './service/tracks.service';

/**
 * tracks — 산업·트랙·요구사항·가중치·비자 적격성.
 * talent·matching·quality가 모두 참조하므로 @Global로 둔다.
 */
@Global()
@Module({
  controllers: [TracksController],
  providers: [TracksRepository, TracksService],
  exports: [TracksService],
})
export class TracksModule {}
