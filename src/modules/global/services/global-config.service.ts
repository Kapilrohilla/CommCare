import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { RedisService } from 'src/infra/redis/services/redis.service';
import { GLOBAL_CONFIG_CACHE } from '../constants/global-config.constant';
import {
	CreateGlobalConfigDto,
	UpdateGlobalConfigDto,
} from '../dto/global-config.dto';
import { GlobalConfig } from '../entity/global-config.entity';
import { GlobalConfigRepository } from '../repositories/global-config.repository';

interface GetKeyOrDefaultValueParams<T> {
	key: string;
	default: T;
}

@Injectable()
export class GlobalConfigService {
	private readonly logger = new Logger(GlobalConfigService.name);

	constructor(
		private readonly globalConfigRepository: GlobalConfigRepository,
		private readonly redisService: RedisService,
	) {}

	async create(dto: CreateGlobalConfigDto): Promise<GlobalConfig> {
		const existing = await this.globalConfigRepository.getByKey(dto.key);
		if (existing) {
			throw new ConflictException(`Config with key '${dto.key}' already exists`);
		}

		const config = new GlobalConfig();
		config.key = dto.key;
		config.value = dto.value;
		config.description = dto.description ?? null;

		const saved = await this.globalConfigRepository.create(config);
		await this.cacheConfig(saved);
		return saved;
	}

	async findAll(): Promise<GlobalConfig[]> {
		return this.globalConfigRepository.getAll();
	}

	async findById(id: string): Promise<GlobalConfig> {
		const cached = await this.redisService.getKey<GlobalConfig>(
			GLOBAL_CONFIG_CACHE.BY_ID,
			id,
		);
		if (cached) {
			return cached;
		}

		const config = await this.globalConfigRepository.getById(id);
		if (!config) {
			throw new NotFoundException(`Config with id '${id}' not found`);
		}

		await this.cacheConfig(config);
		return config;
	}

	async findByKey(key: string): Promise<GlobalConfig | null> {
		const cached = await this.redisService.getKey<GlobalConfig>(
			GLOBAL_CONFIG_CACHE.BY_KEY,
			key,
		);
		if (cached) {
			return cached;
		}

		const config = await this.globalConfigRepository.getByKey(key);
		if (config) {
			await this.cacheConfig(config);
		}
		return config;
	}

	async update(id: string, dto: UpdateGlobalConfigDto): Promise<GlobalConfig> {
		const config = await this.findById(id);
		const previousKey = config.key;

		if (dto.key && dto.key !== config.key) {
			const existing = await this.globalConfigRepository.getByKey(dto.key);
			if (existing) {
				throw new ConflictException(`Config with key '${dto.key}' already exists`);
			}
		}

		if (dto.key !== undefined) {
			config.key = dto.key;
		}
		if (dto.value !== undefined) {
			config.value = dto.value;
		}
		if (dto.description !== undefined) {
			config.description = dto.description;
		}

		const saved = await this.globalConfigRepository.save(config);

		if (dto.key && dto.key !== previousKey) {
			await this.redisService.deleteKey(GLOBAL_CONFIG_CACHE.BY_KEY, previousKey);
		}
		await this.cacheConfig(saved);
		return saved;
	}

	async delete(id: string): Promise<void> {
		const config = await this.findById(id);
		await this.globalConfigRepository.delete(id);
		await this.redisService.deleteKey(GLOBAL_CONFIG_CACHE.BY_ID, id);
		await this.redisService.deleteKey(GLOBAL_CONFIG_CACHE.BY_KEY, config.key);
	}

	async getKeyOrDefaultValue<T>(params: GetKeyOrDefaultValueParams<T>): Promise<T> {
		try {
			const config = await this.findByKey(params.key);
			if (config?.value !== undefined && config.value !== null) {
				return config.value as T;
			}
		} catch (error) {
			this.logger.error(`Failed to fetch ${params.key} config`, error);
		}
		return params.default;
	}

	private async cacheConfig(config: GlobalConfig): Promise<void> {
		await this.redisService.setKey(GLOBAL_CONFIG_CACHE.BY_ID, config.id, config);
		await this.redisService.setKey(GLOBAL_CONFIG_CACHE.BY_KEY, config.key, config);
	}
}
