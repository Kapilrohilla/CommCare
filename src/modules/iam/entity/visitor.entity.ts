
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { SessionEntity } from "./session.entity";
export class VisitorEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    identifier!: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    identifierType!: 'deviceId' | 'uuid';

	@CreateDateColumn()
	firstSeenAt!: Date;

	@UpdateDateColumn()
	lastSeenAt!: Date;

	@Column({ type: 'varchar', length: 255, nullable: false })
	appType!: 'drivePortal' | 'driveApp';
	
	@Column({ type: 'text', nullable: true })
	userAgent!: string | null;

	@Column({ type: 'json', nullable: true })
	metadata!: Record<string, any> | null;

	@OneToMany(() => SessionEntity, (session) => session.visitor)
	@JoinColumn({ name: 'visitor_id' })
	sessions!: SessionEntity[];
}
// class Visitor(Base):
//     __tablename__ = "visitors"
//     __table_args__ = (
//         UniqueConstraint("identifier_type", "identifier_value", name="uix_visitor_identifier"),
//     )

//     identifier_type: Mapped[str] = mapped_column(String(100), nullable=False)
//     identifier_value: Mapped[str] = mapped_column(String(100), nullable=False)

//     first_seen_at: Mapped[datetime] = mapped_column(
//         DateTime(timezone=True),
//         server_default=func.now(),
//     )

//     last_seen_at: Mapped[datetime] = mapped_column(
//         DateTime(timezone=True),
//         server_default=func.now(),
//         onupdate=func.now(),
//     )

//     app_type: Mapped[VisitorAppType] = mapped_column(
//         SQLEnum(
//             VisitorAppType,
//             name="visitor_app_type",
//             values_callable=lambda enum: [member.value for member in enum],
//         ),
//         nullable=False,
//         default=VisitorAppType.DRIVE_PORTAL,
//     )

//     user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

//     metadata_json: Mapped[dict[str, Any] | None] = mapped_column(
//         "metadata",
//         JSON(none_as_null=True),
//         nullable=True,
//     )

//     sessions = relationship("Session", back_populates="visitor")