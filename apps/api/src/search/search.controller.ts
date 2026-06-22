import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @Query('q') q: string = '',
    @Query('types') typesParam?: string,
  ) {
    const types = typesParam
      ? (typesParam.split(',').filter((t) =>
          ['users', 'streams', 'resellers', 'categories'].includes(t),
        ) as ('users' | 'streams' | 'resellers' | 'categories')[])
      : undefined;

    return this.searchService.search(q, types);
  }
}
