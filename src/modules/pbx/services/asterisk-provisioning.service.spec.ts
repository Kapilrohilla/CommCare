import { AsteriskProvisioningService } from './asterisk-provisioning.service';
import { Extension } from '../entity/extension.entity';
import { ExtensionStatus } from '../constants/extension.constant';

describe('AsteriskProvisioningService', () => {
	const pjsipRealtimeRepository = {
		upsertExtension: jest.fn(),
		deleteExtension: jest.fn(),
	};

	const extensionRepository = {
		getExtensions: jest.fn(),
	};

	let service: AsteriskProvisioningService;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new AsteriskProvisioningService(
			pjsipRealtimeRepository as never,
			extensionRepository as never,
		);
	});

	const sampleExtension = (): Extension => {
		const extension = new Extension();
		extension.id = 'ext-1';
		extension.extension = '101';
		extension.pjsipUsername = '101';
		extension.pjsipPassword = 'secret101';
		extension.callerIdName = 'Agent One';
		extension.status = ExtensionStatus.RESERVED;
		return extension;
	};

	it('upserts ps_* rows on provision', async () => {
		const extension = sampleExtension();
		await service.provisionExtension(extension);

		expect(pjsipRealtimeRepository.upsertExtension).toHaveBeenCalledWith(extension);
	});

	it('deletes ps_* rows on delete', async () => {
		await service.deleteExtension('101');
		expect(pjsipRealtimeRepository.deleteExtension).toHaveBeenCalledWith('101');
	});

	it('bulk syncs all extensions', async () => {
		extensionRepository.getExtensions.mockResolvedValue([
			sampleExtension(),
			{ ...sampleExtension(), extension: '102', id: 'ext-2' },
		]);

		const result = await service.syncAllExtensions();

		expect(result).toEqual({ synced: 2, errors: 0 });
		expect(pjsipRealtimeRepository.upsertExtension).toHaveBeenCalledTimes(2);
	});
});
