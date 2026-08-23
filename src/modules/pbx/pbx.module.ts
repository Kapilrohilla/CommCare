import { ConsoleLogger, Module } from '@nestjs/common';
import { PbxService } from './services/pbx.service';
import { AsteriskService } from './services/asterisk.service';
import { PbxController } from './controller/pbx.controller';
import { AsteriskController } from './controller/asterisk.controller';
import { AsteriskCDRService } from './services/asterisk-cdr.service';
import { CallsModule } from '../calls/calls.module';
import { EventProducer } from 'src/infra/queue/services/event-producer.service';
import { QueueModule } from 'src/infra/queue/queue.module';
import { KafkaProducerService } from 'src/infra/kafka/services/kafka-producer.service';

@Module({
	imports: [CallsModule , QueueModule],
	controllers: [PbxController, AsteriskController],
	providers: [PbxService, AsteriskService, AsteriskCDRService, ConsoleLogger, EventProducer, KafkaProducerService]
})
export class PbxModule {}
