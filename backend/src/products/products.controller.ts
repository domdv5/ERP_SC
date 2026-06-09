import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from '@/products/products.service';
import { CreateProductDto, FindAllProductsDto, UpdateProductDto } from '@/products/dto/index';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { Permissions } from '@/common/decorators/permissions.decorator';
import type { RequestWithUser } from '@/common/types';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Permissions('product.read')
  findAll(@Query() findAllProductsDto: FindAllProductsDto) {
    return this.productsService.findAll(findAllProductsDto);
  }

  @Get(':id')
  @Permissions('product.read')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @Permissions('product.create')
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Patch(':id')
  @Permissions('product.update')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Permissions('product.delete')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.productsService.remove(id, req.user.sub);
  }
}
