import { Extension } from "../entity/extension.entity";
import { ExtensionRepository } from "../repositories/extension.repository";

export class ExtensionService {
	constructor(
		private readonly extensionRepository: ExtensionRepository,
	) {}



	async createExtension(extension: Extension): Promise<Extension> {
		return await this.extensionRepository.createExtension(extension);
	}

	async getExtension(id: string): Promise<Extension | null> {
		return await this.extensionRepository.getExtension(id);
	}

	async updateExtension(id: string, extension: Extension): Promise<Extension | null> {
		return await this.extensionRepository.updateExtension(id, extension);
	}

	async deleteExtension(id: string): Promise<void> {
		await this.extensionRepository.deleteExtension(id);
	}

	async getExtensionsByTenantId(tenantId: string): Promise<Extension[]> {
		return await this.extensionRepository.getExtensionsByTenantId(tenantId);
	}
}