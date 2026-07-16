import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { PosService } from './pos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CreatePosTerminalDto } from './dto/create-pos-terminal.dto';
import { UpdatePosTerminalDto } from './dto/update-pos-terminal.dto';
import { PosTerminal } from './entities/pos-terminal.entity';

@ApiTags('POS Terminals')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('pos/terminals')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get()
  @ApiOperation({ summary: 'List all POS terminals for the branch' })
  @ApiResponse({ status: 200, description: 'Array of POS terminals.', type: [PosTerminal] })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(@Request() req: any) {
    return this.posService.findAllByBranch(req.user.branchId);
  }

  @Get('active')
  @ApiOperation({ summary: 'List active POS terminals for the branch (waiter dropdown)' })
  @ApiResponse({ status: 200, description: 'Array of active POS terminals.', type: [PosTerminal] })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findActive(@Request() req: any) {
    return this.posService.findActiveByBranch(req.user.branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single POS terminal by ID' })
  @ApiParam({ name: 'id', description: 'POS Terminal UUID' })
  @ApiResponse({ status: 200, description: 'POS terminal record.', type: PosTerminal })
  @ApiResponse({ status: 404, description: 'POS terminal not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.posService.findOne(id, req.user.branchId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a POS terminal (Owner/Manager only)' })
  @ApiResponse({ status: 201, description: 'POS terminal created.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async create(@Request() req: any, @Body() createDto: CreatePosTerminalDto) {
    return this.posService.create(req.user.branchId, createDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a POS terminal (Owner/Manager only)' })
  @ApiParam({ name: 'id', description: 'POS Terminal UUID' })
  @ApiResponse({ status: 200, description: 'POS terminal updated.' })
  @ApiResponse({ status: 404, description: 'POS terminal not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async update(@Param('id') id: string, @Request() req: any, @Body() updateDto: UpdatePosTerminalDto) {
    return this.posService.update(id, req.user.branchId, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a POS terminal (Owner/Manager only)' })
  @ApiParam({ name: 'id', description: 'POS Terminal UUID' })
  @ApiResponse({ status: 200, description: 'POS terminal deleted.' })
  @ApiResponse({ status: 404, description: 'POS terminal not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.posService.remove(id, req.user.branchId);
  }
}
