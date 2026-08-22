class ResponseService {

	async success(message: string, statusCode: number,data: any): Promise<any> {
		return {
			statusCode,
			data: {
				message: message,
				data: data,
				timestamp: new Date().toISOString(),
			},
		};
	}

	async error(message: string, statusCode: number): Promise<any> {
		return {
			statusCode,
			error: {
				message: message,
				timestamp: new Date().toISOString()
			},
		};
	};

	async validationError(message: string, statusCode: number): Promise<any> {
		return {
			statusCode,
			error: {
				message: message,
				timestamp: new Date().toISOString()
			},
		};
	}
};

export default ResponseService;