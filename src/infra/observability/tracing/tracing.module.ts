import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpTransactionInterceptor } from '../interceptors/http-transaction.interceptor';

@Module({
	providers: [
		{
			provide: APP_INTERCEPTOR,
			useClass: HttpTransactionInterceptor,
		},
	],
})
export class TracingModule {}
