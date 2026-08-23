import { Global, Module } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';
import { TracingModule } from './tracing/tracing.module';

@Global()
@Module({
	imports: [MetricsModule, TracingModule],
	exports: [MetricsModule, TracingModule],
})
export class ObservabilityModule {}
