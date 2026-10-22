import { Controller, Get, Param } from '@nestjs/common';
import { LocationsService } from './locations.service';

// Catálogo de solo lectura: basta con estar autenticado, sin permiso propio
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('departments')
  findDepartments() {
    return this.locationsService.findDepartments();
  }

  @Get('departments/:code/cities')
  findCities(@Param('code') code: string) {
    return this.locationsService.findCities(code);
  }
}
