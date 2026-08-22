class ResponseService {

	public static async success(message: string, data: any): Promise<any> {
		return {
			message: message,
			data: data,
			timestamp: new Date().toISOString(),
		};
	}

	public static async error(message: string): Promise<any> {
		return {
			message: message,
			timestamp: new Date().toISOString()
		};
	};

	public static async validationError(message: string): Promise<any> {
		return {
			message: message,
			timestamp: new Date().toISOString()
		};
	}
};

export default ResponseService;