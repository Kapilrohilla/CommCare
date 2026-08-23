import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { CallsService } from "../services/calls.service";

/**
 * TODO: will complete it later as first service require to connect with PBX server
 */
@Controller('calls')
export class CallsController {
	constructor(private readonly callsService: CallsService) {}

	@Get('/')
	async getCalls() {
	}

	@Get("/:id")
	async getCallById(@Param('id') id: string) {
	}
	
	@Post("/")
	// async createCall(@Body() createCallDto: CreateCallDto) {
	// }

	@Put("/:id")
	// async updateCall(@Param('id') id: string, @Body() updateCallDto: UpdateCallDto) {
	// }

	@Delete("/:id")
	async deleteCall(@Param('id') id: string) {
	}
}