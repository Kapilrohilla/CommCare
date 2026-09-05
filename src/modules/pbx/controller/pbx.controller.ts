import { Controller, Post } from '@nestjs/common';
import { ExtensionService } from '../services/extension.service';

@Controller('/pbx')
export class PbxController {
	constructor(private readonly extensionService: ExtensionService) {}

	/** Bulk-sync CommCare extensions → Asterisk PJSIP realtime tables (no reload). */
	@Post('/extensions/sync-asterisk')
	async syncExtensionsToAsterisk() {
		return this.extensionService.syncAllToAsterisk();
	}
}
