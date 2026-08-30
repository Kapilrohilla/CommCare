import { Injectable } from '@nestjs/common';
import { IVROptionEntity } from '../entity/ivr-options.entity';
import { IVROptionsRepository } from '../repository/ivr-options.repository';

@Injectable()
export class IVROptionsService {
	constructor(private readonly ivrOptionsRepository: IVROptionsRepository) {}

	create(option: IVROptionEntity): Promise<IVROptionEntity> {
		return this.ivrOptionsRepository.create(option);
	}

	save(option: IVROptionEntity): Promise<IVROptionEntity> {
		return this.ivrOptionsRepository.save(option);
	}

	delete(id: string): Promise<void> {
		return this.ivrOptionsRepository.delete(id);
	}

	deleteByIvrId(ivrId: string): Promise<void> {
		return this.ivrOptionsRepository.deleteByIvrId(ivrId);
	}

	getByIdAndIvrId(id: string, ivrId: string): Promise<IVROptionEntity | null> {
		return this.ivrOptionsRepository.getByIdAndIvrId(id, ivrId);
	}

	getByIvrId(ivrId: string): Promise<IVROptionEntity[]> {
		return this.ivrOptionsRepository.getByIvrId(ivrId);
	}

	getByIvrIdAndDigit(ivrId: string, digit: string): Promise<IVROptionEntity | null> {
		return this.ivrOptionsRepository.getByIvrIdAndDigit(ivrId, digit);
	}
}
