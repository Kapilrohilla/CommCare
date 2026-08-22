import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { TenancyService } from "../services/tenancy.service";

@Controller('tenancy')
export class TenancyController {
	constructor(private readonly tenancyService: TenancyService) {}

	// @Post()
	// async createTenancy(@Body() createTenancyDto: CreateTenancyDto) {
	// 	return this.tenancyService.createTenancy(createTenancyDto);
	// }

	// @Get()
	// async getTenancies() {
	// 	return this.tenancyService.getTenancies();
	// }

	// @Put(':id')
	// async updateTenancy(@Param('id') id: string, @Body() updateTenancyDto: UpdateTenancyDto) {
	// 	return this.tenancyService.updateTenancy(id, updateTenancyDto);
	// }

	// @Delete(':id')
	// async deleteTenancy(@Param('id') id: string) {
	// 	return this.tenancyService.deleteTenancy(id);
	// }
}