import { Injectable } from "@nestjs/common";

@Injectable()
export class HealthCheckService {
	constructor(){}

	public health(){
		return {}
	}

	public liveZ(){
		return {}
	}

	public readyZ(){
		return {}
	}
}