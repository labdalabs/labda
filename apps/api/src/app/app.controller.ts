import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Public } from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Public root route — useful as a liveness probe.
  @Public()
  @Get()
  getData() {
    return this.appService.getData();
  }

  // Example of an authenticated route. Remove or rename for your project.
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser | undefined) {
    return user;
  }
}
