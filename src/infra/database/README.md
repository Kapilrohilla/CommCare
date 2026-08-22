# Database

PostgreSQL infrastructure with TypeORM reader/writer connections.

## Structure

```
database/
├── connectors/
│   ├── baseRepository.ts   # BaseRepository extending TypeORM Repository
│   └── typeORM.ts          # NestJS DatabaseModule + repository providers
├── migrations/             # TypeORM migration files
├── postgresql/
│   ├── postgresqlConfig.ts # Connection config from env
│   └── postgresqlService.ts # Connection lifecycle (init/destroy)
├── dataSource.ts           # DataSource options + entity auto-load
└── README.md
```

## Usage

Register in `AppModule`:

```typescript
DatabaseModule.forRoot()
```

Register entities in feature modules:

```typescript
DatabaseModule.forFeature([YourEntity])
```

Inject repositories:

```typescript
constructor(
  @InjectRepository(YourEntity, DB_CONNECTION_WRITER)
  private readonly writerRepository: BaseRepository<YourEntity>,
  @InjectRepository(YourEntity, DB_CONNECTION_READER)
  private readonly readerRepository: BaseRepository<YourEntity>,
) {}
```

Entities are auto-loaded from `src/**/*.entity.ts`.
