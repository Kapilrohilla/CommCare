import { Injectable } from "@nestjs/common";
import { CallsRepository } from "../repositories/calls.repository";
import { CallsEntity } from "../entity/calls.entity";

@Injectable()
export class CallsService {
	constructor(private readonly callsRepository: CallsRepository) {}

	async getCalls(): Promise<CallsEntity[]> {
		return this.callsRepository.getCalls();
	}

	async getCallById(id: string): Promise<CallsEntity> {
		return this.callsRepository.getCallById(id);
	}

	async createCall(call: CallsEntity): Promise<CallsEntity> {
		return this.callsRepository.createCall(call);
	}
}