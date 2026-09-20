import { Injectable } from '@nestjs/common';
import { UserStatus } from '../constants/user.constant';
import { UserEntity } from '../entity/user.entity';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class UserService {
	constructor(private readonly userRepository: UserRepository) {}

	findById(id: string): Promise<UserEntity | null> {
		return this.userRepository.findById(id);
	}

	createUser(name: string, tenantId: string | null = null): Promise<UserEntity> {
		return this.userRepository.create({
			name,
			tenantId,
			status: UserStatus.ACTIVE,
		});
	}

	assignTenant(user: UserEntity, tenantId: string): Promise<UserEntity> {
		user.tenantId = tenantId;
		return this.userRepository.save(user);
	}

	updateName(user: UserEntity, name: string): Promise<UserEntity> {
		user.name = name;
		return this.userRepository.save(user);
	}

	updateStatus(user: UserEntity, status: UserStatus): Promise<UserEntity> {
		user.status = status;
		return this.userRepository.save(user);
	}

	listByTenantId(tenantId: string): Promise<UserEntity[]> {
		return this.userRepository.findByTenantId(tenantId);
	}

	deleteUser(user: UserEntity): Promise<void> {
		return this.userRepository.deleteById(user.id);
	}
}
