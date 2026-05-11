import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DataPackagesService } from './data-packages.service';
import { CreatePackageDto, ListPackagesDto } from './dto';
import { DataPackage } from './entities/data-package.entity';

@ApiTags('Packages')
@Controller('v1/packages')
export class DataPackagesController {
  constructor(private readonly packagesService: DataPackagesService) {}

  // ---------------------------------------------------------------------------
  // Public / authed reads
  // ---------------------------------------------------------------------------

  @Public()
  @Get()
  @ApiOperation({ summary: 'List certified packages (public marketplace)' })
  async list(@Query() query: ListPackagesDto) {
    return this.packagesService.listPublic(query);
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my packages (developer)' })
  async listMine(@CurrentUser() user: CurrentUserData) {
    return this.packagesService.listMine(user.id);
  }

  @Get('purchases')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my purchases (buyer)' })
  async listMyPurchases(@CurrentUser() user: CurrentUserData) {
    return this.packagesService.listMyPurchases(user.id);
  }

  @Get('admin/all')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List ALL packages (admin)' })
  async listAll() {
    return this.packagesService.listAll();
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get package by id (any authed user sees certified; owner/admin see all)',
  })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<DataPackage> {
    return this.packagesService.findOnePublic(id, user);
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  @Post()
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.DEVELOPER, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a new data package (developer)' })
  @ApiResponse({ status: 201, description: 'Package accepted, evaluation queued' })
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreatePackageDto,
  ) {
    const pkg = await this.packagesService.create(user.id, dto);
    return { id: pkg.id, status: pkg.status };
  }

  @Post(':id/purchase')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  // Buyers, end-users, admins, and developers (who may cross-purchase from
  // other developers during demos) are all permitted. Self-purchase is
  // blocked at the service layer.
  @Roles(Role.BUYER, Role.USER, Role.ADMIN, Role.DEVELOPER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Purchase a certified package' })
  async purchase(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    const purchase = await this.packagesService.purchase(id, user.id);
    return {
      purchase_id: purchase.id,
      package_id: purchase.packageId,
      amount: purchase.amount,
      download_token: purchase.downloadToken,
      ledger_transaction_id: purchase.ledgerTransactionId,
    };
  }

  @Get(':id/download')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch sample rows + schema for a purchased package' })
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('token') token: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!token) {
      throw new ForbiddenException('token query param required');
    }
    const { pkg, purchase } = await this.packagesService.getPurchaseForDownload(
      id,
      user.id,
      token,
    );
    return {
      package: {
        id: pkg.id,
        title: pkg.title,
        category: pkg.category,
        schema_json: pkg.schemaJson,
        sample_rows: pkg.sampleRows,
        claimed_metrics: pkg.claimedMetrics,
      },
      purchase: {
        id: purchase.id,
        purchased_at: purchase.purchasedAt,
        amount: purchase.amount,
      },
    };
  }

  @Post(':id/reevaluate')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-run AI evaluation on a package (admin)' })
  async reevaluate(@Param('id', new ParseUUIDPipe()) id: string) {
    const pkg = await this.packagesService.reevaluate(id);
    return { id: pkg.id, status: pkg.status };
  }

  @Post(':id/delist')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a package from the marketplace (admin)' })
  async delist(@Param('id', new ParseUUIDPipe()) id: string) {
    const pkg = await this.packagesService.delist(id);
    return { id: pkg.id, status: pkg.status };
  }
}
