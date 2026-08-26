import { Injectable } from '@nestjs/common';
import { JwtService } from 'src/shared/utils/services/jwt.service';
import { CreateVisitorInput } from '../dto/auth.dto';
import { VisitorRepository } from '../repositories/visitor.repository';
import { VisitorEntity } from '../entity/visitor.entity';

@Injectable()
export class VisitorService {
	constructor(
		private readonly visitorRepository: VisitorRepository,
		private readonly jwtService: JwtService,
	) {}

	async createOrUpdateVisitor(dto: CreateVisitorInput): Promise<{ visitor: VisitorEntity; visitorToken: string }> {
		const visitor = await this.visitorRepository.upsert({
			identifier: dto.identifier,
			identifierType: dto.identifierType,
			appType: dto.appType,
			userAgent: dto.userAgent ?? null,
			metadata: dto.metadata ?? null,
		});
		const visitorToken = await this.jwtService.generateVisitorToken(visitor.id);
		return { visitor, visitorToken };
	}

	async getVisitorById(id: string): Promise<VisitorEntity | null> {
		return this.visitorRepository.findById(id);
	}
}
