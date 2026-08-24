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
}
