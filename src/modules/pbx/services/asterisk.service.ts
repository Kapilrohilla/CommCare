import { Injectable, Logger } from "@nestjs/common";
import { RequestClient } from "../../../shared/utils/services/request.service";
import {env as envConfig} from '../../../config/env.config';
@Injectable()
export class AsteriskService {
	private ami;
	private ari;
	private ariBaseUrl :string | null= null
	constructor(private readonly requestClient: RequestClient, private readonly logger: Logger){
		this.ariBaseUrl = envConfig.ARI_HOST
	}

	async onModuleInit() {
		await this.connectAMI();
		await this.connectARI();
	}

	async connectAMI(){
		// code to connect to AMI
	}

	async connectARI(){
		// code to connect to ARI
	}

	async disconnectAMI(){
		// code to disconnect from AMI
	}

	async disconnectARI(){
		// code to disconnect from ARI
	}

	async reconnectAMI(){
		// code to reconnect to AMI
	}
	
	async reconnectARI(){
		// code to reconnect to ARI
	}

	async listenToEvents(){
		// code to listen to events
	}

	async originate(){
		// code to originate a call
	}
	
	async hangup(){
		// code to hang up a call
	}
	
	async bridge(){
		// code to bridge a call
	}

	async createExtension(): Promise<void>{
		// code to create an extension
	}

	private getToken(username: string, password: string): string{
		return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
	}

	async healthCheckAsterisk(host: string,username: string, password: string): Promise<unknown>{
		const url = `${this.ariBaseUrl}/ari/asterisk/ping`;
		this.logger.log("ARI Base URL: ", this.ariBaseUrl)
		const token = this.getToken(username, password);
		this.logger.log(`Host: ${host} Username: ${username} Password: ${password}`)
		this.logger.log(`Health Check Asterisk: ${url} with token: ${token}`)
		return await this.requestClient.hitRequest({
			method: 'GET',
			url,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': this.getToken(username, password)
			}
		})
	}

	/**
	 * Create an ARI application
	 */
	async createAriApplication(){
	}
}