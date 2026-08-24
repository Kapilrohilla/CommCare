import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TOKEN_TYPE } from 'src/constants/tokenConstants';
import { DatabaseModule } from 'src/infra/database/connectors/typeORM';
import { RedisModule } from 'src/infra/redis/redis.module';
import { TenancyModule } from 'src/modules/tenancy/tenancy.module';
import {
	AccessTokenGuard,
	RefreshTokenGuard,
	VisitorTokenGuard,
} from 'src/shared/guards/jwt-auth.guard';
import { JwtService } from 'src/shared/utils/services/jwt.service';
import { AuthController } from './controllers/auth.controller';
import { AuthEventEntity } from './entity/auth-event.entity';
import { IdentityEntity } from './entity/identity.entity';
import { SessionEntity } from './entity/session.entity';
import { UserEntity } from './entity/user.entity';
import { VisitorEntity } from './entity/visitor.entity';
import { AuthEventRepository } from './repositories/auth-event.repository';
import { IdentityRepository } from './repositories/identity.repository';
import { SessionRepository } from './repositories/session.repository';
import { UserRepository } from './repositories/user.repository';
import { VisitorRepository } from './repositories/visitor.repository';
import { AuthEventService } from './services/auth-event.service';
import { AuthService } from './services/auth.service';
import { IdentityService } from './services/identity.service';
import { OtpService } from './services/otp.service';
import { SessionService } from './services/session.service';
import { UserService } from './services/user.service';
import { VisitorService } from './services/visitor.service';
import {
	AccessTokenStrategy,
	RefreshTokenStrategy,
	VisitorTokenStrategy,
} from './strategies/jwt.strategy';

@Module({
	imports: [
		PassportModule.register({ defaultStrategy: TOKEN_TYPE.ACCESS }),
		DatabaseModule.forFeature([
			VisitorEntity,
			IdentityEntity,
			UserEntity,
			SessionEntity,
			AuthEventEntity,
		]),
		RedisModule,
		TenancyModule,
	],
	controllers: [AuthController],
	providers: [
		JwtService,
		AccessTokenStrategy,
		RefreshTokenStrategy,
		VisitorTokenStrategy,
		AccessTokenGuard,
		RefreshTokenGuard,
		VisitorTokenGuard,
		VisitorRepository,
		IdentityRepository,
		UserRepository,
		SessionRepository,
		AuthEventRepository,
		VisitorService,
		IdentityService,
		UserService,
		SessionService,
		AuthEventService,
		OtpService,
		AuthService,
	],
	exports: [
		AuthService,
		JwtService,
		AccessTokenGuard,
		RefreshTokenGuard,
		VisitorTokenGuard,
	],
})
export class IamModule {}
