import { Injectable } from "@nestjs/common";
import { AsteriskService } from "src/modules/pbx/services/asterisk.service";
import { env as envConfig } from '../../../config/env.config';
@Injectable()
export class AsteriskHealthService {
	constructor(private readonly asteriskService: AsteriskService){}

	async healthCheckAsterisk(): Promise<unknown>{
		const host = envConfig.ARI_HOST;
		const username = envConfig.ARI_USER;
		const password = envConfig.ARI_PASSWORD;
		return await this.asteriskService.healthCheckAsterisk(host,username,password);
	}
}