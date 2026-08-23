import { Body, Controller, Delete, Get, NotFoundException, Param, Put, Query } from '@nestjs/common';
import ResponseService from '../../../shared/utils/services/response.service';
import { RedisService } from '../services/redis.service';
import { RawKeyQueryDto, RawKeySetDto } from '../validators/redisValidators';

@Controller('redis')
export class RedisController {
	constructor(private readonly redisService: RedisService) {}

	@Get('raw')
	async getRawKey(@Query() query: RawKeyQueryDto) {
		const redisKey = this.resolveRawKey(query);
		const result = await this.redisService.getRawKey(redisKey);
		if (result === null) {
			throw new NotFoundException('Key not found');
		}
		return ResponseService.success('Key retrieved', { key: result.resolvedKey, value: result.value });
	}

	@Put('raw')
	async setRawKey(@Query() query: RawKeyQueryDto, @Body() body: RawKeySetDto) {
		const redisKey = this.resolveRawKey(query);
		await this.redisService.setRawKey(redisKey, body.value, body.ttl);
		return ResponseService.success('Key set successfully', { key: redisKey });
	}

	@Delete('raw')
	async deleteRawKey(@Query() query: RawKeyQueryDto) {
		const redisKey = this.resolveRawKey(query);
		const deleted = await this.redisService.deleteRawKey(redisKey);
		return ResponseService.success('Key deleted', { key: redisKey, deleted });
	}

	private resolveRawKey(query: RawKeyQueryDto): string {
		return query.cacheName ? `${query.cacheName}_${query.key}` : query.key;
	}

	@Get(':cacheName/:key')
	async getKey(@Param('cacheName') cacheName: string, @Param('key') key: string) {
		const value = await this.redisService.getKey(cacheName, key);
		if (value === null) {
			throw new NotFoundException('Key not found');
		}
		return ResponseService.success('Key retrieved', { cacheName, key, value });
	}

	@Put(':cacheName/:key')
	async setKey(
		@Param('cacheName') cacheName: string,
		@Param('key') key: string,
		@Body() body: { value: unknown; ttl?: number },
	) {
		await this.redisService.setKey(cacheName, key, body.value, body.ttl);
		return ResponseService.success('Key set successfully', { cacheName, key });
	}

	@Delete(':cacheName/:key')
	async deleteKey(@Param('cacheName') cacheName: string, @Param('key') key: string) {
		const deleted = await this.redisService.deleteKey(cacheName, key);
		return ResponseService.success('Key deleted', { cacheName, key, deleted });
	}
}
