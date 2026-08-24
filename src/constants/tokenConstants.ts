export const TOKEN_TYPE = {
	ACCESS: 'access',
	REFRESH: 'refresh',
	VISITOR: 'visitor',
} as const;

export type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];
