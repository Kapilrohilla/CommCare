import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

@Injectable()
export class ClsService {
	private readonly storage = new AsyncLocalStorage<Map<string, unknown>>();

	run<T>(fn: () => Promise<T>): Promise<T> {
		return this.storage.run(new Map(), fn);
	}

	set(key: string, value: unknown): void {
		this.storage.getStore()?.set(key, value);
	}

	get<T>(key: string): T | undefined {
		return this.storage.getStore()?.get(key) as T | undefined;
	}
}
