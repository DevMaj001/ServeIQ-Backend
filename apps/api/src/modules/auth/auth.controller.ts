import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { WaiterLoginDto } from './dto/waiter-login.dto';
import { ActivateDto } from './dto/activate.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResolveBusinessCodeDto } from './dto/resolve-business-code.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Register a new business and owner',
    description:
      'Creates a new business account with the owner user. Upload logo/CAC first via POST /api/upload and pass the returned URLs here.',
  })
  @ApiResponse({ status: 201, description: 'Business and owner successfully created.' })
  @ApiResponse({ status: 400, description: 'Validation error — check the request body.' })
  @ApiResponse({ status: 409, description: 'Email already registered.' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Authenticates a user and returns a JWT access token. Use the token in the Authorize button (🔒) above to test protected endpoints.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful — JWT access token returned.',
    schema: {
      example: { accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @ApiResponse({ status: 200, description: 'New access token and refresh token issued.' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token.' })
  async refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refreshToken(refreshDto.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully.' })
  async logout(@Body() logoutDto: LogoutDto) {
    return this.authService.logout(logoutDto.refresh_token);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Request a password reset token' })
  @ApiResponse({ status: 200, description: 'OK' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Reset password using reset token' })
  @ApiResponse({ status: 200, description: 'OK' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('send-verification')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send email verification code' })
  @ApiResponse({ status: 200, description: 'OK' })
  async sendVerification(@Request() req: any) {
    return this.authService.sendEmailVerification(req.user.userId);
  }

  @Post('verify-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with OTP code' })
  @ApiResponse({ status: 200, description: 'OK' })
  async verifyEmail(@Request() req: any, @Body() body: { otp: string }) {
    return this.authService.verifyEmail(req.user.userId, body.otp);
  }

  @Post('setup-super-admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'One-time setup to create super admin account' })
  @ApiResponse({ status: 200, description: 'Super admin created or already exists' })
  async setupSuperAdmin(@Body() dto: { email: string; password: string; full_name?: string }) {
    return this.authService.setupSuperAdmin(dto);
  }

  @Post('waiter-login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Waiter PIN login',
    description:
      'Authenticates a staff member using their 4-digit PIN and branch ID or business ID. Returns a JWT scoped to their role (waiter, supervisor, chef, manager).',
  })
  @ApiBody({ type: WaiterLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Waiter authenticated — JWT access token returned.',
    schema: {
      example: { access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Invalid PIN.' })
  async waiterLogin(@Body() dto: WaiterLoginDto) {
    return this.authService.waiterLogin(dto);
  }

  @Post('resolve-business')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Resolve a business code',
    description: 'Takes a business code and returns the business ID and name. Used by waiter app to get business_id before PIN login.',
  })
  @ApiBody({ type: ResolveBusinessCodeDto })
  @ApiResponse({ status: 200, description: 'Business resolved successfully.' })
  @ApiResponse({ status: 404, description: 'Invalid business code.' })
  async resolveBusinessCode(@Body() dto: ResolveBusinessCodeDto) {
    return this.authService.resolveBusinessCode(dto.business_code);
  }

  @Post('impersonate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Impersonate a business (super admin only)',
    description: 'Returns a JWT scoped to the given business/branch for super admin support access.',
  })
  @ApiResponse({ status: 200, description: 'OK' })
  async impersonate(@Request() req: any, @Body() dto: { businessId: string; branchId?: string }) {
    return this.authService.impersonate(req.user, dto);
  }

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Activate waiter account with email and password',
    description:
      'First-time activation for a waiter. Validates email and password, activates the account, and returns a JWT.',
  })
  @ApiResponse({ status: 200, description: 'Account activated — JWT returned.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async activate(@Body() dto: ActivateDto) {
    return this.authService.activate(dto);
  }
}
