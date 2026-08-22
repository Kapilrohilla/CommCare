import { Injectable } from "@nestjs/common";
import { TenancyRepository } from "../repositories/tenancy.repository";

@Injectable()
export class TenancyService {
	constructor(private readonly tenancyRepository: TenancyRepository) {}

	// async createTenancy(createTenancyDto: CreateTenancyDto) {
	// 	return this.tenancyRepository.createTenancy(createTenancyDto);
	// }

	// async getTenancies() {
	// 	return this.tenancyRepository.getTenancies();
	// }

	// async updateTenancy(id: string, updateTenancyDto: UpdateTenancyDto) {
	// 	return this.tenancyRepository.updateTenancy(id, updateTenancyDto);
	// }

	// async deleteTenancy(id: string) {
	// 	return this.tenancyRepository.deleteTenancy(id);
	// }
}