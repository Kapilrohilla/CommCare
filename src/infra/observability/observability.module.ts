import { Global, Module } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';

@Global()
@Module({
	imports: [MetricsModule],
	exports: [MetricsModule],
})
export class ObservabilityModule {}
