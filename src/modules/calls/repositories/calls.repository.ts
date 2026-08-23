import { Injectable, NotFoundException } from "@nestjs/common";
import { CallsEntity } from "../entity/calls.entity";
import { BaseRepository } from "src/infra/database/connectors/baseRepository";

@Injectable()
export class CallsRepository {
	constructor(private readonly baseRepository: BaseRepository<CallsEntity>) {}

	async createCall(call: CallsEntity): Promise<CallsEntity> {
		return this.baseRepository.save(call);
	}

	async updateCall(call: CallsEntity): Promise<CallsEntity> {
		return this.baseRepository.save(call);
	}

	async deleteCall(id: string): Promise<void> {
		await this.baseRepository.delete(id);
	}

	async getCallById(id: string): Promise<CallsEntity> {
		const call = await this.baseRepository.findOne({ where: { id } });
		if (!call) {
			throw new NotFoundException('Call not found');
		}
		return call;
	}

	async getCalls(): Promise<CallsEntity[]> {
		return this.baseRepository.find();
	}
}