import { Injectable } from '@nestjs/common';
import { Tenants } from '../entity/tenants.entity';
import { TenancyRepository } from '../repositories/tenancy.repository';

@Injectable()
export class TenancyService {
	constructor(private readonly tenancyRepository: TenancyRepository) {}

	findAll(): Promise<Tenants[]> {
		return this.tenancyRepository.findAll();
	}

	findById(id: string): Promise<Tenants | null> {
		return this.tenancyRepository.findById(id);
	}

	create(name: string): Promise<Tenants> {
		return this.tenancyRepository.create(name);
	}
}
