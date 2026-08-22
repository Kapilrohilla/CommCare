import { ObjectLiteral, Repository } from 'typeorm';

export class BaseRepository<T extends ObjectLiteral> extends Repository<T> {
	constructor(repository: Repository<T>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
