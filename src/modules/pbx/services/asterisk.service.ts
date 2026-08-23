import { Injectable } from "@nestjs/common";

@Injectable()
export class AsteriskService {
	private ami;
	private ari;

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
}