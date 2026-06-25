import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AuthService } from '@/auth/auth.service';
import { CreateAuthDto, UpdateAuthDto, LoginAuthDto } from '@/auth/dto/index';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @Permissions('user.manage')
  findAll() {
    return this.authService.findAll();
  }

  @Get('roles')
  @Permissions('user.manage')
  findAllRoles() {
    return this.authService.findAllRoles();
  }

  @Post()
  @Permissions('user.manage')
  create(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.create(createAuthDto);
  }

  @Public()
  @Post('login')
  login(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.login(loginAuthDto);
  }

  @Patch(':id')
  @Permissions('user.manage')
  update(@Param('id') id: string, @Body() updateAuthDto: UpdateAuthDto) {
    return this.authService.update(id, updateAuthDto);
  }

  @Delete(':id')
  @Permissions('user.manage')
  remove(@Param('id') id: string) {
    return this.authService.remove(id);
  }
}
