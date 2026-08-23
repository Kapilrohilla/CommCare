import { Injectable, NotFoundException } from "@nestjs/common";
import { CallEntity } from "../entity/calls.entity";
import { BaseRepository } from "src/infra/database/connectors/baseRepository";

@Injectable()
export class CallsRepository {
	constructor(private readonly baseRepository: BaseRepository<CallEntity>) {}

	async createCall(call: CallEntity): Promise<CallEntity> {
		return this.baseRepository.save(call);
	}

	async updateCall(call: CallEntity): Promise<CallEntity> {
		return this.baseRepository.save(call);
	}

	async deleteCall(id: string): Promise<void> {
		await this.baseRepository.delete(id);
	}

	async getCallById(id: string): Promise<CallEntity> {
		const call = await this.baseRepository.findOne({ where: { id } });
		if (!call) {
			throw new NotFoundException('Call not found');
		}
		return call;
	}

	async getCalls(): Promise<CallEntity[]> {
		return this.baseRepository.find();
	}
}