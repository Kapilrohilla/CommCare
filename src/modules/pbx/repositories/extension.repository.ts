import { BaseRepository } from "src/infra/database/connectors/baseRepository";
import { Extension } from "../entity/extension.entity";

export class ExtensionRepository{
	constructor(
		private readonly extensionRepository: BaseRepository<Extension>
	){}


	async createExtension(extension: Extension): Promise<Extension> {
		return await this.extensionRepository.create(extension);
	}

	async getExtension(id: string): Promise<Extension | null> {
		return await this.extensionRepository.findOne({ where: { id } });
	}

	async updateExtension(id: string, extension: Extension): Promise<Extension | null> {
		return await this.extensionRepository.save(extension);
	}

	async deleteExtension(id: string): Promise<void> {
		await this.extensionRepository.delete(id);
	}

	async getExtensionsByTenantId(tenantId: string): Promise<Extension[]> {
		return await this.extensionRepository.find({ where: { tenantId } });
	}

	
}