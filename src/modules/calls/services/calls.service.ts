import { Injectable } from "@nestjs/common";
import { CallsRepository } from "../repositories/calls.repository";
import { CallEntity } from "../entity/calls.entity";

@Injectable()
export class CallsService {
	constructor(private readonly callsRepository: CallsRepository) {}

	async getCalls(): Promise<CallEntity[]> {
		return this.callsRepository.getCalls();
	}

	async getCallById(id: string): Promise<CallEntity> {
		return this.callsRepository.getCallById(id);
	}

	async createCall(call: CallEntity): Promise<CallEntity> {
		return this.callsRepository.createCall(call);
	}
}